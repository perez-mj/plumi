// src/composables/useAsyncAction.ts
import { ref } from 'vue';

export function useAsyncAction<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
) {
  const pending = ref(false);
  const error = ref<string | null>(null);

  async function run(...args: TArgs): Promise<TResult | undefined> {
    pending.value = true;
    error.value = null;
    try {
      return await fn(...args);
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Something went wrong.';
      return undefined;
    } finally {
      pending.value = false;
    }
  }

  return { pending, error, run };
}