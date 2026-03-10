import { clearCredentials } from '../lib/auth.js';
import { log } from '../lib/logger.js';

export async function logoutCommand(): Promise<void> {
  clearCredentials();
  log.success('Logged out. All stored credentials have been removed.');
}
