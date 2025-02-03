import * as fs from 'fs';
import { App, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import initSqlJs from 'sql.js';
// @ts-ignore
import sqlWasm from './node_modules/sql.js/dist/sql-wasm.wasm';

// Remember to rename these classes and interfaces!

interface BrowserHistoryPluginSettings {
	mySetting: string;
}

const DEFAULT_SETTINGS: BrowserHistoryPluginSettings = {
	mySetting: 'default'
}

export default class BrowserHistoryPlugin extends Plugin {
	settings: BrowserHistoryPluginSettings;

	async onload() {
		await this.loadSettings();

		const dbPath = '/Users/noy/Library/Application Support/BraveSoftware/Brave-Browser/Default/History';
		const SQL = await initSqlJs({ wasmBinary: sqlWasm })

		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon('dice', 'Sample Plugin', (evt: MouseEvent) => {
			// Called when the user clicks the icon.
			new Notice('This is a notice!');


			const dbBuffer = fs.readFileSync(dbPath);
			const db = new SQL.Database(dbBuffer);
			const res = db.exec('select * from urls limit 10')[0]
			console.log('res:', res)
		});

		this.addSettingTab(new SampleSettingTab(this.app, this));

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class SampleSettingTab extends PluginSettingTab {
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
