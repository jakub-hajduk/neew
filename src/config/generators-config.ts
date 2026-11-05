import type { ActionHandlerRegistry } from '@trut/gen';

export interface GeneratorRuntimeConfig {
  handlers?: string;
}

export interface GeneratorsConfig {
  generators: string[];
  runtime?: GeneratorRuntimeConfig;
}

export function defineGenerators<const TConfig extends GeneratorsConfig>(config: TConfig): TConfig {
  return config;
}

export type RuntimeHandlers = Partial<ActionHandlerRegistry>;

export function defineRuntimeHandlers<const THandlers extends RuntimeHandlers>(
  handlers: THandlers,
): THandlers {
  return handlers;
}
