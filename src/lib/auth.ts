import { config } from './config.js';

export function storeApiKey(key: string): void {
  config.set('apiKey', key);
  config.delete('jwtToken');
}

export function storeJwt(token: string, email?: string): void {
  config.set('jwtToken', token);
  if (email) config.set('userEmail', email);
  config.delete('apiKey');
}

export function clearCredentials(): void {
  config.delete('apiKey');
  config.delete('jwtToken');
  config.delete('userEmail');
}

export function getStoredEmail(): string | undefined {
  return config.get('userEmail');
}
