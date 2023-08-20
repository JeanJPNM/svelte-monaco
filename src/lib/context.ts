import { getContext, setContext } from 'svelte';
import type { Readable } from 'svelte/store';
import type { Monaco } from './types';

const contextKey = Symbol('svelte-monaco-editor key');

export interface MonacoEditorContext {
  monaco: Readable<Monaco | null>;
}

export function setMonacoEditorContext(context: MonacoEditorContext) {
  setContext(contextKey, context);
}

export function getMonacoEditorContext(): MonacoEditorContext {
  const context = getContext<MonacoEditorContext | undefined>(contextKey);
  if (!context)
    throw new Error(
      'You must provide a monaco instance by calling setMonacoEditorContext in the parent component'
    );
  return context;
}
