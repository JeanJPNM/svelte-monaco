import type * as monaco from 'monaco-editor';

type Model = monaco.editor.ITextModel;

/** Tracks how many components depend on each model id */
const modelUsage = new Map<string, number>();

export function modelTracker() {
  const usedModels = new Set<Model>();
  const keepAlive = new Set<Model>();

  return {
    add(model: Model) {
      if (usedModels.has(model)) return;
      usedModels.add(model);
      registerModel(model);
    },
    // may need to add a `removeKeepAlive`
    // later
    addKeepAlive(model: Model) {
      keepAlive.add(model);
    },
    dispose() {
      for (const model of usedModels) {
        const canDispose = unregisterModel(model);
        if (!canDispose || keepAlive.has(model)) continue;
        model.dispose();
      }
    }
  };
}

/**
 * Increments the model's usage count if it is not present in `usedModels`
 */
function registerModel(model: Model) {
  const count = modelUsage.get(model.id) ?? 0;
  modelUsage.set(model.id, count + 1);
}

/**
 * Decrements the model's usage count and
 * returns wether the model can be disposed.
 */
function unregisterModel(model: Model) {
  const count = modelUsage.get(model.id) ?? 0;

  if (count > 1) {
    modelUsage.set(model.id, count - 1);
    return false;
  }

  modelUsage.delete(model.id);
  return true;
}
