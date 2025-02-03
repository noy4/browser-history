import { format } from 'date-fns';
import * as fs from 'fs';
import { App, Plugin, PluginSettingTab, Setting, TFile } from 'obsidian';
import initSqlJs from 'sql.js';

// @ts-ignore
import sqlWasm from './node_modules/sql.js/dist/sql-wasm.wasm';

interface BrowserHistoryPluginSettings {
	mySetting: string;
}

const DEFAULT_SETTINGS: BrowserHistoryPluginSettings = {
	mySetting: 'default'
}

// last_visit_time is in microseconds since 1601-01-01T00:00:00Z
// [sqlite - What is the format of Chrome's timestamps? - Stack Overflow](https://stackoverflow.com/questions/20458406/what-is-the-format-of-chromes-timestamps)
const epoch1970 = new Date('1970-01-01T00:00:00Z');
const epoch1601 = new Date('1601-01-01T00:00:00Z');
const UNIX_EPOCH_OFFSET = epoch1970.getTime() - epoch1601.getTime(); // 11644473600000

export default class BrowserHistoryPlugin extends Plugin {
	settings: BrowserHistoryPluginSettings;

	async onload() {
		await this.loadSettings();

		const ribbonIconEl = this.addRibbonIcon('dice', 'Sample Plugin', (evt: MouseEvent) => {
			this.createBrowserHistoryNote()
		});

		this.addSettingTab(new SampleSettingTab(this.app, this));

		this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
	}

	async createBrowserHistoryNote() {
		const SQL = await initSqlJs({ wasmBinary: sqlWasm })
		const dbPath = '/Users/noy/Library/Application Support/BraveSoftware/Brave-Browser/Default/History';
		const dbBuffer = fs.readFileSync(dbPath);
		const db = new SQL.Database(dbBuffer);

		// urls
		// "id"
		// "url"
		// "title"
		// "visit_count"
		// "typed_count"
		// "last_visit_time"
		// "hidden"
		const rows = db.exec('select title, url, last_visit_time from urls order by id desc limit 50')[0].values
		const formattedRows = rows.map(row => {
			const [title, url, last_visit_time] = row
			const date = new Date((Number(last_visit_time) / 1000) - UNIX_EPOCH_OFFSET)
			const formatString = 'HH:mm'
			const formattedDate = format(date, formatString)
			return `${formattedDate} [${title}](${url})`
		})
		const content = formattedRows.join('\n') + '\n'
		const noteTitle = 'Browser History.md'

		const browserHistoryNote = this.app.vault.getAbstractFileByPath(noteTitle)
		if (!browserHistoryNote) {
			this.app.vault.create(noteTitle, content)
		} else {
			this.app.vault.modify(browserHistoryNote as TFile, content)
		}
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
