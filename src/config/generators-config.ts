export interface GeneratorsConfig {
  generators: string[];
}

export function defineGenerators<const TConfig extends GeneratorsConfig>(config: TConfig): TConfig {
  return config;
}
