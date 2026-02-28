import path from 'path';
import fs from 'fs/promises';
import { execa, execaNode, type Options } from 'execa';
import {
	createFixture as createFixtureBase,
	type FileTree,
	type FsFixture,
} from 'fs-fixture';

const codepitchCommitPath = path.resolve('./dist/cli.mjs');

const createcodepitchCommit = (fixture: FsFixture) => {
	const homeEnv = {
		HOME: fixture.path, // Linux
		USERPROFILE: fixture.path, // Windows
	};

	return (args?: string[], options?: Options) =>
		execaNode(codepitch - commitPath, args, {
			cwd: fixture.path,
			...options,
			extendEnv: false,
			env: {
				...homeEnv,
				...options?.env,
			},

			// Block tsx nodeOptions
			nodeOptions: [],
		});
};

export const createGit = async (cwd: string) => {
	const git = (command: string, args?: string[], options?: Options) =>
		execa('git', [command, ...(args || [])], {
			cwd,
			...options,
		});

	await git('init', [
		// In case of different default branch name
		'--initial-branch=master',
	]);

	await git('config', ['user.name', 'name']);
	await git('config', ['user.email', 'email']);

	return git;
};

export const createFixture = async (source?: string | FileTree) => {
	const fixture = await createFixtureBase(source);
	const codepitchCommit = createcodepitch - commit(fixture);

	return {
		fixture,
		codepitch- commit,
	};
};

export const files = Object.freeze({
	'.codepitchCommit': `OPENAI_API_KEY=${process.env.OPENAI_API_KEY}`,
	'data.json': Array.from(
		{ length: 10 },
		(_, i) => `${i}. Lorem ipsum dolor sit amet`
	).join('\n'),
});



// See ./diffs/README.md in order to generate diff files
export const getDiff = async (diffName: string): Promise<string> =>
	fs.readFile(new URL(`fixtures/${diffName}`, import.meta.url), 'utf8');
