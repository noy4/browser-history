import type { App } from 'obsidian'
import { format, startOfToday } from 'date-fns'
import { Plugin, PluginSettingTab, Setting } from 'obsidian'
import { BrowserHistory } from './browser-history'
import { wrap } from './utils'

interface BrowserHistoryPluginSettings {
  sqlitePath: string
  folderPath: string
  fromDate?: string
}

const DEFAULT_SETTINGS: BrowserHistoryPluginSettings = {
  sqlitePath: '/Users/noy/Library/Application Support/BraveSoftware/Brave-Browser/Default/History',
  folderPath: 'Browser History',
}

export default class BrowserHistoryPlugin extends Plugin {
  settings: BrowserHistoryPluginSettings
  history = new BrowserHistory(this)

  async onload() {
    await this.loadSettings()
    await this.history.load()

    this.addRibbonIcon(
      'history',
      'Open today\'s browser history',
      async (e) => {
        const file = await this.history.createDailyNote({ overwrite: true })
        if (file)
          this.app.workspace.getLeaf(e.metaKey).openFile(file)
      },
    )

    this.addSettingTab(new BrowserHistorySettingTab(this.app, this))
    this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000))
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData())
  }

  async saveSettings() {
    await this.saveData(this.settings)
  }
}

class BrowserHistorySettingTab extends PluginSettingTab {
  plugin: BrowserHistoryPlugin

  constructor(app: App, plugin: BrowserHistoryPlugin) {
    super(app, plugin)
    this.plugin = plugin
  }

  display(): void {
    const { containerEl } = this

    containerEl.empty()

    new Setting(containerEl)
      .setName('Sqlite location')
      .setDesc('Path to the browser history sqlite database. ex. /Users/noy/Library/Application Support/BraveSoftware/Brave-Browser/Default/History')
      .addText(text => text
        .setPlaceholder('Example: /Users/noy/Library/Application Support/BraveSoftware/Brave-Browser/Default/History')
        .setValue(this.plugin.settings.sqlitePath)
        .onChange(async (value) => {
          this.plugin.settings.sqlitePath = value
          await this.plugin.saveSettings()
        }),
      )

    new Setting(containerEl)
      .setName('New file location')
      .setDesc('New history notes will be placed here.')
      .addText(text => text
        .setPlaceholder('Example: Browser History')
        .setValue(this.plugin.settings.folderPath)
        .onChange(async (value) => {
          this.plugin.settings.folderPath = value
          await this.plugin.saveSettings()
        }),
      )

    const { data } = wrap(() =>
      this.plugin.history.db.getUrls({ limit: 1, desc: false }).at(0),
    )
    const oldestDate = data
      ? format(new Date(data.last_visit_time as number), 'yyyy-MM-dd')
      : 'no record'
    new Setting(containerEl)
      .setName('Create notes')
      .setDesc(`Create notes from the specified date. oldest: ${oldestDate}`)
      .addText(text => text
        .setPlaceholder('Example: 2025-01-01')
        .setValue(this.plugin.settings.fromDate || format(startOfToday(), 'yyyy-MM-dd'))
        .onChange(async (value) => {
          this.plugin.settings.fromDate = value
          await this.plugin.saveSettings()
        }),
      )
      .addButton(button => button
        .setButtonText('Create notes')
        .setCta()
        .onClick(async () => {
          this.plugin.history.createDailyNotes()
        }),
      )
  }
}
