import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import chalk from 'chalk';

let _rl: ReturnType<typeof createInterface> | null = null;

function rl() {
  if (!_rl) _rl = createInterface({ input: stdin, output: stdout });
  return _rl;
}

export function closePrompt(): void {
  _rl?.close();
  _rl = null;
}

export async function ask(question: string, defaultValue?: string): Promise<string> {
  const hint = defaultValue ? chalk.dim(` (${defaultValue})`) : '';
  const answer = await rl().question(`${question}${hint}: `);
  return answer.trim() || defaultValue || '';
}

export async function confirm(question: string, defaultYes = true): Promise<boolean> {
  const hint = defaultYes ? chalk.dim(' (Y/n)') : chalk.dim(' (y/N)');
  const answer = await rl().question(`${question}${hint}: `);
  const normalized = answer.trim().toLowerCase();
  if (!normalized) return defaultYes;
  return normalized === 'y' || normalized === 'yes';
}

export async function select<T extends string>(
  question: string,
  options: Array<{ value: T; label: string }>,
  defaultIndex = 0,
): Promise<T> {
  console.log();
  console.log(chalk.bold(question));

  for (let i = 0; i < options.length; i++) {
    const marker = i === defaultIndex ? chalk.cyan('▸') : ' ';
    const num = chalk.dim(`${i + 1}.`);
    const label = i === defaultIndex
      ? chalk.cyan(options[i].label)
      : options[i].label;
    console.log(`  ${marker} ${num} ${label}`);
  }

  const answer = await rl().question(
    chalk.dim(`  Enter choice [1-${options.length}] (default ${defaultIndex + 1}): `),
  );

  const idx = answer.trim() ? parseInt(answer.trim(), 10) - 1 : defaultIndex;
  if (idx >= 0 && idx < options.length) {
    return options[idx].value;
  }
  return options[defaultIndex].value;
}
