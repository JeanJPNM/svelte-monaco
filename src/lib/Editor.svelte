<script context="module" lang="ts">
	/** Happens when the content of the underlying editor changes*/
	export interface EditorChangeEvent {
		text: string;
		source: monaco.editor.IModelContentChangedEvent;
	}

	export interface EditorValidateEvent {
		markers: monaco.editor.IMarker[];
	}

	/** Happens when the monaco editor is loaded and the editor is configured*/
	export interface EditorMountEvent {
		editor: monaco.editor.IStandaloneCodeEditor;
		monaco: Monaco;
	}

	interface EventMap {
		change: EditorChangeEvent;
		validate: EditorValidateEvent;
		mount: EditorMountEvent;
	}

	type Options = monaco.editor.IStandaloneEditorConstructionOptions;

	const viewStates = new Map<string | undefined, monaco.editor.ICodeEditorViewState | null>();
</script>

<script lang="ts">
	import type * as monaco from 'monaco-editor';
	import { createEventDispatcher, onDestroy } from 'svelte';
	import type { Monaco } from './types';
	import { getOrCreateModel, setEditorValue, writablePrevious } from '../utils';
	import { multiModeStore } from '../stores/multi_mode';
	import { useMonaco } from './use_monaco';

	export let value = '';
	export let language: string;
	export let path: string | undefined = undefined;
	export let theme = 'light';
	export let line: number | undefined = undefined;
	export let options: Options = {};
	export let overrideServices: monaco.editor.IEditorOverrideServices = {};
	export let saveViewState = true;
	export let keepCurrentModel = false;
	export let width = '100%';
	export let height = '100%';
	let className = '';
	export { className as class };
	export let wrapperProps: object = {};

	const dispatch = createEventDispatcher<EventMap>();

	let container: HTMLDivElement | undefined;

	const monaco = useMonaco();

	let editor: monaco.editor.IStandaloneCodeEditor;
	let modelContentSubscription: monaco.IDisposable | undefined;
	let markerSubscription: monaco.IDisposable | undefined;

	let isEditorReady = false;
	const previousPath = writablePrevious(path);
	$: $previousPath = path;

	const valueStore = multiModeStore(value, {
		internal(next) {
			value = next;
		},
		external(next) {
			if (!$monaco) return;
			setEditorValue($monaco, editor, next);
		}
	});

	onDestroy(() => {
		if (editor) disposeEditor();
	});

	$: if (isEditorReady) syncPath($previousPath);
	$: if (isEditorReady) syncOptions(options);
	$: if (isEditorReady) syncLanguage(language);
	$: if (isEditorReady) syncLine(line);
	$: if (isEditorReady) syncTheme(theme);
	$: if (isEditorReady) valueStore.set('external', value);
	$: if (!isEditorReady && $monaco && container) createEditor($monaco, container);

	function syncPath(...deps: unknown[]) {
		if (!$monaco) return;
		const model = getOrCreateModel($monaco, value, language, $previousPath);

		if (model === editor.getModel()) return;

		if (saveViewState) viewStates.set($previousPath, editor.saveViewState());
		editor.setModel(model);
		if (saveViewState) editor.restoreViewState(viewStates.get(path) ?? null);
	}

	function syncOptions(...deps: unknown[]) {
		editor.updateOptions(options);
	}

	function syncLanguage(...deps: unknown[]) {
		$monaco?.editor.setModelLanguage(editor.getModel()!, language);
	}

	function syncLine(...deps: unknown[]) {
		// reason for undefined check: https://github.com/suren-atoyan/monaco-react/pull/188
		if (line !== undefined) editor.revealLine(line);
	}

	function syncTheme(...deps: unknown[]) {
		$monaco?.editor.setTheme(theme);
	}

	function createEditor(monaco: Monaco, container: HTMLElement) {
		const defaultModel = getOrCreateModel(monaco, value, language, path);

		editor = monaco.editor.create(
			container,
			{
				model: defaultModel,
				automaticLayout: true,
				...options
			},
			overrideServices
		);

		if (saveViewState) editor.restoreViewState(viewStates.get(path) ?? null);

		monaco.editor.setTheme(theme);

		modelContentSubscription = editor.onDidChangeModelContent((event) => {
			const text = editor.getValue();

			if (value === text) return;

			valueStore.set('internal', text);

			dispatch('change', {
				text,
				source: event
			});
		});

		markerSubscription = monaco.editor.onDidChangeMarkers((uris) => {
			const editorUri = editor.getModel()?.uri;

			if (!editorUri) return;
			const hasMarkerChanges = uris.find((uri) => uri.path === editorUri.path);

			if (!hasMarkerChanges) return;

			const markers = monaco.editor.getModelMarkers({ resource: editorUri });

			dispatch('validate', {
				markers
			});
		});

		isEditorReady = true;

		dispatch('mount', {
			editor,
			monaco
		});
	}
	function disposeEditor() {
		modelContentSubscription?.dispose();
		markerSubscription?.dispose();

		if (keepCurrentModel) {
			if (saveViewState) viewStates.set(path, editor.saveViewState());
		} else {
			editor.getModel()?.dispose();
		}
		editor.dispose();
	}
</script>

{#if !isEditorReady}
	<slot name="loading">Loading...</slot>
{/if}

<section class="wrapper" {...wrapperProps} style:width style:height>
	<div bind:this={container} class="{className} container" />
</section>

<slot {monaco} {editor} />

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
