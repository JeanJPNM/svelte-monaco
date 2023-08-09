import { get, writable, type Updater, type Writable } from 'svelte/store';
import { safe_not_equal } from 'svelte/internal';

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
      if (!safe_not_equal(prev, next)) return;

      handlers[kind](next);
    },

    set(kind: keyof Handlers, value: T) {
      if (!safe_not_equal(value, get(store))) return;
      store.set(value);
      handlers[kind](value);
    }
  };
}

export function writablePrevious<T>(init: T): Writable<T> {
  const previous = writable(init);
  let next = init;

  return {
    subscribe: previous.subscribe,
    set(value) {
      if (!safe_not_equal(next, value)) return;
      previous.set(next);
      next = value;
    },
    update(updater) {
      const value = updater(next);
      if (!safe_not_equal(next, value)) return;
      previous.set(next);
      next = value;
    }
  };
}
