import path from 'node:path';
import chalk from 'chalk';
import ora from 'ora';
import { apiRequest } from '../lib/api.js';
import { resolveSvgFiles, writeOutput } from '../lib/files.js';
import { log } from '../lib/logger.js';

export interface ReactNativeOptions {
  output: string;
  name: string;
  opacity: boolean;
  dryRun: boolean;
  json: boolean;
}

interface ConvertResponse {
  code: string;
  usage: { used: number; limit: number; remaining: number };
  meta: { generated: number; billed: number; isTrial: boolean; generationId: string | null };
}

export async function reactNativeCommand(patterns: string[], opts: ReactNativeOptions): Promise<void> {
  const files = await resolveSvgFiles(patterns);

  if (opts.dryRun) {
    log.info(`Would generate React Native component from ${chalk.bold(files.length)} SVG file(s):`);
    for (const f of files) {
      log.dim(`  ${f.name} <- ${f.absolutePath}`);
    }
    return;
  }

  const spinner = ora(`Generating React Native component from ${files.length} SVG(s)...`).start();

  const icons = files.map((f) => ({ name: f.name, svg: f.svg }));

  const result = await apiRequest<ConvertResponse>('/convert/react-native-component', {
    method: 'POST',
    body: {
      componentName: opts.name,
      icons,
      withOpacityProp: opts.opacity,
      confirmLoseTrial: false,
    },
  });

  spinner.stop();

  const outputFile = path.join(opts.output, `${opts.name}.tsx`);
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
