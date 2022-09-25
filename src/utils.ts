import type { Monaco } from '$lib/types';
import { writable, type Writable } from 'svelte/store';

export function writablePrevious<T>(init: T): Writable<T> {
	const previous = writable(init);
	let next = init;

	return {
		subscribe: previous.subscribe,
		set(value) {
			previous.set(next);
			next = value;
		},
		update(updater) {
			previous.set(next);
			next = updater(next);
		}
	};
}

export function getOrCreateModel(
	monaco: Monaco,
	value: string,
	language: string | undefined,
	path?: string
) {
	return getModel(monaco, path) || createModel(monaco, value, language, path);
}

export function getModel(monaco: Monaco, path: string) {
	return monaco.editor.getModel(createModelUri(monaco, path));
}

export function createModel(monaco: Monaco, value: string, language?: string, path?: string) {
	let uri;
	if (path !== undefined) uri = createModelUri(monaco, path);
	return monaco.editor.createModel(value, language, uri);
}

export function createModelUri(monaco: Monaco, path: string) {
	return monaco.Uri.parse(path);
}
