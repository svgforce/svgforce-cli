import { getAuthCredential, getApiUrl } from './config.js';
import { AuthError, CliError, PlanError } from './errors.js';

interface RequestOptions {
  method?: 'GET' | 'POST' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  raw?: boolean;
}

export async function apiRequest<T = unknown>(
  path: string,
  opts: RequestOptions = {},
): Promise<T> {
  const cred = getAuthCredential();
  if (!cred) throw new AuthError();

  const baseUrl = getApiUrl().replace(/\/+$/, '');
  const url = `${baseUrl}/api${path}`;

  const headers: Record<string, string> = {
    'User-Agent': 'svgforce-cli/1.0.0',
    ...opts.headers,
  };

  if (cred.type === 'api_key') {
    headers['X-Api-Key'] = cred.value;
  } else {
    headers['Authorization'] = `Bearer ${cred.value}`;
  }

  if (opts.body && !opts.raw) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(url, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  if (res.status === 401) {
    throw new AuthError('Session expired or invalid credentials. Run `svgforce login` again.');
  }

  if (res.status === 403) {
    const data = await res.json().catch(() => ({})) as Record<string, unknown>;
    if (data.error === 'CLI_NOT_AVAILABLE') {
      throw new PlanError();
    }
    throw new CliError(
      (data.message as string) ?? `Forbidden (${res.status})`,
      typeof data.error === 'string' ? data.error : undefined,
    );
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({})) as Record<string, unknown>;
    throw new CliError(
      (data.message as string) ?? `Request failed with status ${res.status}`,
      typeof data.error === 'string' ? data.error : undefined,
    );
  }

  return res.json() as Promise<T>;
}

export async function apiRequestBinary(
  path: string,
  opts: RequestOptions = {},
): Promise<{ buffer: Buffer; filename: string; contentType: string; headers: Headers }> {
  const cred = getAuthCredential();
  if (!cred) throw new AuthError();

  const baseUrl = getApiUrl().replace(/\/+$/, '');
  const url = `${baseUrl}/api${path}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'svgforce-cli/1.0.0',
    ...opts.headers,
  };

  if (cred.type === 'api_key') {
    headers['X-Api-Key'] = cred.value;
  } else {
    headers['Authorization'] = `Bearer ${cred.value}`;
  }

  const res = await fetch(url, {
    method: opts.method ?? 'POST',
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  if (res.status === 401) {
    throw new AuthError('Session expired or invalid credentials. Run `svgforce login` again.');
  }

  if (res.status === 403) {
    const text = await res.text();
    let data: Record<string, unknown> = {};
    try { data = JSON.parse(text); } catch {}
    if (data.error === 'CLI_NOT_AVAILABLE') throw new PlanError();
    throw new CliError(
      (data.message as string) ?? `Forbidden (${res.status})`,
    );
  }

  if (!res.ok) {
    const text = await res.text();
    let data: Record<string, unknown> = {};
    try { data = JSON.parse(text); } catch {}
    throw new CliError(
      (data.message as string) ?? `Request failed with status ${res.status}`,
    );
  }

  const disposition = res.headers.get('content-disposition') ?? '';
  const filenameMatch = disposition.match(/filename="?([^";\n]+)"?/);
  const filename = filenameMatch?.[1] ?? 'output';
  const contentType = res.headers.get('content-type') ?? 'application/octet-stream';
  const arrayBuf = await res.arrayBuffer();

  return {
    buffer: Buffer.from(arrayBuf),
    filename,
    contentType,
    headers: res.headers,
  };
}
