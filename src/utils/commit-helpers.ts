import { KnownError } from './error.js';

export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const retry = async <T>(fn: () => Promise<T>, attempts: number = 3, delay: number = 1000): Promise<T> => {
	for (let i = 0; i < attempts; i++) {
		try {
			return await fn();
		} catch (error) {
			if (i === attempts - 1) throw error;
			await sleep(delay);
		}
	}
	throw new Error('Retry failed');
};

export const getCommitMessage = async (
	messages: string[],
	skipConfirm: boolean
): Promise<string | null> => {
	const { select, confirm, isCancel, note } = await import('@clack/prompts');
	const { dim } = await import('kolorist');

	// Check if interactive prompts are available
	const isInteractive = process.stdout.isTTY && !process.env.CI;

	// Single message case
	if (messages.length === 1) {
		const [message] = messages;

		if (skipConfirm) {
			return message;
		}

		if (!isInteractive) {
			throw new KnownError('Interactive terminal required for commit message confirmation. Use --yes flag to skip confirmation.');
		}

		const [title, ...bodyLines] = message.split('\n');
		const body = bodyLines.join('\n').trim();
		const preview = body ? `${title}\n\n${body}` : title;
		note(preview, 'Commit message');
		const confirmed = await confirm({
			message: 'Use this commit message?',
		});

		return confirmed && !isCancel(confirmed) ? message : null;
	}

	// Multiple messages case
	if (skipConfirm) {
		return messages[0];
	}

	if (!isInteractive) {
		throw new KnownError('Interactive terminal required for commit message selection. Use --yes flag to skip selection and use the first message.');
	}

	// Show shared body once above the picker
	const sharedBody = messages[0].split('\n').slice(1).join('\n').trim();
	if (sharedBody) {
		note(sharedBody, 'Commit body (shared)');
	}

	const selected = await select({
		message: `Pick a commit title to use: ${dim('(Ctrl+c to exit)')}`,
		options: messages.map((value) => ({
			label: value.split('\n')[0],
			value,
		})),
	});

	if (isCancel(selected)) return null;

	return selected as string;
};