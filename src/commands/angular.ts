import path from 'node:path';
import chalk from 'chalk';
import ora from 'ora';
import { apiRequest } from '../lib/api.js';
import { resolveSvgFiles, writeOutput } from '../lib/files.js';
import { log } from '../lib/logger.js';

export interface AngularOptions {
  output: string;
  name: string;
  selector?: string;
  opacity: boolean;
  dryRun: boolean;
  json: boolean;
}

interface ConvertResponse {
  code: string;
  usage: { used: number; limit: number; remaining: number };
  meta: { generated: number; billed: number; isTrial: boolean; generationId: string | null };
}

export async function angularCommand(patterns: string[], opts: AngularOptions): Promise<void> {
  const files = await resolveSvgFiles(patterns);

  if (opts.dryRun) {
    log.info(`Would generate Angular component from ${chalk.bold(files.length)} SVG file(s):`);
    for (const f of files) {
      log.dim(`  ${f.name} <- ${f.absolutePath}`);
    }
    return;
  }

  const spinner = ora(`Generating Angular component from ${files.length} SVG(s)...`).start();

  const icons = files.map((f) => ({ name: f.name, svg: f.svg }));

  const result = await apiRequest<ConvertResponse>('/convert/angular-component', {
    method: 'POST',
    body: {
      componentName: opts.name,
      selector: opts.selector,
      icons,
      withOpacityProp: opts.opacity,
      confirmLoseTrial: false,
    },
  });

  spinner.stop();

  const outputFile = path.join(opts.output, `${opts.name.toLowerCase()}.component.ts`);
  writeOutput(outputFile, result.code);

  if (opts.json) {
    console.log(JSON.stringify({
      output: outputFile,
      icons: result.meta.generated,
      billed: result.meta.billed,
      usage: result.usage,
    }));
    return;
  }

  log.success(`Generated ${chalk.bold(result.meta.generated)} icon(s) -> ${chalk.underline(outputFile)}`);
  if (result.meta.billed > 0) {
    log.dim(`  Billed: ${result.meta.billed} | Remaining: ${result.usage.remaining}/${result.usage.limit}`);
  }
}
