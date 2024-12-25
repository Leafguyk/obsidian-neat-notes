// import obsidian
import { App, Editor, MarkdownView, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';

// import openai
import OpenAI from 'openai';

interface MyPluginSettings {
	openAPIKey: string;
	model: string;
	prompt: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	openAPIKey: '',
	model: 'gpt-4o-mini',
	prompt: 'You are a helpful note-taking plugin. You are asked to make the note neat that the user gives you. You should make the note more structured and organized, but you shouldn\'t change the meaning of the note and shoudn\'t omit the specific details as possible. Also, you should use the language that the original note is written in.'
}

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;

	async onload() {
		// Load the settings for the plugin
		await this.loadSettings();

		// Create an instance of the OpenAI class
		const openai = new OpenAI({ apiKey: this.settings.openAPIKey, dangerouslyAllowBrowser: true });

		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon('sparkles', 'Make your note neat', async (evt: MouseEvent) => {
			await this.makeTextNeat(openai);
		});

		// Perform additional things with the ribbon
		ribbonIconEl.addClass('my-plugin-ribbon-class');

		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: 'make-note-neat',
			name: 'Make your note neat',
			callback: async () => {
				await this.makeTextNeat(openai);
			}
		});

		this.addCommand({
			id: 'make-selected-text-neat',
			name: 'Make selected text neat',
			editorCallback: async (editor: Editor, view: MarkdownView) => {
				const selectedText = editor.getSelection();
				if (selectedText === '') {
					new Notice('No text selected');
					return;
				}
				const neatText = await this.makeTextNeat(openai, selectedText);
				if (!neatText) {
					new Notice('Failed to make the text neat');
					return;
				}
				editor.replaceSelection(neatText);
			}
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SampleSettingTab(this.app, this));

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
			console.log('click', evt);
		});
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async makeTextNeat(openai: OpenAI, text?: string) {
		const file = this.app.workspace.getActiveFile();
		if (!file) {
			new Notice('No active file open');
			return;
		}
		new Notice('Working on making your note neat!');
		if (text === undefined) {
			const fileContent = await this.app.vault.read(file);
			// Call the OpenAI API
			const response = await openai.chat.completions.create({
				model: this.settings.model,
				messages: [
					{
						role: 'developer',
						content: this.settings.prompt
					},
					{
						role: 'user',
						content: fileContent
					}
				]
			});
			const neatNote = response.choices[0].message.content;
			if (!neatNote) {
				new Notice('Failed to make the note neat');
				return;
			}
			await this.app.vault.modify(file, neatNote);
		} else {
			const response = await openai.chat.completions.create({
				model: this.settings.model,
				messages: [
					{
						role: 'developer',
						content: this.settings.prompt
					},
					{
						role: 'user',
						content: text
					}
				]
			});
			const neatNote = response.choices[0].message.content;
			if (!neatNote) {
				new Notice('Failed to make the note neat');
				return;
			}
			return neatNote;
		}
	}
}

class SampleSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('OpenAI API Key')
			.setDesc('Enter your OpenAI API key here.')
			.addText(text => text
				.setPlaceholder('API Key')
				.setValue(this.plugin.settings.openAPIKey)
				.onChange(async (value) => {
					this.plugin.settings.openAPIKey = value;
					await this.plugin.saveSettings();
				})
				.inputEl.type = 'password');
	}
}
