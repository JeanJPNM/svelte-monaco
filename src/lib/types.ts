export type Monaco = typeof import('monaco-editor/esm/vs/editor/editor.api.js');

/**
 * A type that provides autocompletions for built-in monaco themes,
 * while still accepting custom theme strings.
 */
export type ThemeName =
  | 'vs'
  | 'vs-dark'
  | 'hc-black'
  | 'hc-light'
  | (string & {});
