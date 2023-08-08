<script lang="ts" context="module">
  export interface DiffEditorReadyDetail {
    editor: Editor;
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

  type Options = monaco.editor.IDiffEditorConstructionOptions;
  type Editor = monaco.editor.IStandaloneDiffEditor;
</script>

<script lang="ts">
  import type * as monaco from 'monaco-editor';
  import { createEventDispatcher } from 'svelte';
  import type { Monaco } from './types.js';
  import { getOrCreateModel, setEditorValue } from './utils.js';
  import { multiModeStore, writablePrevious } from './stores.js';
  import { useMonaco } from './use_monaco.js';
  import { derived, writable, type Subscriber } from 'svelte/store';

  export let original = '';
  export let modified = '';

  export let language = 'text';

  export let originalLanguage: string | undefined = undefined;
  export let modifiedLanguage: string | undefined = undefined;

  export let originalModelPath: string | undefined = undefined;
  export let modifiedModelPath: string | undefined = undefined;

  export let theme = 'light';
  export let options: Options = {};
  export let keepCurrentOriginalModel = false;
  export let keepCurrentModifiedModel = false;
  export let width = '100%';
  export let height = '100%';
  let className = '';
  export { className as class };
  export let wrapperProps: object = {};

  const dispatch = createEventDispatcher<EventMap>();

  const container = writable<HTMLElement | null>(null);

  const monaco = useMonaco();

  const editor = derived(
    [monaco, container],
    ([monaco, container], set: Subscriber<Editor>) => {
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

  const previousPath = writablePrevious(originalModelPath);
  $: $previousPath = originalModelPath;

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

  $: if ($monaco) syncTheme($monaco, theme);
  $: if ($editor) originalValueStore.set('external', original);
  $: if ($editor) modifiedValueStore.set('external', modified);
  $: if ($editor) syncOptions(options);
  $: if ($editor) syncLanguage(language, originalLanguage, modifiedLanguage);
  $: if ($editor) syncOriginalPath(originalModelPath);
  $: if ($editor) syncModifiedPath(modifiedModelPath);

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
    if (!$monaco) return;
    const originalEditor = $editor.getOriginalEditor();
    const model = getOrCreateModel(
      $monaco,
      original,
      originalLanguage || language,
      originalModelPath
    );

    if (model === originalEditor.getModel()) return;
    originalEditor.setModel(model);
  }

  function syncModifiedPath(...deps: unknown[]) {
    if (!$monaco) return;
    const modifiedEditor = $editor.getModifiedEditor();
    const model = getOrCreateModel(
      $monaco,
      modified,
      modifiedLanguage || language,
      modifiedModelPath
    );

    if (model === modifiedEditor.getModel()) return;
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
      originalModelPath
    );

    const modifiedModel = getOrCreateModel(
      monaco,
      modified,
      modifiedLanguage || language,
      modifiedModelPath
    );

    editor.setModel({ original: originalModel, modified: modifiedModel });

    return editor;
  }

  function attachEventListeners(editor: Editor) {
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

  function disposeEditor(editor: Editor, subscriptions: monaco.IDisposable[]) {
    const { original, modified } = editor.getModel()!;

    for (const subscription of subscriptions) {
      subscription.dispose();
    }

    if (!keepCurrentOriginalModel) {
      original?.dispose();
    }

    if (!keepCurrentModifiedModel) {
      modified?.dispose();
    }

    editor.dispose();
  }
</script>

{#if !$editor}
  <slot name="loading">Loading...</slot>
{/if}

<section class="wrapper" {...wrapperProps} style:width style:height>
  <div bind:this={$container} class="{className} container" />
</section>

<style>
  .wrapper {
    display: flex;
    position: relative;
    text-align: initial;
  }
  .container {
    width: 100%;
  }
</style>
