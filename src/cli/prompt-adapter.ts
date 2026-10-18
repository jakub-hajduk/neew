import { confirm, isCancel, multiselect, password, select, text } from '@clack/prompts';
import { PromptCancelledError, type PromptChoice } from '@trut/gen';
import type { PromptAdapter } from '@trut/gen/runtime';

function unwrap<T>(value: T | symbol): T {
  if (isCancel(value)) throw new PromptCancelledError();
  return value as T;
}

function toValidate(
  validate: ((value: string) => boolean | string) | undefined,
): ((value: string | undefined) => string | undefined) | undefined {
  if (!validate) return undefined;
  return (value) => {
    if (value === undefined) return undefined;
    const result = validate(value);
    if (result === true) return undefined;
    if (result === false) return 'Invalid value';
    return result;
  };
}

function mapOptions(choices: PromptChoice[]) {
  return choices.map((choice) => ({
    value: choice.value,
    label: choice.label ?? choice.value,
    ...(choice.hint ? { hint: choice.hint } : {}),
  }));
}

export function createClackAdapter(interactive?: boolean): PromptAdapter {
  return {
    interactive: interactive ?? Boolean(process.stdin.isTTY && process.stdout.isTTY),
    async selectGenerator(choices) {
      return unwrap<string>(
        await select({
          message: 'Select a generator',
          options: choices.map((choice) => ({
            value: choice.name,
            label: choice.name,
            ...(choice.description ? { hint: choice.description } : {}),
          })),
        }),
      );
    },
    async text(options) {
      return unwrap<string>(
        await text({
          message: options.message,
          placeholder: options.placeholder,
          initialValue: options.default,
          validate: toValidate(options.validate),
        }),
      );
    },
    async password(options) {
      return unwrap<string>(await password({ message: options.message }));
    },
    async number(options) {
      const value = await text({
        message: options.message,
        initialValue: options.default === undefined ? undefined : String(options.default),
        validate: (input) => {
          const raw = input ?? '';
          if (raw.trim() === '' || Number.isNaN(Number(raw))) return 'Enter a number';
          const parsed = Number(raw);
          if (options.min !== undefined && parsed < options.min) {
            return `Must be at least ${options.min}`;
          }
          if (options.max !== undefined && parsed > options.max) {
            return `Must be at most ${options.max}`;
          }
        },
      });
      return Number(unwrap<string>(value));
    },
    async confirm(options) {
      return unwrap<boolean>(
        await confirm({ message: options.message, initialValue: options.default }),
      );
    },
    async select(options) {
      return unwrap<string>(
        await select({
          message: options.message,
          options: mapOptions(options.options),
          initialValue: options.default,
        }),
      );
    },
    async multiselect(options) {
      return unwrap<string[]>(
        await multiselect({
          message: options.message,
          options: mapOptions(options.options),
          initialValues: options.default,
          required: (options.min ?? 0) > 0,
        }),
      );
    },
  };
}
