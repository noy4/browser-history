import { format, startOfDay } from 'date-fns';
import * as fs from 'fs';
import { App, Notice, Plugin, PluginSettingTab, Setting, TFile } from 'obsidian';
import initSqlJs, { SqlValue } from 'sql.js';

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

		const results = db.exec(`
			select
				title,
				url,
				(last_visit_time / 1000 - ${UNIX_EPOCH_OFFSET}) as last_visit_time
			from urls
			order by id desc
			limit 50
		`)

		const dayMap = new Map<number, SqlValue[][]>()
		for (const row of results[0].values) {
			const [, , last_visit_time] = row
			const date = new Date(Number(last_visit_time))
			const day = startOfDay(date).getTime()
			const dayMapValue = dayMap.get(day) || []
			dayMapValue.push(row)
			dayMap.set(day, dayMapValue)
		}

		const summary = [
			`total: ${results[0].values.length}`,
		].join('\n')
		const body = [...dayMap].map(([day, rows]) => {
			const formattedDate = format(new Date(Number(day)), 'M/d')
			const formattedRows = rows.map(row => {
				const [title, url] = row
				return `- [${title}](${url})`
			})
			return `## ${formattedDate}\n${formattedRows.join('\n')}`
		}).join('\n\n')

		const content = [summary, body].join('\n\n')
		const path = 'Browser History.md'
		this.upsertFile(path, content)
		new Notice('Browser history note created!')
	}

	upsertFile(path: string, data: string) {
		const file = this.app.vault.getAbstractFileByPath(path)
		if (!file)
			this.app.vault.create(path, data)
		else
			this.app.vault.modify(file as TFile, data)
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
