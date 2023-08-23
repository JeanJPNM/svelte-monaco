<script lang="ts" context="module">
  export interface DiffEditorReadyDetail {
    editor: DiffCodeEditor;
    monaco: Monaco;
  }

  export interface DiffEditorChangeDetail {
    text: string;
    source: monaco.editor.IModelContentChangedEvent;
  }

  export type DiffEditorReadyEvent = CustomEvent<DiffEditorReadyDetail>;
  export type DiffEditorChangeEvent = CustomEvent<DiffEditorChangeDetail>;

  interface EventMap {
    ready: DiffEditorReadyDetail;
    originalChange: DiffEditorChangeDetail;
    modifiedChange: DiffEditorChangeDetail;
  }

  type EditorOptions = monaco.editor.IDiffEditorConstructionOptions;
  type DiffCodeEditor = monaco.editor.IStandaloneDiffEditor;
</script>

<script lang="ts">
  import type * as monaco from 'monaco-editor';
  import { createEventDispatcher } from 'svelte';
  import type { Monaco, ThemeName } from './types.js';
  import { getOrCreateModel, setEditorValue } from './utils.js';
  import { multiModeStore, writablePrevious } from './stores.js';
  import { derived, writable, type Subscriber } from 'svelte/store';
  import { getMonacoEditorContext } from './context.js';
  import { modelTracker } from './model_tracker.js';

  export let original = '';
  export let modified = '';

  export let language = 'text';

  export let originalLanguage: string | undefined = undefined;
  export let modifiedLanguage: string | undefined = undefined;

  export let originalPath: string | undefined = undefined;
  export let modifiedPath: string | undefined = undefined;

  export let theme: ThemeName | undefined = undefined;
  export let options: EditorOptions = {};
  export let keepCurrentOriginalModel = false;
  export let keepCurrentModifiedModel = false;
  let className = '';
  export { className as class };

  const usedModels = modelTracker();

  const dispatch = createEventDispatcher<EventMap>();

  const container = writable<HTMLElement | null>(null);

  const { monaco } = getMonacoEditorContext();

  const editor = derived(
    [monaco, container],
    ([monaco, container], set: Subscriber<DiffCodeEditor>) => {
      if (!monaco || !container) return;

      const editor = createEditor(monaco, container);
      const subscriptions = attachEventListeners(editor);

      set(editor);
      dispatch('ready', {
        editor,
        monaco
      });

      return () => disposeEditor(editor, subscriptions);
    }
  );

  const previousOriginalPath = writablePrevious(originalPath);
  $: $previousOriginalPath = originalPath;

  const previousModifiedPath = writablePrevious(modifiedPath);
  $: $previousModifiedPath = modifiedPath;

  const originalValueStore = multiModeStore(original, {
    internal(next) {
      original = next;
    },
    external(next) {
      if (!$monaco) return;
      const originalEditor = $editor.getOriginalEditor();
      setEditorValue($monaco, originalEditor, next);
    }
  });

  const modifiedValueStore = multiModeStore(modified, {
    internal(next) {
      modified = next;
    },
    external(next) {
      if (!$monaco) return;
      const modifiedEditor = $editor.getModifiedEditor();
      setEditorValue($monaco, modifiedEditor, next);
    }
  });

  $: if ($monaco && theme) syncTheme($monaco, theme);
  $: if ($editor) syncOptions(options);
  $: if ($editor) syncLanguage(language, originalLanguage, modifiedLanguage);
  $: if ($editor) syncOriginalPath(originalPath);
  $: if ($editor) syncModifiedPath(modifiedPath);
  $: if ($editor) originalValueStore.set('external', original);
  $: if ($editor) modifiedValueStore.set('external', modified);

  function syncOptions(...deps: unknown[]) {
    $editor.updateOptions(options);
  }

  function syncLanguage(...deps: unknown[]) {
    if (!$monaco) return;
    const { original, modified } = $editor.getModel()!;

    $monaco.editor.setModelLanguage(original, originalLanguage || language);
    $monaco.editor.setModelLanguage(modified, modifiedLanguage || language);
  }

  function syncTheme(monaco: Monaco, theme: string) {
    monaco.editor.setTheme(theme);
  }

  function syncOriginalPath(...deps: unknown[]) {
    if (!$monaco || $previousOriginalPath === originalPath) return;
    const originalEditor = $editor.getOriginalEditor();
    const model = getOrCreateModel(
      $monaco,
      original,
      originalLanguage || language,
      originalPath
    );

    if (model === originalEditor.getModel()) return;
    usedModels.add(model);
    originalEditor.setModel(model);
  }

  function syncModifiedPath(...deps: unknown[]) {
    if (!$monaco || $previousModifiedPath === modifiedPath) return;
    const modifiedEditor = $editor.getModifiedEditor();
    const model = getOrCreateModel(
      $monaco,
      modified,
      modifiedLanguage || language,
      modifiedPath
    );

    if (model === modifiedEditor.getModel()) return;
    usedModels.add(model);
    modifiedEditor.setModel(model);
  }

  function createEditor(monaco: Monaco, container: HTMLElement) {
    const editor = monaco.editor.createDiffEditor(container, {
      automaticLayout: true,
      ...options
    });

    const originalModel = getOrCreateModel(
      monaco,
      original,
      originalLanguage || language,
      originalPath
    );

    const modifiedModel = getOrCreateModel(
      monaco,
      modified,
      modifiedLanguage || language,
      modifiedPath
    );

    usedModels.add(originalModel);
    usedModels.add(modifiedModel);

    editor.setModel({ original: originalModel, modified: modifiedModel });

    return editor;
  }

  function attachEventListeners(editor: DiffCodeEditor) {
    const { modified: modifiedModel, original: originalModel } =
      editor.getModel()!;

    const originalTextSubscription = originalModel.onDidChangeContent((e) => {
      const text = originalModel.getValue();

      if (original === text) return;

      originalValueStore.set('internal', text);

      dispatch('originalChange', {
        text,
        source: e
      });
    });

    const modifiedTextSubscription = modifiedModel.onDidChangeContent((e) => {
      const text = modifiedModel.getValue();

      if (modified === text) return;

      modifiedValueStore.set('internal', text);

      dispatch('modifiedChange', {
        text,
        source: e
      });
    });
    return [originalTextSubscription, modifiedTextSubscription];
  }

  function disposeEditor(
    editor: DiffCodeEditor,
    subscriptions: monaco.IDisposable[]
  ) {
    const { original, modified } = editor.getModel()!;

    for (const subscription of subscriptions) {
      subscription.dispose();
    }

    if (keepCurrentOriginalModel) {
      usedModels.addKeepAlive(original);
    }

    if (keepCurrentModifiedModel) {
      usedModels.addKeepAlive(modified);
    }

    usedModels.dispose();
    editor.dispose();
  }
</script>

{#if !$editor}
  <slot name="loading">Loading...</slot>
{/if}

<div bind:this={$container} class="container {className} " />

<style>
  .container {
    width: var(--svelte-monaco-width, 100%);
    height: var(--svelte-monaco-height, 100%);
  }
</style>
