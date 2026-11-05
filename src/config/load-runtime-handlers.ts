import { isAbsolute, relative, resolve } from 'node:path';
import type { Jiti } from 'jiti';
import type { RuntimeHandlers } from './generators-config';
import { createRepositoryJiti } from './create-loader';

function isHandlerRegistry(value: unknown): value is RuntimeHandlers {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every((handler) => typeof handler === 'function')
  );
}

function pickHandlers(moduleExports: unknown): unknown {
  if (moduleExports && typeof moduleExports === 'object') {
    const record = moduleExports as Record<string, unknown>;
    if (isHandlerRegistry(record.default)) return record.default;
  }
  return moduleExports;
}

export interface LoadRuntimeHandlersOptions {
  jiti?: Jiti;
}

export async function loadRuntimeHandlers(
  repositoryDir: string,
  handlerPath: string | undefined,
  options: LoadRuntimeHandlersOptions = {},
): Promise<RuntimeHandlers | undefined> {
  if (handlerPath === undefined) return undefined;
  const modulePath = resolve(repositoryDir, handlerPath);
  const pathFromRepository = relative(repositoryDir, modulePath);
  if (
    isAbsolute(handlerPath) ||
    pathFromRepository === '..' ||
    pathFromRepository.startsWith('../')
  ) {
    throw new Error(
      `Invalid runtime handler path "${handlerPath}": it must resolve within ${repositoryDir}.`,
    );
  }

  const jiti = options.jiti ?? createRepositoryJiti(repositoryDir);
  let moduleExports: unknown;
  try {
    moduleExports = await jiti.import(modulePath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to load runtime handler module at ${modulePath}: ${message}`);
  }
  const handlers = pickHandlers(moduleExports);
  if (!isHandlerRegistry(handlers)) {
    throw new Error(
      `Invalid runtime handler module at ${modulePath}: expected a default export of a handler registry.`,
    );
  }
  return handlers;
}
