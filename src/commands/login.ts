import http from 'node:http';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import chalk from 'chalk';
import ora from 'ora';
import open from 'open';
import { storeApiKey, storeJwt } from '../lib/auth.js';
import { getApiUrl } from '../lib/config.js';
import { log } from '../lib/logger.js';
import { CliError } from '../lib/errors.js';

const FRONTEND_URL = process.env.SVGFORCE_FRONTEND_URL ?? 'https://svgforce.dev';

export interface LoginOptions {
  apiKey?: string;
  withEmail?: boolean;
}

export async function loginCommand(opts: LoginOptions): Promise<void> {
  if (opts.apiKey) {
    return loginWithApiKey(opts.apiKey);
  }

  if (opts.withEmail) {
    return loginInteractive();
  }

  return loginWithBrowser();
}

// ── Browser-based login ───────────────────────────────

const SUCCESS_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SvgForce CLI — Authenticated</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      min-height: 100vh; display: flex; align-items: center; justify-content: center;
      background: #0a0e1a; color: #e2e8f0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    .card {
      text-align: center; padding: 48px; border-radius: 24px;
      background: rgba(15, 20, 45, 0.8); border: 1px solid rgba(255,255,255,0.1);
      box-shadow: 0 20px 40px rgba(0,0,0,0.4);
    }
    .icon { font-size: 48px; margin-bottom: 16px; }
    h1 { font-size: 24px; margin-bottom: 8px; }
    p { color: rgba(255,255,255,0.5); font-size: 14px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">&#10003;</div>
    <h1>Authenticated!</h1>
    <p>You can close this tab and return to your terminal.</p>
  </div>
</body>
</html>`;

const ERROR_HTML = (msg: string) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"><title>SvgForce CLI — Error</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      min-height: 100vh; display: flex; align-items: center; justify-content: center;
      background: #0a0e1a; color: #e2e8f0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    .card { text-align: center; padding: 48px; border-radius: 24px;
      background: rgba(15, 20, 45, 0.8); border: 1px solid rgba(239,68,68,0.3); }
    h1 { font-size: 24px; margin-bottom: 8px; color: #ef4444; }
    p { color: rgba(255,255,255,0.5); font-size: 14px; }
  </style>
</head>
<body>
  <div class="card"><h1>Authentication failed</h1><p>${msg}</p></div>
</body>
</html>`;

function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = http.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

async function loginWithBrowser(): Promise<void> {
  const port = await findFreePort();

  log.info(`Opening browser to authenticate with ${chalk.bold('SvgForce')}...`);
  log.dim('  If the browser does not open, visit the URL below manually:');

  const authUrl = `${FRONTEND_URL}/en/cli-auth?port=${port}`;
  log.dim(`  ${authUrl}`);
  log.blank();

  const spinner = ora('Waiting for browser authentication...').start();

  const token = await new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => {
      server.close();
      reject(new CliError(
        'Login timed out (2 minutes). No response from browser.',
        'Try again or use: svgforce login --api-key <key>',
      ));
    }, 120_000);

    const server = http.createServer((req, res) => {
      const url = new URL(req.url ?? '/', `http://127.0.0.1:${port}`);

      if (url.pathname === '/callback') {
        const tk = url.searchParams.get('token');
        const email = url.searchParams.get('email');

        if (tk) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(SUCCESS_HTML);
          clearTimeout(timeout);
          server.close();
          if (email) storeJwt(tk, email);
          else storeJwt(tk);
          resolve(tk);
        } else {
          res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(ERROR_HTML('No token received.'));
        }
        return;
      }

      res.writeHead(404);
      res.end('Not found');
    });

    server.listen(port, '127.0.0.1', () => {
      open(authUrl).catch(() => {});
    });
  });

  spinner.stop();

  // Verify the token
  try {
    const baseUrl = getApiUrl().replace(/\/+$/, '');
    const res = await fetch(`${baseUrl}/api/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'User-Agent': 'svgforce-cli/1.0.0',
      },
    });

    if (res.ok) {
      const data = (await res.json()) as { email?: string; name?: string };
      log.success(`Authenticated as ${chalk.bold(data.email ?? data.name ?? 'user')}`);
    } else {
      log.success('Authenticated via browser.');
    }
  } catch {
    log.success('Authenticated via browser.');
  }
}

// ── API key login ─────────────────────────────────────

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

// ── Email + password login ────────────────────────────

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
