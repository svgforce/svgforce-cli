import chalk from 'chalk';

export class CliError extends Error {
  constructor(
    message: string,
    public readonly hint?: string,
  ) {
    super(message);
    this.name = 'CliError';
  }
}

export class AuthError extends CliError {
  constructor(message = 'Not authenticated. Run `svgforce login` first.') {
    super(message, 'svgforce login');
    this.name = 'AuthError';
  }
}

export class PlanError extends CliError {
  constructor() {
    super(
      'CLI access is available only for the Team plan.',
      'Upgrade at https://svgforce.dev/pricing',
    );
    this.name = 'PlanError';
  }
}

export function handleError(err: unknown): never {
  if (err instanceof CliError) {
    console.error(chalk.red(`Error: ${err.message}`));
    if (err.hint) {
      console.error(chalk.dim(`  Hint: ${err.hint}`));
    }
    process.exit(1);
  }

  if (err instanceof Error) {
    console.error(chalk.red(`Unexpected error: ${err.message}`));
    if (process.env.DEBUG) {
      console.error(err.stack);
    }
    process.exit(1);
  }

  console.error(chalk.red('An unknown error occurred'));
  process.exit(1);
}
