<script lang="ts" context="module">
	export interface DiffEditorMountEvent {
		editor: monaco.editor.IStandaloneDiffEditor;
		monaco: Monaco;
	}

	export interface DiffEditorChangeEvent {
		text: string;
		source: monaco.editor.IModelContentChangedEvent;
	}

	interface EventMap {
		mount: DiffEditorMountEvent;
		originalChange: DiffEditorChangeEvent;
		modifiedChange: DiffEditorChangeEvent;
	}

	type Options = monaco.editor.IDiffEditorConstructionOptions;
</script>

<script lang="ts">
	import type * as monaco from 'monaco-editor';
	import { createEventDispatcher, onDestroy } from 'svelte';
	import type { Monaco } from './types';
	import { getOrCreateModel, setEditorValue, writablePrevious } from '../utils';
	import { multiModeStore } from '../stores/multi_mode';
	import { useMonaco } from './use_monaco';

	export let original = '';
	export let modified = '';

	export let language: string | undefined = undefined;

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

	let container: HTMLDivElement | undefined;

	const monaco = useMonaco();
	let editor: monaco.editor.IStandaloneDiffEditor;

	let isEditorReady = false;

	onDestroy(() => {
		if (editor) disposeEditor();
	});

	const previousPath = writablePrevious(originalModelPath);
	$: $previousPath = originalModelPath;

	const originalValueStore = multiModeStore(original, {
		internal(next) {
			original = next;
		},
		external(next) {
			if (!$monaco) return;
			const originalEditor = editor.getOriginalEditor();
			setEditorValue($monaco, originalEditor, next);
		}
	});

	const modifiedValueStore = multiModeStore(modified, {
		internal(next) {
			modified = next;
		},
		external(next) {
			if (!$monaco) return;
			const modifiedEditor = editor.getModifiedEditor();
			setEditorValue($monaco, modifiedEditor, next);
		}
	});

	let originalTextSubscription: monaco.IDisposable | undefined;
	let modifiedTextSubscription: monaco.IDisposable | undefined;

	$: if (isEditorReady) originalValueStore.set('external', original);
	$: if (isEditorReady) modifiedValueStore.set('external', modified);
	$: if (isEditorReady) syncOptions(options);
	$: if (isEditorReady) syncLanguage(language, originalLanguage, modifiedLanguage);
	$: if (isEditorReady) syncTheme(theme);
	$: if (!isEditorReady && $monaco && container) createEditor($monaco, container);

	function syncOptions(...deps: unknown[]) {
		editor.updateOptions(options);
	}

	function syncLanguage(...deps: unknown[]) {
		if (!$monaco) return;
		const { original, modified } = editor.getModel()!;

		$monaco.editor.setModelLanguage(original, originalLanguage || language || 'text');
		$monaco.editor.setModelLanguage(modified, modifiedLanguage || language || 'text');
	}

	function syncTheme(...deps: unknown[]) {
		$monaco?.editor.setTheme(theme);
	}

	function createEditor(monaco: Monaco, container: HTMLElement) {
		editor = monaco.editor.createDiffEditor(container, {
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
		monaco.editor.setTheme(theme);

		originalTextSubscription = originalModel.onDidChangeContent((e) => {
			const text = originalModel.getValue();

			if (original === text) return;

			originalValueStore.set('internal', text);

			dispatch('originalChange', {
				text,
				source: e
			});
		});

		modifiedTextSubscription = modifiedModel.onDidChangeContent((e) => {
			const text = modifiedModel.getValue();

			if (modified === text) return;

			modifiedValueStore.set('internal', text);

			dispatch('modifiedChange', {
				text,
				source: e
			});
		});

		isEditorReady = true;

		dispatch('mount', {
			editor,
			monaco
		});
	}

	function disposeEditor() {
		const { original, modified } = editor.getModel()!;

		originalTextSubscription?.dispose();
		modifiedTextSubscription?.dispose();

		if (!keepCurrentOriginalModel) {
			original?.dispose();
		}

		if (!keepCurrentModifiedModel) {
			modified?.dispose();
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
