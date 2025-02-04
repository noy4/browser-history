import { BrowserHistory } from 'browser-history';
import { App, Plugin, PluginSettingTab, Setting } from 'obsidian';

interface BrowserHistoryPluginSettings {
	mySetting: string;
}

const DEFAULT_SETTINGS: BrowserHistoryPluginSettings = {
	mySetting: 'default'
}

export default class BrowserHistoryPlugin extends Plugin {
	settings: BrowserHistoryPluginSettings;
	browserHistory = new BrowserHistory(this)

	async onload() {
		await this.loadSettings();

		this.addRibbonIcon('history', 'Open browser history', (evt: MouseEvent) => {
			this.browserHistory.createBrowserHistoryNote()
		});

		this.addSettingTab(new BrowserHistorySettingTab(this.app, this));
		this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class BrowserHistorySettingTab extends PluginSettingTab {
	plugin: BrowserHistoryPlugin;

	constructor(app: App, plugin: BrowserHistoryPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Setting #1')
			.setDesc('It\'s a secret')
			.addText(text => text
				.setPlaceholder('Enter your secret')
				.setValue(this.plugin.settings.mySetting)
				.onChange(async (value) => {
					this.plugin.settings.mySetting = value;
					await this.plugin.saveSettings();
				}));
	}
}
