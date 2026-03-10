import Conf from 'conf';

export interface SvgForceConfig {
  apiKey?: string;
  jwtToken?: string;
  apiUrl?: string;
  userEmail?: string;
}

const CONFIG_DEFAULTS: SvgForceConfig = {
  apiUrl: 'https://api.svgforce.dev',
};

export const config = new Conf<SvgForceConfig>({
  projectName: 'svgforce',
  projectVersion: '1.0.0',
  defaults: CONFIG_DEFAULTS,
  schema: {
    apiKey: { type: 'string' },
    jwtToken: { type: 'string' },
    apiUrl: { type: 'string', default: 'https://api.svgforce.dev' },
    userEmail: { type: 'string' },
  },
});

export function getAuthCredential(): { type: 'api_key'; value: string } | { type: 'jwt'; value: string } | null {
  const envKey = process.env.SVGFORCE_API_KEY;
  if (envKey) return { type: 'api_key', value: envKey };

  const storedKey = config.get('apiKey');
  if (storedKey) return { type: 'api_key', value: storedKey };

  const jwt = config.get('jwtToken');
  if (jwt) return { type: 'jwt', value: jwt };

  return null;
}

export function getApiUrl(): string {
  return process.env.SVGFORCE_API_URL ?? config.get('apiUrl') ?? 'https://api.svgforce.dev';
}
