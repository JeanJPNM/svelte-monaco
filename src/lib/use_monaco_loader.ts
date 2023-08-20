import type { Monaco } from '$lib/types.js';
import type monacoLoader from '@monaco-editor/loader';
import { onMount } from 'svelte';
import { writable, type Readable, get } from 'svelte/store';

export function useMonacoLoader(
  loader: typeof monacoLoader
): Readable<Monaco | null> {
  const getMonaco = loader.__getMonacoInstance;

  const store = writable(getMonaco(), (set) => {
    if (get(store)) return;

    onMount(() => {
      const monaco = getMonaco();
      if (monaco) {
        set(monaco);
        return;
      }

      const cancelable = loader.init();
      cancelable
        .then((monaco) => set(monaco))
        .catch((error) => {
          if (isCancelationError(error)) {
            console.error('Monaco initialization: error:', error);
          }
        });

      return () => cancelable.cancel();
    });
  });

  return store;
}

// the current type of the monaco loader cancellation
// error is spelled with a single "l", but checking for a different spelling
// might prevent this from breaking in the next versions
// of the loader
function isCancelationError(error: unknown) {
  if (typeof error !== 'object' || !error) return false;
  if ('type' in error) {
    return error.type === 'cancelation' || error.type === 'cancellation';
  }
  return false;
}
