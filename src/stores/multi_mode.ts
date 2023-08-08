import { get, writable, type Updater } from 'svelte/store';

export function multiModeStore<
  T,
  Handlers extends Record<string, (value: T) => void>
>(value: T, handlers: Handlers) {
  const store = writable(value);

  return {
    subscribe: store.subscribe,
    update(kind: keyof Handlers, updater: Updater<T>) {
      const prev = get(store);
      store.update(updater);
      const next = get(store);
      if (prev === next) return;

      handlers[kind](next);
    },

    set(kind: keyof Handlers, value: T) {
      if (value === get(store)) return;
      store.set(value);
      handlers[kind](value);
    }
  };
}
