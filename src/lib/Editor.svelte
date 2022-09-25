<script context="module" lang="ts">
	interface EventMap {
		change: {
			text: string;
			event: monaco.editor.IModelContentChangedEvent;
		};
		validate: {
			markers: monaco.editor.IMarker[];
		};
		mount: {
			editor: monaco.editor.IStandaloneCodeEditor;
			monaco: Monaco;
		};
	}

	type Options = monaco.editor.IStandaloneEditorConstructionOptions;

	const viewStates = new Map<string | undefined, monaco.editor.ICodeEditorViewState>();
</script>

<script lang="ts">
	import type * as monaco from 'monaco-editor';

	import loader from '@monaco-editor/loader';
	import { createEventDispatcher, onMount } from 'svelte';
	import type { Monaco } from './types';
	import { getOrCreateModel, writablePrevious } from '../utils';
	import { multiModeStore } from '../stores/multi_mode';

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

	let container: HTMLDivElement;

	let monaco: Monaco;
	let editor: monaco.editor.IStandaloneCodeEditor;
	let subscription: monaco.IDisposable | undefined;

	let isEditorReady = false;
	$: isMonacoMounting = !monaco;
	const previousPath = writablePrevious(path);
	$: $previousPath = path;

	const valueStore = multiModeStore(value, {
		internal(next) {
			value = next;
		},
		external(next) {
			if (editor.getOption(monaco.editor.EditorOption.readOnly)) {
				editor.setValue(next);
				return;
			}

			editor.executeEdits('', [
				{
					range: editor.getModel()!.getFullModelRange(),
					text: next,
					forceMoveMarkers: true
				}
			]);

			editor.pushUndoStop();
		}
	});

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

	$: if (isEditorReady) {
		console.log('syncing path!');
		syncPath($previousPath);
	}
	$: if (isEditorReady) syncOptions(options);
	$: if (isEditorReady) syncLanguage(language);
	$: if (isEditorReady) syncLine(line);
	$: if (isEditorReady) syncTheme(theme);
	$: if (isEditorReady) valueStore.set('external', value);
	$: if (!isEditorReady && !isMonacoMounting) createEditor();

	function syncPath(...deps: unknown[]) {
		const model = getOrCreateModel(monaco, value, language, $previousPath);

		if (model !== editor.getModel()) {
			saveViewState && viewStates.set($previousPath, editor.saveViewState()!);
			editor.setModel(model);
			saveViewState && editor.restoreViewState(viewStates.get($previousPath)!);
		}
	}

	function syncOptions(...deps: unknown[]) {
		editor.updateOptions(options);
	}

	function syncLanguage(...deps: unknown[]) {
		monaco.editor.setModelLanguage(editor.getModel()!, language);
	}

	function syncLine(...deps: unknown[]) {
		// reason for undefined check: https://github.com/suren-atoyan/monaco-react/pull/188
		if (line !== undefined) {
			editor.revealLine(line);
		}
	}

	function syncTheme(...deps: unknown[]) {
		monaco.editor.setTheme(theme);
	}

	function createEditor() {
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

		saveViewState && editor.restoreViewState(viewStates.get(path)!);

		monaco.editor.setTheme(theme);

		subscription = editor.onDidChangeModelContent((event) => {
			const text = editor.getValue();

			if (value === text) return;

			valueStore.set('internal', text);

			dispatch('change', {
				text,
				event
			});
		});

		isEditorReady = true;
	}
	function disposeEditor() {
		subscription?.dispose();

		if (keepCurrentModel) {
			if (saveViewState) viewStates.set(path, editor.saveViewState()!);
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
	<div bind:this={container} class={className} class:container />
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
