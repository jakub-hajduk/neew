import { homedir } from 'node:os';
import { join } from 'node:path';

export type Environment = Record<string, string | undefined>;

function home(env: Environment): string {
  return env.HOME ?? env.USERPROFILE ?? homedir();
}

export function resolveConfigRoot(env: Environment = process.env): string {
  if (env.NEEW_CONFIG_DIR) return env.NEEW_CONFIG_DIR;
  if (env.XDG_CONFIG_HOME) return join(env.XDG_CONFIG_HOME, 'neew');
  if (process.platform === 'darwin') {
    return join(home(env), 'Library', 'Application Support', 'neew');
  }
  if (process.platform === 'win32') {
    return join(env.APPDATA ?? join(home(env), 'AppData', 'Roaming'), 'neew');
  }
  return join(home(env), '.config', 'neew');
}

export function resolveCacheRoot(env: Environment = process.env): string {
  if (env.NEEW_CACHE_DIR) return env.NEEW_CACHE_DIR;
  if (env.XDG_CACHE_HOME) return join(env.XDG_CACHE_HOME, 'neew');
  if (process.platform === 'darwin') {
    return join(home(env), 'Library', 'Caches', 'neew');
  }
  if (process.platform === 'win32') {
    return join(env.LOCALAPPDATA ?? join(home(env), 'AppData', 'Local'), 'neew');
  }
  return join(home(env), '.cache', 'neew');
}
