<script context="module" lang="ts">
  /** Happens when the content of the underlying editor changes*/
  export interface EditorChangeDetail {
    text: string;
    source: monaco.editor.IModelContentChangedEvent;
  }

  export interface EditorValidateDetail {
    markers: monaco.editor.IMarker[];
  }

  /** Happens when the monaco editor is loaded and the editor is configured*/
  export interface EditorReadyDetail {
    editor: CodeEditor;
    monaco: Monaco;
  }

  export type EditorChangeEvent = CustomEvent<EditorChangeDetail>;
  export type EditorValidateEvent = CustomEvent<EditorValidateDetail>;
  export type EditorReadyEvent = CustomEvent<EditorReadyDetail>;

  interface EventMap {
    change: EditorChangeDetail;
    validate: EditorValidateDetail;
    ready: EditorReadyDetail;
  }

  type EditorOptions = monaco.editor.IStandaloneEditorConstructionOptions;
  type CodeEditor = monaco.editor.IStandaloneCodeEditor;

  const viewStates = new Map<
    string | undefined,
    monaco.editor.ICodeEditorViewState | null
  >();
</script>

<script lang="ts">
  import type * as monaco from 'monaco-editor';
  import { createEventDispatcher } from 'svelte';
  import type { Monaco } from './types.js';
  import { useMonaco } from './use_monaco.js';
  import { derived, writable, type Subscriber } from 'svelte/store';
  import { multiModeStore, writablePrevious } from './stores.js';
  import { getOrCreateModel, setEditorValue } from './utils.js';

  export let value = '';
  export let language = 'text';
  export let path: string | undefined = undefined;
  export let theme = 'light';
  export let line: number | undefined = undefined;
  export let options: EditorOptions = {};
  export let overrideServices: monaco.editor.IEditorOverrideServices = {};
  export let saveViewState = true;
  export let keepCurrentModel = false;
  let className = '';
  export { className as class };

  const dispatch = createEventDispatcher<EventMap>();

  const container = writable<HTMLElement | null>(null);

  const monaco = useMonaco();

  const editor = derived(
    [monaco, container],
    ([monaco, container], set: Subscriber<CodeEditor>) => {
      if (!monaco || !container) return;
      const editor = createEditor(monaco, container);
      const subscriptions = attachEventListeners(monaco, editor);

      set(editor);
      dispatch('ready', {
        editor,
        monaco
      });

      return () => disposeEditor(editor, subscriptions);
    }
  );

  const previousPath = writablePrevious(path);

  // using the `$store = value` form currently
  // modifies the $store variable and then runs
  // the set method, which can cause unexpected behavior
  $: previousPath.set(path);

  const valueStore = multiModeStore(value, {
    internal(next) {
      value = next;
    },
    external(next) {
      if (!$monaco) return;
      setEditorValue($monaco, $editor, next);
    }
  });

  $: if ($monaco) syncTheme($monaco, theme);
  $: if ($editor) syncPath($previousPath);
  $: if ($editor) syncOptions(options);
  $: if ($editor) syncLanguage(language);
  $: if ($editor) syncLine(line);
  $: if ($editor) valueStore.set('external', value);

  function syncPath(...deps: unknown[]) {
    if (!$monaco || $previousPath === path) return;
    const model = getOrCreateModel($monaco, value, language, path);

    if (model === $editor.getModel()) return;

    if (saveViewState) viewStates.set($previousPath, $editor.saveViewState());
    $editor.setModel(model);
    if (saveViewState) $editor.restoreViewState(viewStates.get(path) ?? null);
  }

  function syncOptions(...deps: unknown[]) {
    $editor.updateOptions(options);
  }

  function syncLanguage(...deps: unknown[]) {
    $monaco?.editor.setModelLanguage($editor.getModel()!, language);
  }

  function syncLine(...deps: unknown[]) {
    // reason for undefined check: https://github.com/suren-atoyan/monaco-react/pull/188
    if (line !== undefined) $editor.revealLine(line);
  }

  function syncTheme(monaco: Monaco, theme: string) {
    monaco.editor.setTheme(theme);
  }

  function createEditor(monaco: Monaco, container: HTMLElement) {
    const defaultModel = getOrCreateModel(monaco, value, language, path);

    const editor = monaco.editor.create(
      container,
      {
        model: defaultModel,
        automaticLayout: true,
        ...options
      },
      overrideServices
    );

    if (saveViewState) editor.restoreViewState(viewStates.get(path) ?? null);

    return editor;
  }

  function attachEventListeners(
    monaco: Monaco,
    editor: CodeEditor
  ): monaco.IDisposable[] {
    const modelContentSubscription = editor.onDidChangeModelContent((event) => {
      const text = editor.getValue();

      if (value === text) return;

      valueStore.set('internal', text);

      dispatch('change', {
        text,
        source: event
      });
    });

    const markerSubscription = monaco.editor.onDidChangeMarkers((uris) => {
      const editorUri = editor.getModel()?.uri;

      if (!editorUri) return;
      const hasMarkerChanges = uris.find((uri) => uri.path === editorUri.path);

      if (!hasMarkerChanges) return;

      const markers = monaco.editor.getModelMarkers({ resource: editorUri });

      dispatch('validate', {
        markers
      });
    });

    return [modelContentSubscription, markerSubscription];
  }

  function disposeEditor(
    editor: CodeEditor,
    subscriptions: monaco.IDisposable[]
  ) {
    for (const subscription of subscriptions) {
      subscription.dispose();
    }

    if (keepCurrentModel) {
      if (saveViewState) viewStates.set(path, editor.saveViewState());
    } else {
      editor.getModel()?.dispose();
    }
    editor.dispose();
  }
</script>

{#if !$editor}
  <slot name="loading">Loading...</slot>
{/if}

<div bind:this={$container} class="container {className}" />

<style>
  .container {
    width: var(--svelte-monaco-width);
    height: var(--svelte-monaco-height);
  }
</style>
