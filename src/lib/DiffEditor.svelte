<script lang="ts" context="module">
	export interface DiffEditorMountEvent {
		editor: monaco.editor.IStandaloneDiffEditor;
		monaco: Monaco;
	}

	interface EventMap {
		mount: DiffEditorMountEvent;
	}

	type Options = monaco.editor.IDiffEditorConstructionOptions;
</script>

<script lang="ts">
	import type * as monaco from 'monaco-editor';
	import loader from '@monaco-editor/loader';
	import { createEventDispatcher, onMount } from 'svelte';
	import type { Monaco } from './types';
	import { getOrCreateModel, writablePrevious } from '../utils';
	import { multiModeStore } from '../stores/multi_mode';

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

	let container: HTMLDivElement;

	let monaco: Monaco;
	let editor: monaco.editor.IStandaloneDiffEditor;

	let isEditorReady = false;
	$: isMonacoMounting = !monaco;

	onMount(() => {
		const cancellable = loader.init();

		cancellable
			.then((m) => (monaco = m))
			.catch((error) => {
				if (error?.type !== 'cancellation') {
					console.error('Monaco initialization: error:', error);
				}
			});

		return () => (editor ? disposeEditor() : cancellable.cancel());
	});

	const previousPath = writablePrevious(originalModelPath);
	$: $previousPath = originalModelPath;

	const originalValueStore = multiModeStore(original, {
		internal(next) {
			original = next;
		},
		external(next) {
			editor.getModel()!.original.setValue(next);
		}
	});

	const modifiedValueStore = multiModeStore(modified, {
		internal(next) {
			modified = next;
		},
		external(next) {
			const modifiedEditor = editor.getModifiedEditor();
			if (modifiedEditor.getOption(monaco.editor.EditorOption.readOnly)) {
				modifiedEditor.setValue(next);
				return;
			}

			if (next === modifiedEditor.getValue()) return;

			modifiedEditor.executeEdits('', [
				{
					range: modifiedEditor.getModel()!.getFullModelRange(),
					text: next,
					forceMoveMarkers: true
				}
			]);

			modifiedEditor.pushUndoStop();
		}
	});

	$: if (isEditorReady) originalValueStore.set('external', original);
	$: if (isEditorReady) modifiedValueStore.set('external', modified);
	$: if (isEditorReady) syncOptions(options);
	$: if (isEditorReady) syncLanguage(language, originalLanguage, modifiedLanguage);
	$: if (isEditorReady) syncTheme(theme);
	$: if (!isEditorReady && !isMonacoMounting) createEditor();

	function syncOptions(...deps: unknown[]) {
		editor.updateOptions(options);
	}

	function syncLanguage(...deps: unknown[]) {
		const { original, modified } = editor.getModel()!;

		monaco.editor.setModelLanguage(original, originalLanguage || language!);
		monaco.editor.setModelLanguage(modified, modifiedLanguage || language!);
	}

	function syncTheme(...deps: unknown[]) {
		monaco.editor.setTheme(theme);
	}

	function createEditor() {
		editor = monaco.editor.createDiffEditor(container, {
			automaticLayout: true,
			...options
		});

		const originalModel = getOrCreateModel(
			monaco,
			original,
			originalLanguage || language!,
			originalModelPath
		);

		const modifiedModel = getOrCreateModel(
			monaco,
			modified,
			modifiedLanguage || language!,
			modifiedModelPath
		);

		editor.setModel({ original: originalModel, modified: modifiedModel });
		monaco.editor.setTheme(theme);

		isEditorReady = true;

		dispatch('mount', {
			editor,
			monaco
		});
	}

	function disposeEditor() {
		const models = editor.getModel()!;

		if (!keepCurrentOriginalModel) {
			models.original?.dispose();
		}

		if (!keepCurrentModifiedModel) {
			models.modified?.dispose();
		}

		editor.dispose();
	}
</script>

{#if !isEditorReady}
	<slot name="loading">Loading...</slot>
{/if}

<section class="wrapper" {...wrapperProps} style:width style:height>
	<div bind:this={container} class={className} class:container />
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
