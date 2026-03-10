import fs from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';
import { log } from '../lib/logger.js';
import { select, ask, confirm, closePrompt } from '../lib/prompt.js';
import { writeProjectConfig, getConfigFilename, type ProjectConfig } from '../lib/projectConfig.js';

type Framework = ProjectConfig['framework'];

const FRAMEWORK_OPTIONS: Array<{ value: Framework; label: string }> = [
  { value: 'react', label: 'React (.tsx)' },
  { value: 'react-native', label: 'React Native (.tsx)' },
  { value: 'angular', label: 'Angular (.component.ts)' },
  { value: 'optimize', label: 'Optimize only (.svg)' },
];

const DEFAULT_INPUTS: Record<Framework, string> = {
  react: './icons',
  'react-native': './icons',
  angular: './icons',
  optimize: './icons',
};

const DEFAULT_OUTPUTS: Record<Framework, string> = {
  react: './src/components/icons',
  'react-native': './src/icons',
  angular: './src/app/icons',
  optimize: './icons/optimized',
};

const DEFAULT_NAMES: Record<Framework, string> = {
  react: 'Icon',
  'react-native': 'Icon',
  angular: 'Icon',
  optimize: '',
};

function buildNpmScripts(cfg: ProjectConfig): Record<string, string> {
  const scripts: Record<string, string> = {};

  if (cfg.framework === 'optimize') {
    scripts['icons'] = `svgforce optimize ${cfg.input} -o ${cfg.output}`;
  } else {
    const nameFlag = cfg.componentName ? ` -n ${cfg.componentName}` : '';
    const selectorFlag = cfg.framework === 'angular' && cfg.selector ? ` -s ${cfg.selector}` : '';
    scripts['icons'] = `svgforce ${cfg.framework} ${cfg.input} -o ${cfg.output}${nameFlag}${selectorFlag}`;
    scripts['icons:optimize'] = `svgforce optimize ${cfg.input} -o ${cfg.input}`;
  }

  return scripts;
}

function printBanner(): void {
  console.log();
  console.log(chalk.bold.cyan('  ╔═══════════════════════════════════════╗'));
  console.log(chalk.bold.cyan('  ║') + chalk.bold('       SvgForce — Project Setup        ') + chalk.bold.cyan('║'));
  console.log(chalk.bold.cyan('  ╚═══════════════════════════════════════╝'));
  console.log();
  console.log(
    chalk.dim('  This wizard will configure SvgForce for your project.'),
  );
  console.log(
    chalk.dim('  It creates a config file and optional npm scripts.'),
  );
  console.log();
}

