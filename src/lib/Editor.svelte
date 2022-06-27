<script context="module" lang="ts">
	interface EventMap {
		change: monaco.editor.IModelContentChangedEvent & {
			value: string;
		};
	}
</script>

<script lang="ts">
	import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
	import { createEventDispatcher, onDestroy } from 'svelte';
	import { get, writable } from 'svelte/store';

	export let width: string = '100%';
	export let height: string = '100%';
	export let value: string = '';
	export let language = 'javascript';
	export let theme: string | null = null;
	export let options: monaco.editor.IStandaloneEditorConstructionOptions = {};
	export let overrideServices: monaco.editor.IEditorOverrideServices = {};
	let className: string | null = null;
	export { className as class };

	const dispatch = createEventDispatcher<EventMap>();

	let allowChangeDispatch = true;
	let editor: monaco.editor.IStandaloneCodeEditor;

	let changeSubscription: monaco.IDisposable;

	const layoutWatcher = createWatcher([width, height], ([prevWidth, prevHeight]) => {
		if (height === prevHeight && width === prevWidth) return false;
		editor.layout();
		return true;
	});

	const valueWatcher = createWatcher(value, (prevValue) => {
		if (value === prevValue) return false;
		const model = editor.getModel();
		if (!model) return false;
		allowChangeDispatch = false;
		editor.pushUndoStop();
		//@ts-expect-error
		model.pushEditOperations(
			[],
			[
				{
					range: model.getFullModelRange(),
					text: value
				}
			]
		);
		editor.pushUndoStop();
		allowChangeDispatch = true;
		return true;
	});

	const languageWatcher = createWatcher(language, (prevLanguage) => {
		const model = editor.getModel();
		if (!model || language === prevLanguage) return false;
		monaco.editor.setModelLanguage(model, language);
		return true;
	});

	const themeWatcher = createWatcher(theme, (prevTheme) => {
		if (!theme || theme === prevTheme) return false;

		monaco.editor.setTheme(theme);
		return true;
	});

	const optionsWatcher = createWatcher(options, (prevOptions) => {
		if (options === prevOptions) return false;
		// https://github.com/microsoft/monaco-editor/issues/2027
		const { model: _model, ...optionsWithoutModel } = options;
		editor.updateOptions({
			...(className ? { extraEditorClassName: className } : {}),
			...optionsWithoutModel
		});
		return true;
	});

	$: editor && layoutWatcher([width, height]);
	$: editor && valueWatcher(value);
	$: editor && languageWatcher(language);
	$: editor && themeWatcher(theme);
	$: editor && optionsWatcher(options);

	// only runs when the editor changes
	$: onEditorMount(editor);

	onDestroy(() => {
		changeSubscription?.dispose();
		editor.dispose();
		const model = editor.getModel();
		model?.dispose();
	});

	function applyEditor(node: HTMLElement) {
		editor = monaco.editor.create(
			node,
			{
				value,
				language,
				...(className ? { extraEditorClassName: className } : {}),
				...options,
				...(theme ? { theme } : {})
			},
			overrideServices
		);
	}

	function onEditorMount(editor: monaco.editor.IStandaloneCodeEditor) {
		if (!editor) return;
		changeSubscription?.dispose();
		changeSubscription = editor.onDidChangeModelContent((e) => {
			if (allowChangeDispatch) {
				value = editor.getValue();
				dispatch('change', { ...e, value });
			}
		});
	}

	function createWatcher<T>(init: T, effect: (prev: T) => boolean) {
		const store = writable(init);

		return (value: T) => {
			const valid = effect(get(store));
			if (valid) store.set(value);
		};
	}
</script>

<div class="svelte-monaco-editor-container" use:applyEditor style:height style:width />
