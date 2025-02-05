import type { App } from 'obsidian'
import { format, startOfMonth } from 'date-fns'
import { Plugin, PluginSettingTab, Setting } from 'obsidian'
import { BrowserHistory } from './browser-history'

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
      .setName('Sqlite path')
      .setDesc('Path to the browser history sqlite database. ex. /Users/noy/Library/Application Support/BraveSoftware/Brave-Browser/Default/History')
      .addText(text => text
        .setPlaceholder('Enter the path to the sqlite database')
        .setValue(this.plugin.settings.sqlitePath)
        .onChange(async (value) => {
          this.plugin.settings.sqlitePath = value
          await this.plugin.saveSettings()
        }),
      )

    new Setting(containerEl)
      .setName('Folder path')
      .setDesc('Path to the folder where the browser history notes will be created')
      .addText(text => text
        .setPlaceholder('Enter the path to the folder')
        .setValue(this.plugin.settings.folderPath)
        .onChange(async (value) => {
          this.plugin.settings.folderPath = value
          await this.plugin.saveSettings()
        }),
      )

    new Setting(containerEl)
      .setName('Create notes')
      .setDesc('Create history notes from the specified date. Leave blank to create notes for all history')
      .addText(text => text
        .setPlaceholder('Example: 2025-01-01')
        .setValue(this.plugin.settings.fromDate || format(startOfMonth(new Date()), 'yyyy-MM-dd'))
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
