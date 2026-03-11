import fs from 'node:fs';
import path from 'node:path';
import { glob } from 'glob';
import { CliError } from './errors.js';

export interface SvgFile {
  name: string;
  svg: string;
  absolutePath: string;
}

export async function resolveSvgFiles(patterns: string[]): Promise<SvgFile[]> {
  const files: SvgFile[] = [];
  const seen = new Set<string>();

  for (const pattern of patterns) {
    const stat = fs.existsSync(pattern) ? fs.statSync(pattern) : null;

    if (stat?.isDirectory()) {
      const matches = await glob('**/*.svg', { cwd: pattern, absolute: true });
      for (const match of matches) {
        if (!seen.has(match)) {
          seen.add(match);
          files.push(readSvgFile(match));
        }
      }
    } else {
      const matches = await glob(pattern, { absolute: true });
      for (const match of matches) {
        if (match.endsWith('.svg') && !seen.has(match)) {
          seen.add(match);
          files.push(readSvgFile(match));
        }
      }
    }
  }

  if (files.length === 0) {
    throw new CliError(
      'No SVG files found matching the provided pattern(s).',
      'Provide file paths, glob patterns (icons/*.svg), or directories.',
    );
  }

  return files;
}

function readSvgFile(filePath: string): SvgFile {
  const svg = fs.readFileSync(filePath, 'utf-8');
  const name = path.basename(filePath, '.svg');
  return { name, svg, absolutePath: filePath };
}

function toPascalCase(str: string): string {
  return str
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('');
}

export function ensureOutputDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function writeOutput(filePath: string, content: string | Buffer): void {
  const dir = path.dirname(filePath);
  ensureOutputDir(dir);
  fs.writeFileSync(filePath, content);
}
