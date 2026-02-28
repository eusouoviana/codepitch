import { command } from 'cleye';
import { green } from 'kolorist';
import { intro, outro, spinner } from '@clack/prompts';
import { exec } from '../utils/exec.js';
import { handleCommandError } from '../utils/error.js';

export default command(
	{
		name: 'update',
		description: 'Update codepitch to the latest version',
		help: {
			description: 'Update codepitch to the latest version',
		},
	},
	() => {
		(async () => {
			intro('Updating codepitch');

			const s = spinner();
			s.start('Installing latest version...');

			try {
				await exec('npm', ['install', '-g', '@unfoldingcx/codepitch@latest']);
				s.stop('Updated successfully');

				const { stdout } = await exec('codepitch', ['--version']);
				outro(`${green('✔')} codepitch is now at v${stdout.trim()}`);
			} catch (error) {
				s.stop('Update failed');
				console.log('You can update manually with:');
				console.log('  npm install -g @unfoldingcx/codepitch@latest');
			}
		})().catch(handleCommandError);
	}
);
