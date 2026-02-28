import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { KnownError } from './error.js';
import type { CommitType } from './config-types.js';
import { generatePrompt, generateBodyPrompt, commitTypeFormats } from './prompt.js';

/**
 * Extracts the actual response from reasoning model outputs.
 * Reasoning models (like DeepSeek R1, QwQ, etc.) include their thought process
 * in <think>...</think> tags. We need to extract the content after these tags.
 */
const extractResponseFromReasoning = (message: string): string => {
	// Pattern to match <think>...</think> tags and everything before the actual response
	// This handles both single-line and multi-line think blocks
	const thinkPattern = /<think>[\s\S]*?<\/think>/gi;

	// Remove all <think>...</think> blocks and any content before the first think block
	let cleaned = message.replace(thinkPattern, '');

	// Remove any leading/trailing whitespace and newlines
	cleaned = cleaned.trim();

	return cleaned;
};

const sanitizeTitle = (message: string) => {
	// First, extract response from reasoning models if present
	let processed = extractResponseFromReasoning(message);

	// Then apply existing sanitization
 	const sanitized = processed
 		.trim()
 		.split('\n')[0] // Take only the first line
 		.replace(/(\w)\.$/, '$1')
 		.replace(/^["'`]|["'`]$/g, '') // Remove surrounding quotes
 		.replace(/^<[^>]*>\s*/, ''); // Remove leading tags

 	return sanitized;
};

const sanitizeBody = (message: string) => {
	let processed = extractResponseFromReasoning(message);
	return processed
		.trim()
		.replace(/^["'`]|["'`]$/g, '')
		.replace(/^<[^>]*>\s*/, '');
};

const deduplicateTitles = (array: string[]) => Array.from(new Set(array));

type ServiceTier = 'auto' | 'flex' | 'priority' | 'default';

const buildProviderOptions = (
	baseUrl: string,
	serviceTier?: ServiceTier
) => {
	if (!serviceTier || baseUrl !== 'https://api.openai.com/v1') return undefined;
	return { openai: { serviceTier } } as const;
};

const shortenCommitMessage = async (
	provider: any,
	model: string,
	message: string,
	maxLength: number,
	timeout: number,
	providerOptions?: ReturnType<typeof buildProviderOptions>
) => {
	const abortController = new AbortController();
	const timeoutId = setTimeout(() => abortController.abort(), timeout);

	try {
		const result = await generateText({
			model: provider(model),
			system: `You are a tool that shortens git commit messages. Given a commit message, make it shorter while preserving the key information and format. The shortened message must be ${maxLength} characters or less. Respond with ONLY the shortened commit message.`,
			prompt: message,
			temperature: 0.2,
			maxRetries: 2,
			maxOutputTokens: 500,
			...(providerOptions && { providerOptions }),
		});
		clearTimeout(timeoutId);
		return sanitizeTitle(result.text);
	} catch (error) {
		clearTimeout(timeoutId);
		throw error;
	}
};

export const generateCommitMessage = async (
	baseUrl: string,
	apiKey: string,
	model: string,
	locale: string,
	diff: string,
	completions: number,
	maxLength: number,
	type: CommitType,
	timeout: number,
	customPrompt?: string,
	serviceTier?: ServiceTier
) => {
	if (process.env.DEBUG) {
		console.log('Diff being sent to AI:');
		console.log(diff);
	}

	try {
		const provider =
			baseUrl === 'https://api.openai.com/v1'
				? createOpenAI({ apiKey })
				: createOpenAICompatible({
						name: 'custom',
						apiKey,
						baseURL: baseUrl,
				  });

		const abortController = new AbortController();
		const timeoutId = setTimeout(() => abortController.abort(), timeout);

		const providerOptions = buildProviderOptions(baseUrl, serviceTier);

		const commonOpts = {
			temperature: 0.4,
			maxRetries: 2,
			...(providerOptions && { providerOptions }),
		};

		// Generate titles
		const titlePromises = Array.from({ length: completions }, () =>
			generateText({
				model: provider(model),
				system: generatePrompt(locale, maxLength, type, customPrompt),
				prompt: diff,
				maxOutputTokens: 2000,
				...commonOpts,
			}).finally(() => clearTimeout(timeoutId))
		);
		const titleResults = await Promise.all(titlePromises);

		if (serviceTier) {
			const actual = (titleResults[0] as any).providerMetadata?.openai?.serviceTier;
			console.log(`  ⚡ service_tier: requested=${serviceTier}, response=${actual || 'n/a'}`);
		}

		let titles = deduplicateTitles(
			titleResults.map((r) => sanitizeTitle(r.text))
		);

		// Shorten titles that exceed maxLength
		const MAX_SHORTEN_RETRIES = 3;
		for (let retry = 0; retry < MAX_SHORTEN_RETRIES; retry++) {
			let needsShortening = false;
			const shortened = await Promise.all(
				titles.map(async (msg) => {
					if (msg.length <= maxLength) return msg;
					needsShortening = true;
					try {
						return await shortenCommitMessage(provider, model, msg, maxLength, timeout, providerOptions);
					} catch {
						return msg;
					}
				})
			);
			titles = deduplicateTitles(shortened);
			if (!needsShortening) break;
		}

		// Generate body (single call, shared across all title options)
		const bodyResult = await generateText({
			model: provider(model),
			system: generateBodyPrompt(locale),
			prompt: diff,
			maxOutputTokens: 1000,
			...commonOpts,
		});
		const body = sanitizeBody(bodyResult.text);

		// Combine title + body
		const messages = titles.map((title) =>
			body ? `${title}\n\n${body}` : title
		);

		const allResults = [...titleResults, bodyResult];
		const usage = {
			prompt_tokens: allResults.reduce(
				(sum, r) => sum + ((r.usage as any).promptTokens || 0),
				0
			),
			completion_tokens: allResults.reduce(
				(sum, r) => sum + ((r.usage as any).completionTokens || 0),
				0
			),
			total_tokens: allResults.reduce(
				(sum, r) => sum + ((r.usage as any).totalTokens || 0),
				0
			),
		};
		return { messages, usage };
	} catch (error) {
		const errorAsAny = error as any;

		console.log(errorAsAny);

		if (errorAsAny.code === 'ENOTFOUND') {
			throw new KnownError(
				`Error connecting to ${errorAsAny.hostname} (${errorAsAny.syscall}). Are you connected to the internet?`
			);
		}

		if (errorAsAny.status === 429) {
			const resetHeader = errorAsAny.headers?.get('x-ratelimit-reset');
			let message = 'Rate limit exceeded';
			if (resetHeader) {
				const resetTime = parseInt(resetHeader);
				const now = Date.now();
				const waitMs = resetTime - now;
				const waitSec = Math.ceil(waitMs / 1000);
				if (waitSec > 0) {
					let timeStr: string;
					if (waitSec < 60) {
						timeStr = `${waitSec} second${waitSec === 1 ? '' : 's'}`;
					} else if (waitSec < 3600) {
						const minutes = Math.ceil(waitSec / 60);
						timeStr = `${minutes} minute${minutes === 1 ? '' : 's'}`;
					} else {
						const hours = Math.ceil(waitSec / 3600);
						timeStr = `${hours} hour${hours === 1 ? '' : 's'}`;
					}
					message += `. Retry in ${timeStr}.`;
				}
			}
			throw new KnownError(message);
		}

		throw errorAsAny;
	}
};

export const combineCommitMessages = async (
	messages: string[],
	baseUrl: string,
	apiKey: string,
	model: string,
	locale: string,
	maxLength: number,
	type: CommitType,
	timeout: number,
	customPrompt?: string,
	serviceTier?: ServiceTier
) => {
	try {
		const provider =
			baseUrl === 'https://api.openai.com/v1'
				? createOpenAI({ apiKey })
				: createOpenAICompatible({
						name: 'custom',
						apiKey,
						baseURL: baseUrl,
				  });

		const abortController = new AbortController();
		const timeoutId = setTimeout(() => abortController.abort(), timeout);
		const providerOptions = buildProviderOptions(baseUrl, serviceTier);

		const commonOpts = {
			temperature: 0.4,
			maxRetries: 2,
			...(providerOptions && { providerOptions }),
		};

		const titleSystem = `You are a tool that generates git commit messages. Your task is to combine multiple commit messages into one.

Input: Several commit messages separated by newlines.
Output: A single commit title starting with type like 'feat:' or 'fix:'.

Do not add thanks, explanations, or any text outside the commit title.`;

		const titleResult = await generateText({
			model: provider(model),
			system: titleSystem,
			prompt: messages.join('\n'),
			maxOutputTokens: 2000,
			...commonOpts,
		});

		clearTimeout(timeoutId);

		let title = sanitizeTitle(titleResult.text);

		// Shorten if too long
		if (title.length > maxLength) {
			try {
				title = await shortenCommitMessage(provider, model, title, maxLength, timeout, providerOptions);
			} catch {
				// If shortening fails, keep the original
			}
		}

		// Generate body from the original diff messages
		const bodyResult = await generateText({
			model: provider(model),
			system: generateBodyPrompt(locale),
			prompt: messages.join('\n'),
			maxOutputTokens: 1000,
			...commonOpts,
		});
		const body = sanitizeBody(bodyResult.text);

		const combined = body ? `${title}\n\n${body}` : title;
		const totalUsage = {
			promptTokens: ((titleResult.usage as any).promptTokens || 0) + ((bodyResult.usage as any).promptTokens || 0),
			completionTokens: ((titleResult.usage as any).completionTokens || 0) + ((bodyResult.usage as any).completionTokens || 0),
			totalTokens: ((titleResult.usage as any).totalTokens || 0) + ((bodyResult.usage as any).totalTokens || 0),
		};

		return { messages: [combined], usage: totalUsage };
	} catch (error) {
		const errorAsAny = error as any;

		console.log(errorAsAny);

		throw errorAsAny;
	}
};
