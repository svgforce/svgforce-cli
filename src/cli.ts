import { Command } from 'commander';
import { loginCommand } from './commands/login.js';
import { logoutCommand } from './commands/logout.js';
import { whoamiCommand } from './commands/whoami.js';
import { optimizeCommand } from './commands/optimize.js';
import { reactCommand } from './commands/react.js';
import { reactNativeCommand } from './commands/reactNative.js';
import { angularCommand } from './commands/angular.js';
import { handleError } from './lib/errors.js';

const DEFAULT_OUTPUT = './svgforce-output';

export function createCli(): Command {
  const program = new Command();

  program
    .name('svgforce')
    .description('SvgForce CLI — optimize SVGs and generate icon components')
    .version('1.0.0');

  // ── Auth ─────────────────────────────────────────────

  program
    .command('login')
    .description('Authenticate with SvgForce (interactive or API key)')
    .option('--api-key <key>', 'Use an API key instead of email/password')
    .action(async (opts) => {
      try {
        await loginCommand({ apiKey: opts.apiKey });
      } catch (err) {
        handleError(err);
      }
    });

  program
    .command('logout')
    .description('Remove stored credentials')
    .action(async () => {
      try {
        await logoutCommand();
      } catch (err) {
        handleError(err);
      }
    });

  program
    .command('whoami')
    .description('Show current user, plan, and usage')
    .action(async () => {
      try {
        await whoamiCommand();
      } catch (err) {
        handleError(err);
      }
    });

  // ── Convert ──────────────────────────────────────────

  program
    .command('optimize')
    .description('Optimize SVG files (remove metadata, minify)')
    .argument('<files...>', 'SVG files, globs, or directories')
    .option('-o, --output <dir>', 'Output directory', DEFAULT_OUTPUT)
    .option('--dry-run', 'Preview without writing files', false)
    .option('--json', 'Output result as JSON', false)
    .action(async (files: string[], opts) => {
      try {
        await optimizeCommand(files, opts);
      } catch (err) {
        handleError(err);
      }
    });

  program
    .command('react')
    .description('Generate React icon component from SVGs')
    .argument('<files...>', 'SVG files, globs, or directories')
    .option('-o, --output <dir>', 'Output directory', DEFAULT_OUTPUT)
    .option('-n, --name <name>', 'Component name', 'Icon')
    .option('--opacity', 'Add opacity prop support', false)
    .option('--dry-run', 'Preview without writing files', false)
    .option('--json', 'Output result as JSON', false)
    .action(async (files: string[], opts) => {
      try {
        await reactCommand(files, opts);
      } catch (err) {
        handleError(err);
      }
    });

  program
    .command('react-native')
    .description('Generate React Native icon component from SVGs')
    .argument('<files...>', 'SVG files, globs, or directories')
    .option('-o, --output <dir>', 'Output directory', DEFAULT_OUTPUT)
    .option('-n, --name <name>', 'Component name', 'Icon')
    .option('--opacity', 'Add opacity prop support', false)
    .option('--dry-run', 'Preview without writing files', false)
    .option('--json', 'Output result as JSON', false)
    .action(async (files: string[], opts) => {
      try {
        await reactNativeCommand(files, opts);
      } catch (err) {
        handleError(err);
      }
    });

  program
    .command('angular')
    .description('Generate Angular icon component from SVGs')
    .argument('<files...>', 'SVG files, globs, or directories')
    .option('-o, --output <dir>', 'Output directory', DEFAULT_OUTPUT)
    .option('-n, --name <name>', 'Component name', 'Icon')
    .option('-s, --selector <selector>', 'Angular component selector')
    .option('--opacity', 'Add opacity prop support', false)
    .option('--dry-run', 'Preview without writing files', false)
    .option('--json', 'Output result as JSON', false)
    .action(async (files: string[], opts) => {
      try {
        await angularCommand(files, opts);
      } catch (err) {
        handleError(err);
      }
    });

  return program;
}
