import type { Monaco } from '$lib/types.js';
import type * as monaco from 'monaco-editor';

/**
 * Sets the value of the editor and if it is not read-only,
 * resets its position to the origin.
 */
export function setEditorValue(
  monaco: Monaco,
  editor: monaco.editor.IStandaloneCodeEditor,
  value: string
) {
  if (editor.getOption(monaco.editor.EditorOption.readOnly)) {
    editor.setValue(value);
    return;
  }

  editor.executeEdits('', [
    {
      range: editor.getModel()!.getFullModelRange(),
      text: value,
      forceMoveMarkers: true
    }
  ]);

  editor.pushUndoStop();
}

export function getOrCreateModel(
  monaco: Monaco,
  value: string,
  language?: string,
  path?: string
) {
  let model: monaco.editor.ITextModel | null;
  if (path !== undefined) model = getModel(monaco, path);
  model ??= createModel(monaco, value, language, path);
  return model;
}

function getModel(monaco: Monaco, path: string) {
  return monaco.editor.getModel(createModelUri(monaco, path));
}

function createModel(
  monaco: Monaco,
  value: string,
  language?: string,
  path?: string
) {
  let uri;
  if (path !== undefined) uri = createModelUri(monaco, path);
  return monaco.editor.createModel(value, language, uri);
}

function createModelUri(monaco: Monaco, path: string) {
  return monaco.Uri.parse(path);
}
