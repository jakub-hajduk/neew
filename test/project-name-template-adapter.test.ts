import test from 'node:test';
import assert from 'node:assert/strict';
import { formatters } from '@trut/gen/runtime';
import {
  createProjectNameTemplateAdapter,
  isProjectTextTemplate,
} from '../src/cli/project-name-template-adapter';

test('project-name adapter renders identity forms in supported text files', () => {
  const adapter = createProjectNameTemplateAdapter('Template Name');
  const result = adapter.render(
    'Template Name\nTemplate name\nTemplateName\ntemplateName\ntemplate-name\ntemplate_name\nTEMPLATE_NAME\n',
    { answers: { projectName: 'My App' }, format: formatters },
  );

  assert.equal(result, 'My App\nMy app\nMyApp\nmyApp\nmy-app\nmy_app\nMY_APP\n');
  assert.equal(adapter.resolveOutputPath('README.md'), 'README.md');
  assert.equal(adapter.resolveOutputPath('logo.png'), undefined);
});

test('project-name adapter recognizes the supported text-file allowlist', () => {
  assert.equal(isProjectTextTemplate('src/app.tsx'), true);
  assert.equal(isProjectTextTemplate('docs/README.md'), true);
  assert.equal(isProjectTextTemplate('Dockerfile'), true);
  assert.equal(isProjectTextTemplate('.gitignore'), true);
  assert.equal(isProjectTextTemplate('assets/logo.png'), false);
});

test('project-name adapter requires a non-empty projectName answer', () => {
  const adapter = createProjectNameTemplateAdapter('Template Name');
  assert.throws(
    () => adapter.render('Template Name', { answers: {}, format: formatters }),
    /requires a non-empty "projectName" answer/,
  );
});
