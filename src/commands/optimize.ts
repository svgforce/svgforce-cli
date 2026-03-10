import path from 'node:path';
import chalk from 'chalk';
import ora from 'ora';
import { apiRequestBinary } from '../lib/api.js';
import { resolveSvgFiles, writeOutput, ensureOutputDir } from '../lib/files.js';
import { log, formatBytes } from '../lib/logger.js';

export interface OptimizeOptions {
  output: string;
  dryRun: boolean;
  json: boolean;
}

export async function optimizeCommand(patterns: string[], opts: OptimizeOptions): Promise<void> {
  const files = await resolveSvgFiles(patterns);

  if (opts.dryRun) {
    log.info(`Would optimize ${chalk.bold(files.length)} SVG file(s):`);
    for (const f of files) {
      log.dim(`  ${f.absolutePath}`);
    }
    return;
  }

  const spinner = ora(`Optimizing ${files.length} SVG file(s)...`).start();

  const icons = files.map((f) => ({ name: f.name, svg: f.svg }));

  const { buffer, filename, headers } = await apiRequestBinary('/convert/html', {
    method: 'POST',
    body: { icons },
  });

  spinner.stop();

  const savedBytes = headers.get('x-optimization-saved-bytes');
  const savedPercent = headers.get('x-optimization-saved-percent');
  const totalIcons = headers.get('x-optimization-total');

  const outputDir = opts.output;
  ensureOutputDir(outputDir);

  const outputPath = path.join(outputDir, filename);
  writeOutput(outputPath, buffer);

  if (opts.json) {
    console.log(JSON.stringify({
      output: outputPath,
      icons: Number(totalIcons ?? files.length),
      savedBytes: Number(savedBytes ?? 0),
      savedPercent: Number(savedPercent ?? 0),
      size: buffer.length,
    }));
    return;
  }

  log.success(`Optimized ${chalk.bold(totalIcons ?? files.length)} icon(s)`);
  if (savedBytes && savedPercent) {
    log.info(`Saved ${chalk.bold(formatBytes(Number(savedBytes)))} (${savedPercent}%)`);
  }
  log.info(`Output: ${chalk.underline(outputPath)}`);
}
