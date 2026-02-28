import { execFile, spawn } from 'node:child_process';

interface ExecResult {
	stdout: string;
	stderr: string;
	failed: boolean;
	timedOut: boolean;
}

interface ExecOptions {
	reject?: boolean;
	input?: string;
	stdio?: 'inherit' | 'pipe';
	timeout?: number;
	cleanup?: boolean;
}

export async function exec(
	command: string,
	args: string[] = [],
	options: ExecOptions = {},
): Promise<ExecResult> {
	const { reject = true, input, stdio, timeout } = options;

	if (stdio === 'inherit') {
		return new Promise((resolve, rej) => {
			const child = spawn(command, args, {
				stdio: 'inherit',
				timeout,
			});

			let timedOut = false;

			child.on('close', (code) => {
				const result: ExecResult = {
					stdout: '',
					stderr: '',
					failed: code !== 0,
					timedOut,
				};
				if (code !== 0 && reject) {
					const err = Object.assign(new Error(`Command failed: ${command}`), result);
					rej(err);
				} else {
					resolve(result);
				}
			});

			child.on('error', (err) => {
				if ((err as any).code === 'ETIMEDOUT') timedOut = true;
				if (reject) rej(Object.assign(err, { timedOut, failed: true, stdout: '', stderr: '' }));
				else resolve({ stdout: '', stderr: '', failed: true, timedOut });
			});
		});
	}

	return new Promise((resolve, rej) => {
		const child = execFile(command, args, { timeout }, (error, stdout, stderr) => {
			const timedOut = !!error && (error as any).killed && !!timeout;
			const result: ExecResult = {
				stdout: typeof stdout === 'string' ? stdout : '',
				stderr: typeof stderr === 'string' ? stderr : '',
				failed: !!error,
				timedOut,
			};
			if (error && reject) {
				rej(Object.assign(error, result));
			} else {
				resolve(result);
			}
		});

		if (input && child.stdin) {
			child.stdin.end(input);
		}
	});
}
