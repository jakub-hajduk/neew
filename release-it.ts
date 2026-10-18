import type { Config } from 'release-it';

export default {
  hooks: {
    'before:init': ['pnpm build', 'pnpm check', 'pnpm test'],
    'after:bump': ['pnpm build']
  },
  git: {
    commit: true,
    tag: true,
    push: true,
    commitMessage: 'chore: release ${version}',
  },
  github: {
    release: true
  },
  npm: {
    publish: true,
    publishPackageManager: 'pnpm'
  }
} satisfies Config;
