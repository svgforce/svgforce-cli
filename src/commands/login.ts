import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import chalk from 'chalk';
import ora from 'ora';
import { storeApiKey, storeJwt } from '../lib/auth.js';
import { getApiUrl } from '../lib/config.js';
import { log } from '../lib/logger.js';
import { CliError } from '../lib/errors.js';

export interface LoginOptions {
  apiKey?: string;
}

export async function loginCommand(opts: LoginOptions): Promise<void> {
  if (opts.apiKey) {
    return loginWithApiKey(opts.apiKey);
  }

  return loginInteractive();
}

async function loginWithApiKey(key: string): Promise<void> {
  if (!key.startsWith('sf_live_')) {
    throw new CliError(
      'Invalid API key format. Keys start with "sf_live_".',
      'Generate a key at https://svgforce.dev/profile',
    );
  }

  const spinner = ora('Verifying API key...').start();

  try {
    const baseUrl = getApiUrl().replace(/\/+$/, '');
    const res = await fetch(`${baseUrl}/api/auth/me`, {
      headers: {
        'X-Api-Key': key,
        'User-Agent': 'svgforce-cli/1.0.0',
      },
    });

    if (!res.ok) {
      spinner.fail('Invalid API key.');
      throw new CliError('API key verification failed. Make sure the key is correct and not revoked.');
    }

    const data = (await res.json()) as { email?: string; name?: string };
    storeApiKey(key);
    spinner.succeed(`Authenticated as ${chalk.bold(data.email ?? data.name ?? 'user')}`);
  } catch (err) {
    if (err instanceof CliError) {
      spinner.fail(err.message);
      throw err;
    }
    spinner.fail('Connection failed.');
    throw new CliError('Could not reach the SvgForce API.', `Check your connection or set SVGFORCE_API_URL`);
  }
}

async function loginInteractive(): Promise<void> {
  log.info(`Log in to ${chalk.bold('SvgForce')} with your email and password.`);
  log.dim('Your credentials are sent directly to the API and are never stored locally.');
  log.blank();

  const rl = createInterface({ input: stdin, output: stdout });

  try {
    const email = await rl.question(chalk.cyan('  Email: '));
    if (!email.includes('@')) {
      throw new CliError('Invalid email address.');
    }

    // Disable echo for password input
    const password = await new Promise<string>((resolve) => {
      stdout.write(chalk.cyan('  Password: '));
      const originalRawMode = stdin.isRaw;
      if (stdin.isTTY) stdin.setRawMode(true);

      let buf = '';
      const onData = (ch: Buffer) => {
        const c = ch.toString();
        if (c === '\n' || c === '\r') {
          if (stdin.isTTY) stdin.setRawMode(originalRawMode ?? false);
          stdin.removeListener('data', onData);
          stdout.write('\n');
          resolve(buf);
        } else if (c === '\u007F' || c === '\b') {
          buf = buf.slice(0, -1);
        } else if (c === '\u0003') {
          // Ctrl+C
          if (stdin.isTTY) stdin.setRawMode(originalRawMode ?? false);
          stdin.removeListener('data', onData);
          process.exit(130);
        } else {
          buf += c;
        }
      };
      stdin.on('data', onData);
    });

    if (!password) {
      throw new CliError('Password cannot be empty.');
    }

    const spinner = ora('Logging in...').start();

    const baseUrl = getApiUrl().replace(/\/+$/, '');
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'svgforce-cli/1.0.0',
      },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      spinner.fail('Login failed.');

      if (data.requires2FA) {
        throw new CliError(
          '2FA is enabled on this account. Use an API key instead.',
          'Generate a key at https://svgforce.dev/profile, then run: svgforce login --api-key <key>',
        );
      }

      throw new CliError((data.message as string) ?? 'Invalid email or password.');
    }

    const data = (await res.json()) as { token?: string; user?: { email?: string; name?: string } };

    if (!data.token) {
      spinner.fail('Login failed.');
      throw new CliError('Server did not return an authentication token.');
    }

    storeJwt(data.token, email);
    spinner.succeed(`Logged in as ${chalk.bold(data.user?.email ?? email)}`);
  } finally {
    rl.close();
  }
}
