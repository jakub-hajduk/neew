import { addTemplates, defineGenerator, text } from '@trut/gen';

export default defineGenerator({
  name: 'component',
  description: 'Create a component',
  basePath: 'src',
  prompts: {
    name: text({ message: 'Component name', placeholder: 'UserProfile' }),
  },
  actions: [
    addTemplates({
      from: 'templates/component',
      to: 'components/<%= it.format.kebabCase(it.answers.name) %>',
    }),
  ],
});
