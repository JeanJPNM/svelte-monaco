import type { Monaco } from '$lib';
import loader from '@monaco-editor/loader';
import { onMount } from 'svelte';
import { writable, type Readable, get } from 'svelte/store';

export function useMonaco(): Readable<Monaco | null> {
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
          if (error?.type !== 'cancellation') {
            console.error('Monaco initialization: error:', error);
          }
        });

      return () => cancelable.cancel();
    });
  });

  return store;
}
