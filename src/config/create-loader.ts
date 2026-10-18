import { fileURLToPath } from 'node:url';
import { createJiti, type Jiti } from 'jiti';

const FRAMEWORK_SPECIFIERS = ['@trut/gen', '@trut/gen/runtime', '@trut/neew'];

function resolveSpecifier(specifier: string): string | undefined {
  try {
    const url = import.meta.resolve(specifier);
    return url.startsWith('file:') ? fileURLToPath(url) : url;
  } catch {
    return undefined;
  }
}

export function createRepositoryJiti(baseDir: string): Jiti {
  const alias: Record<string, string> = {};
  for (const specifier of FRAMEWORK_SPECIFIERS) {
    const resolved = resolveSpecifier(specifier);
    if (resolved) alias[specifier] = resolved;
  }
  return createJiti(baseDir, {
    interopDefault: true,
    alias,
    moduleCache: false,
    fsCache: false,
  });
}
