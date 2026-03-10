import fs from 'node:fs';
import path from 'node:path';

export interface ProjectConfig {
  framework: 'react' | 'react-native' | 'angular' | 'optimize';
  input: string;
  output: string;
  componentName?: string;
  selector?: string;
  opacity?: boolean;
}

const CONFIG_FILENAME = 'svgforce.config.json';

export function findProjectConfig(cwd = process.cwd()): ProjectConfig | null {
  const configPath = path.join(cwd, CONFIG_FILENAME);
  if (!fs.existsSync(configPath)) return null;

  try {
    const raw = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(raw) as ProjectConfig;
  } catch {
    return null;
  }
}

export function writeProjectConfig(config: ProjectConfig, cwd = process.cwd()): string {
  const configPath = path.join(cwd, CONFIG_FILENAME);
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
  return configPath;
}

export function getConfigFilename(): string {
  return CONFIG_FILENAME;
}
