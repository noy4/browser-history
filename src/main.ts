import type { App } from 'obsidian'
import { format, startOfToday } from 'date-fns'
import { Plugin, PluginSettingTab, Setting } from 'obsidian'
import { BrowserHistory } from './browser-history'
import { notify } from './utils'

interface BrowserHistoryPluginSettings {
  sqlitePath: string
  folderPath: string
  fromDate?: string
  syncOnStartup?: boolean
  autoSyncMs?: number
}

const DEFAULT_SETTINGS: BrowserHistoryPluginSettings = {
  sqlitePath: '/Users/noy/Library/Application Support/BraveSoftware/Brave-Browser/Default/History',
  folderPath: 'Browser History',
}

export default class BrowserHistoryPlugin extends Plugin {
  settings: BrowserHistoryPluginSettings
  history = new BrowserHistory(this)
  autoSyncId: number | undefined

  async onload() {
    await this.loadSettings()

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

    // sync on startup
    if (this.settings.syncOnStartup)
      await this.history.createDailyNotes()

    // auto sync
    if ((this.settings.autoSyncMs || -1) > 0) {
      this.autoSyncId = this.registerInterval(window.setInterval(() => {
        this.history.createDailyNotes()
      }, this.settings.autoSyncMs))
    }
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
      .setName('Database location')
      .setDesc('Path to the browser history file. ex. /Users/noy/Library/Application Support/BraveSoftware/Brave-Browser/Default/History')
      .addText(text => text
        .setPlaceholder('Example: /Users/noy/Library/Application Support/BraveSoftware/Brave-Browser/Default/History')
        .setValue(this.plugin.settings.sqlitePath)
        .onChange(async (value) => {
          this.plugin.settings.sqlitePath = value
          await this.plugin.saveSettings()
        }),
      )

    new Setting(containerEl)
      .setName('Check connection')
      .setDesc('Check if the database is connected.')
      .addButton(button => button
        .setButtonText('Check')
        .setCta()
        .onClick(async () => {
          const loaded = await this.plugin.history.load()
          if (!loaded)
            return

          const count = this.plugin.history.db.getUrlCount().toLocaleString()
          const data = this.plugin.history.db.getUrls({ limit: 1, desc: false }).at(0)
          const oldestDate = data
            ? format(new Date(data.last_visit_time as number), 'yyyy-MM-dd')
            : ''

          const message = `Connected. ${count} records exists.${count ? ` (oldest: ${oldestDate})` : ''}`
          notify(message)
        }))

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

    const startDateSetting = new Setting(containerEl)
      .setName('Start date')
      .setDesc('The date from which to create history notes. Will be set to today after sync.')
      .addText(text => text
        .setPlaceholder('Example: 2025-01-01')
        .setValue(this.plugin.settings.fromDate || format(startOfToday(), 'yyyy-MM-dd'))
        .onChange(async (value) => {
          this.plugin.settings.fromDate = value
          await this.plugin.saveSettings()
        }),
      )

    new Setting(containerEl)
      .setName('Sync')
      .setDesc(`Create history notes from the start date. If the note already exists, it will be overwritten.`)
      .addButton(button => button
        .setButtonText('Sync')
        .setCta()
        .onClick(async () => {
          await this.plugin.history.createDailyNotes()
          const inputEl = startDateSetting.controlEl.querySelector('input')!
          inputEl.value = this.plugin.settings.fromDate!
        }),
      )

    new Setting(containerEl)
      .setName('Sync on startup')
      .setDesc('Sync history on startup.')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.syncOnStartup || false)
        .onChange(async (value) => {
          this.plugin.settings.syncOnStartup = value
          await this.plugin.saveSettings()
        }),
      )

    new Setting(containerEl)
      .setName('Auto sync')
      .setDesc('Automatically create notes from the specified date.')
      .addDropdown((dropdown) => {
        dropdown.addOption('-1', 'Disabled')
        dropdown.addOption(`${1000 * 5 * 1}`, '5 sec')
        dropdown.addOption(`${1000 * 60 * 1}`, '1 min')
        dropdown.addOption(`${1000 * 60 * 5}`, '5 min')
        dropdown.addOption(`${1000 * 60 * 10}`, '10 min')
        dropdown.addOption(`${1000 * 60 * 30}`, '30 min')
        dropdown.setValue(String(this.plugin.settings.autoSyncMs || -1))
          .onChange(async (value) => {
            const ms = Number(value)
            this.plugin.settings.autoSyncMs = ms
            await this.plugin.saveSettings()

            // set interval
            if (ms > 0) {
              if (this.plugin.autoSyncId)
                window.clearInterval(this.plugin.autoSyncId)

              this.plugin.autoSyncId = this.plugin.registerInterval(
                window.setInterval(() => {
                  this.plugin.history.createDailyNotes()
                }, ms),
              )
            }

            // clear interval
            else {
              window.clearInterval(this.plugin.autoSyncId)
              this.plugin.autoSyncId = undefined
            }
          })
      })
  }
}
