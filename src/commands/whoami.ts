import chalk from 'chalk';
import ora from 'ora';
import { apiRequest } from '../lib/api.js';
import { getAuthCredential } from '../lib/config.js';
import { log } from '../lib/logger.js';
import { AuthError } from '../lib/errors.js';

interface ProfileResponse {
  id: string;
  name: string;
  email: string;
  subscription: {
    plan: string;
    iconsRemaining: number;
    iconsTotal: number;
    teamName?: string;
    teamRole?: string;
  };
}

export async function whoamiCommand(): Promise<void> {
  const cred = getAuthCredential();
  if (!cred) throw new AuthError();

  const spinner = ora('Fetching account info...').start();

  const profile = await apiRequest<ProfileResponse>('/profile');
  spinner.stop();

  const plan = profile.subscription.plan.toUpperCase();
  const used = profile.subscription.iconsTotal - profile.subscription.iconsRemaining;

  log.blank();
  console.log(`  ${chalk.dim('User:')}     ${chalk.bold(profile.name)} ${chalk.dim(`<${profile.email}>`)}`);
  console.log(`  ${chalk.dim('Plan:')}     ${chalk.bold(plan)}`);
  console.log(`  ${chalk.dim('Usage:')}    ${used}/${profile.subscription.iconsTotal} icons this month`);

  if (profile.subscription.teamName) {
    console.log(`  ${chalk.dim('Team:')}     ${profile.subscription.teamName}${profile.subscription.teamRole ? ` (${profile.subscription.teamRole})` : ''}`);
  }

  console.log(`  ${chalk.dim('Auth:')}     ${cred.type === 'api_key' ? 'API Key' : 'JWT Token'}`);
  log.blank();
}
