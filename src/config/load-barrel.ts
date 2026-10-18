import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Jiti } from 'jiti';
import { createRepositoryJiti } from './create-loader';
import type { GeneratorsConfig } from './generators-config';

export const BARREL_FILENAME = 'generators.ts';

export interface LoadedBarrel {
  config: GeneratorsConfig;
  path: string;
  dir: string;
}

function pickConfig(moduleExports: unknown): unknown {
  if (moduleExports && typeof moduleExports === 'object') {
    const record = moduleExports as Record<string, unknown>;
    if (Array.isArray(record.generators)) return moduleExports;
    if (record.default && typeof record.default === 'object') {
      const fallback = record.default as Record<string, unknown>;
      if (Array.isArray(fallback.generators)) return fallback;
    }
  }
  return moduleExports;
}

export interface LoadBarrelOptions {
  jiti?: Jiti;
}

export async function loadBarrel(
  dir: string,
  options: LoadBarrelOptions = {},
): Promise<LoadedBarrel> {
  const path = join(dir, BARREL_FILENAME);
  if (!existsSync(path)) {
    throw new Error(
      `Repository contract violated: no ${BARREL_FILENAME} found at ${dir}. ` +
        `Every generator repository must provide a root ${BARREL_FILENAME} exporting a "generators" array.`,
    );
  }
  const jiti = options.jiti ?? createRepositoryJiti(path);
  let moduleExports: unknown;
  try {
    moduleExports = await jiti.import(path);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to load ${BARREL_FILENAME} at ${path}: ${message}`);
  }
  const config = pickConfig(moduleExports) as GeneratorsConfig | undefined;
  if (!config || !Array.isArray(config.generators)) {
    throw new Error(
      `Invalid ${BARREL_FILENAME} at ${path}: expected a default export whose "generators" is an array of glob patterns (strings).`,
    );
  }
  const invalid = config.generators.find((entry) => typeof entry !== 'string');
  if (invalid !== undefined) {
    throw new Error(
      `Invalid ${BARREL_FILENAME} at ${path}: "generators" must be an array of glob patterns (strings).`,
    );
  }
  return { config, path, dir };
}
