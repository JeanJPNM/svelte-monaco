import Editor from './Editor.svelte';
export default Editor;
export { default as loader } from '@monaco-editor/loader';
export type {
  EditorChangeEvent,
  EditorReadyEvent,
  EditorValidateEvent
} from './Editor.svelte';
export { default as DiffEditor } from './DiffEditor.svelte';
export type {
  DiffEditorChangeEvent,
  DiffEditorReadyEvent
} from './DiffEditor.svelte';
export type { Monaco } from './types.js';
export { useMonaco } from './use_monaco.js';
