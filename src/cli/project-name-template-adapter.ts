import { basename, extname } from 'node:path';
import {
  etaTemplateAdapter,
  type TemplateAdapter,
  type TemplateRenderData,
} from '@trut/gen/runtime';

const TEXT_EXTENSIONS = new Set([
  '.css',
  '.csv',
  '.env',
  '.html',
  '.htm',
  '.ini',
  '.js',
  '.jsx',
  '.json',
  '.jsonc',
  '.md',
  '.mdx',
  '.mjs',
  '.cjs',
  '.ts',
  '.tsx',
  '.mts',
  '.cts',
  '.toml',
  '.txt',
  '.vue',
  '.xml',
  '.yaml',
  '.yml',
  '.scss',
  '.sass',
  '.less',
  '.svg',
  '.sh',
  '.zsh',
]);

const TEXT_FILENAMES = new Set([
  'Dockerfile',
  'Makefile',
  '.gitignore',
  '.npmrc',
  '.prettierrc',
  '.eslintrc',
]);

const FORMATTERS = [
  'capitalCase',
  'sentenceCase',
  'pascalCase',
  'camelCase',
  'kebabCase',
  'snakeCase',
  'constantCase',
] as const;

export function isProjectTextTemplate(templatePath: string): boolean {
  const filename = basename(templatePath);
  return TEXT_FILENAMES.has(filename) || TEXT_EXTENSIONS.has(extname(filename));
}

function replacementPairs(source: string, target: string, format: TemplateRenderData['format']) {
  return [...new Map(FORMATTERS.map((name) => [format[name](source), format[name](target)]))]
    .sort(([left], [right]) => right.length - left.length)
    .filter(([from]) => from.length > 0);
}

export function createProjectNameTemplateAdapter(sourceProjectName: string): TemplateAdapter {
  return {
    render(template, data) {
      const { answers, format } = data as TemplateRenderData;
      const targetProjectName = answers.projectName;
      if (typeof targetProjectName !== 'string' || targetProjectName.trim() === '') {
        throw new Error('Project-name rendering requires a non-empty "projectName" answer.');
      }

      const pairs = replacementPairs(sourceProjectName, targetProjectName, format);
      const etaRendered = etaTemplateAdapter.render(template, data);
      const rendered = pairs.reduce(
        (contents, [from, to]) => contents.replaceAll(from, to),
        etaRendered,
      );

      if (sourceProjectName !== targetProjectName) {
        const remaining = pairs.find(
          ([from, to]) => from !== to && !to.includes(from) && rendered.includes(from),
        );
        if (remaining) {
          throw new Error(
            `Project-name rendering left the source identity "${remaining[0]}" unchanged.`,
          );
        }
      }

      return rendered;
    },
    resolveOutputPath(templatePath) {
      return isProjectTextTemplate(templatePath) ? templatePath : undefined;
    },
  };
}
