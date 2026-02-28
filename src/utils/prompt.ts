import type { CommitType } from './config-types.js';

export const commitTypeFormats: Record<CommitType, string> = {
	plain: '<emoji> <type>: <commit message>',
	conventional: '<emoji> <type>[optional (<scope>)]: <commit message>',
	gitmoji: '<emoji> <commit message>',
};

const specifyCommitFormat = (type: CommitType) =>
	`The output response must be in format:\n${commitTypeFormats[type]}`;

/**
 * Conventional commit types mapped to emojis.
 * Used by both plain and conventional types.
 */
const conventionalWithEmojis = `Choose a type and its corresponding emoji from the JSON below that best describes the git diff. IMPORTANT: The type MUST be lowercase. The emoji MUST come before the type.\n${JSON.stringify(
	{
		'✨ feat': 'A new feature',
		'🐛 fix': 'A bug fix',
		'📝 docs': 'Documentation only changes',
		'💄 style': 'Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc)',
		'♻️ refactor': 'A code change that improves code structure without changing functionality',
		'⚡ perf': 'A code change that improves performance',
		'✅ test': 'Adding missing tests or correcting existing tests',
		'📦 build': 'Changes that affect the build system or external dependencies',
		'👷 ci': 'Changes to CI configuration files and scripts',
		'🔧 chore': "Other changes that don't modify src or test files",
		'⏪ revert': 'Reverts a previous commit',
		'🔥 remove': 'Remove code or files',
		'⬆️ deps': 'Upgrade or update dependencies',
	},
	null,
	2
)}`;

const commitTypes: Record<CommitType, string> = {
	plain: conventionalWithEmojis,
	conventional: conventionalWithEmojis,

	/**
	 * References:
	 * Gitmoji: https://gitmoji.dev/
	 */
	gitmoji: `Choose an emoji from the emoji-to-description JSON below that best describes the git diff:\n${JSON.stringify(
		{
			'✨': 'Introduce new features',
			'🐛': 'Fix a bug',
			'🚑': 'Critical hotfix',
			'📝': 'Add or update documentation',
			'💄': 'Add or update the UI and style files',
			'♻️': 'Refactor code',
			'⚡': 'Improve performance',
			'🔥': 'Remove code or files',
			'✅': 'Add, update, or pass tests',
			'📦': 'Add or update compiled files or packages',
			'⬆️': 'Upgrade dependencies',
			'⬇️': 'Downgrade dependencies',
			'🔧': 'Add or update configuration files',
			'👷': 'Add or update CI build system',
			'🔒': 'Fix security or privacy issues',
			'⏪': 'Revert changes',
			'🚚': 'Move or rename resources',
			'🏷': 'Add or update types',
			'🩹': 'Simple fix for a non-critical issue',
			'✏️': 'Fix typos',
		},
		null,
		2
	)}`,
};

export const generatePrompt = (
	locale: string,
	maxLength: number,
	type: CommitType,
	customPrompt?: string
) =>
	[
		'Generate a concise git commit message title in present tense that precisely describes the key changes in the following code diff. Focus on what was changed, not just file names. Provide only the title, no description or body.',
		`Message language: ${locale}`,
		`Commit message must be a maximum of ${maxLength} characters.`,
		'Exclude anything unnecessary such as translation. Your entire response will be passed directly into git commit.',
		`IMPORTANT: Do not include any explanations, introductions, or additional text. Do not wrap the commit message in quotes or any other formatting. The commit message must not exceed ${maxLength} characters. Respond with ONLY the commit message text.`,
		'Be specific: include concrete details (package names, versions, functionality) rather than generic statements.',
		customPrompt,
		commitTypes[type],
		specifyCommitFormat(type),
	]
		.filter(Boolean)
		.join('\n');

export const generateBodyPrompt = (locale: string) =>
	[
		'Generate a commit message body that explains WHAT changed and WHY, based on the code diff provided.',
		'Write 1-3 short paragraphs in plain language that a developer would find useful when reading git log.',
		'Focus on: what was changed, why it was changed, and any notable impact on the project.',
		'Do NOT repeat the commit title. Do NOT include the title line.',
		'Do NOT wrap the output in quotes or add any prefix/label.',
		'Do NOT use bullet points or lists — write in paragraph form.',
		`Message language: ${locale}`,
	].join('\n');