export async function initCommand(): Promise<void> {
  printBanner();

  const configFile = getConfigFilename();
  const existingConfig = path.join(process.cwd(), configFile);
  if (fs.existsSync(existingConfig)) {
    log.warn(`${chalk.bold(configFile)} already exists in this directory.`);
    const overwrite = await confirm('  Overwrite it?', false);
    if (!overwrite) {
      log.info('Aborted. Existing config is unchanged.');
      closePrompt();
      return;
    }
    console.log();
  }

  // ── 1. Framework ────────────────────────────────────

  const framework = await select<Framework>(
    '  Which framework do you use?',
    FRAMEWORK_OPTIONS,
    0,
  );

  // ── 2. Input directory ──────────────────────────────

  console.log();
  const input = await ask(
    `  ${chalk.bold('Where are your SVG files?')}`,
    DEFAULT_INPUTS[framework],
  );

  // ── 3. Output directory ─────────────────────────────

  const output = await ask(
    `  ${chalk.bold('Where to save generated files?')}`,
    DEFAULT_OUTPUTS[framework],
  );

  // ── 4. Component name (if applicable) ───────────────

  let componentName: string | undefined;
  let selector: string | undefined;

  if (framework !== 'optimize') {
    componentName = await ask(
      `  ${chalk.bold('Component name')}`,
      DEFAULT_NAMES[framework],
    );

    if (framework === 'angular') {
      const defaultSelector = `app-${(componentName || 'icon').toLowerCase()}`;
      selector = await ask(
        `  ${chalk.bold('Angular selector')}`,
        defaultSelector,
      );
    }
  }

  // ── 5. Create config file ───────────────────────────

  console.log();
  const createConfig = await confirm(
    `  ${chalk.bold(`Create ${chalk.cyan(configFile)}?`)}`,
    true,
  );

  const projectConfig: ProjectConfig = {
    framework,
    input,
    output,
    ...(componentName && { componentName }),
    ...(selector && { selector }),
  };

  let configCreated = false;
  if (createConfig) {
    writeProjectConfig(projectConfig);
    configCreated = true;
  }

  // ── 6. Add npm scripts ─────────────────────────────

  let scriptsAdded = false;
  const pkgPath = path.join(process.cwd(), 'package.json');
  const hasPkg = fs.existsSync(pkgPath);

  if (hasPkg) {
    console.log();
    const addScripts = await confirm(
      `  ${chalk.bold('Add npm scripts to package.json?')}`,
      true,
    );

    if (addScripts) {
      const scripts = buildNpmScripts(projectConfig);
      try {
        const pkgRaw = fs.readFileSync(pkgPath, 'utf-8');
        const pkg = JSON.parse(pkgRaw);
        pkg.scripts = { ...pkg.scripts, ...scripts };
        fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
        scriptsAdded = true;
      } catch {
        log.error('Failed to update package.json');
      }
    }
  }

  // ── 7. Create input directory ────────────────────────

  const resolvedInput = path.resolve(input);
  if (!fs.existsSync(resolvedInput)) {
    console.log();
    const createDir = await confirm(
      `  ${chalk.bold(`Create ${chalk.cyan(input)} directory?`)}`,
      true,
    );
    if (createDir) {
      fs.mkdirSync(resolvedInput, { recursive: true });
    }
  }

  closePrompt();

  // ── Summary ──────────────────────────────────────────

  console.log();
  console.log(chalk.bold.green('  ✓ Project initialized!'));
  console.log();

  if (configCreated) {
    log.success(`Created ${chalk.cyan(configFile)}`);
  }
  if (scriptsAdded) {
    log.success(`Added npm scripts to ${chalk.cyan('package.json')}`);
  }
  if (!fs.existsSync(resolvedInput)) {
    // already existed
  } else {
    log.success(`Input directory: ${chalk.cyan(input)}`);
  }

  // ── Next steps ──────────────────────────────────────

  console.log();
  console.log(chalk.bold('  Next steps:'));
  console.log();

  const steps: string[] = [];

  if (!fs.existsSync(path.resolve(input, '*.svg'))) {
    steps.push(`Drop your SVG files into ${chalk.cyan(input)}`);
  }

  if (scriptsAdded) {
    if (framework === 'optimize') {
      steps.push(`Run ${chalk.cyan('npm run icons')} to optimize`);
    } else {
      steps.push(`Run ${chalk.cyan('npm run icons')} to generate components`);
      steps.push(`Run ${chalk.cyan('npm run icons:optimize')} to optimize SVGs in-place`);
    }
  } else {
    const scripts = buildNpmScripts(projectConfig);
    const mainCmd = Object.values(scripts)[0];
    steps.push(`Run ${chalk.cyan(mainCmd)}`);
  }

  for (let i = 0; i < steps.length; i++) {
    console.log(`  ${chalk.dim(`${i + 1}.`)} ${steps[i]}`);
  }

  // ── Example integration ─────────────────────────────

  console.log();
  console.log(chalk.bold('  CI/CD example (GitHub Actions):'));
  console.log();
  console.log(chalk.dim('  - name: Generate icons'));
  console.log(chalk.dim('    env:'));
  console.log(chalk.dim('      SVGFORCE_API_KEY: ${{ secrets.SVGFORCE_API_KEY }}'));

  if (framework === 'optimize') {
    console.log(chalk.dim(`    run: npx svgforce optimize ${input} -o ${output}`));
  } else {
    const nameFlag = componentName ? ` -n ${componentName}` : '';
    console.log(chalk.dim(`    run: npx svgforce ${framework} ${input} -o ${output}${nameFlag}`));
  }

  console.log();
  console.log(
    chalk.dim('  Docs: ') + chalk.underline('https://svgforce.dev/documentation'),
  );
  console.log();
}
