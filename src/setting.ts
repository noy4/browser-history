import type { App } from 'obsidian'
import type BrowserHistoryPlugin from './main'
import { format, startOfToday } from 'date-fns'
import { PluginSettingTab, Setting } from 'obsidian'
import { BrowserType, getDefaultBrowserPath } from './browser-detector'
import { notify } from './utils'

export interface BrowserHistoryPluginSettings {
  selectedBrowser?: BrowserType
  sqlitePath?: string
  folderPath: string
  fromDate?: string
  syncOnStartup?: boolean
  autoSyncMs?: number
}

export const DEFAULT_SETTINGS: BrowserHistoryPluginSettings = {
  folderPath: 'Browser History',
  selectedBrowser: BrowserType.CHROME,
}

export class BrowserHistorySettingTab extends PluginSettingTab {
  plugin: BrowserHistoryPlugin

  constructor(app: App, plugin: BrowserHistoryPlugin) {
    super(app, plugin)
    this.plugin = plugin
  }

  display() {
    const { containerEl } = this
    containerEl.empty()

    this.addDatabaseLocationSetting()
    this.addCheckConnectionSetting()
    this.addFileLocationSetting()
    const startDateSetting = this.addStartDateSetting()
    this.addSyncSetting(startDateSetting)
    this.addSyncOnStartupSetting()
    this.addAutoSyncSetting()
  }

  private addDatabaseLocationSetting() {
    // Get default path based on selected browser or fallback to Chrome
    const selectedBrowser = this.plugin.settings.selectedBrowser || BrowserType.CHROME
    const defaultPath = getDefaultBrowserPath(selectedBrowser)

    // Auto-set path if not already set
    if (!this.plugin.settings.sqlitePath) {
      this.plugin.settings.sqlitePath = defaultPath
      this.plugin.saveSettings()
    }

    new Setting(this.containerEl)
      .setName('Database location')
      .setDesc(`Path to your browser history database file. Select your browser to automatically set the database path.`)
      .addDropdown(dropdown => dropdown
        .addOption(BrowserType.CHROME, 'Chrome')
        .addOption(BrowserType.FIREFOX, 'Firefox')
        .addOption('manual', 'Manual (Custom Path)')
        .setValue(this.plugin.settings.selectedBrowser || BrowserType.CHROME)
        .onChange(async (value) => {
          this.plugin.settings.selectedBrowser = value as BrowserType
          // Auto-update the database path when browser is selected
          this.plugin.settings.sqlitePath = getDefaultBrowserPath(value as BrowserType)
          await this.plugin.saveSettings()
          // Update the text input value
          const inputEl = dropdown.selectEl.nextElementSibling as HTMLInputElement
          inputEl.value = this.plugin.settings.sqlitePath
        }),
      )
      .addText(text => text
        .setPlaceholder(`Example: ${defaultPath}`)
        .setValue(this.plugin.settings.sqlitePath!)
        .onChange(async (value) => {
          this.plugin.settings.sqlitePath = value
          await this.plugin.saveSettings()
        }),
      )
  }

  private addCheckConnectionSetting() {
    new Setting(this.containerEl)
      .setName('Check connection')
      .setDesc('Test the connection to your browser history database.')
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
            ? format(new Date(data.visit_time as number), 'yyyy-MM-dd')
            : ''

          const message = `Successfully connected. ${count} records found${count ? ` (oldest: ${oldestDate})` : ''}`
          notify(message)
        }))
  }

  private addFileLocationSetting() {
    new Setting(this.containerEl)
      .setName('New file location')
      .setDesc('Directory where your browser history notes will be saved. **Warning**: Please select a different folder than your daily notes to avoid any conflicts.')
      .addText(text => text
        .setPlaceholder('Example: Browser History')
        .setValue(this.plugin.settings.folderPath)
        .onChange(async (value) => {
          this.plugin.settings.folderPath = value
          await this.plugin.saveSettings()
        }),
      )
  }

  private addStartDateSetting() {
    return new Setting(this.containerEl)
      .setName('Start date')
      .setDesc('Starting date for history note creation. This automatically updates to today after sync.')
      .addText(text => text
        .setPlaceholder('Example: 2025-01-01')
        .setValue(this.plugin.settings.fromDate || format(startOfToday(), 'yyyy-MM-dd'))
        .onChange(async (value) => {
          this.plugin.settings.fromDate = value
          await this.plugin.saveSettings()
        }),
      )
  }

  private addSyncSetting(startDateSetting: Setting) {
    new Setting(this.containerEl)
      .setName('Sync')
      .setDesc('Manually trigger the creation or update of history notes from the specified start date.')
      .addButton(button => button
        .setButtonText('Sync')
        .setCta()
        .onClick(async () => {
          const files = await this.plugin.history.syncNotes()
          if (!files)
            return

          notify(`Synced ${files.length} notes`)
          const inputEl = startDateSetting.controlEl.querySelector('input')!
          inputEl.value = this.plugin.settings.fromDate!
        }),
      )
  }

  private addSyncOnStartupSetting() {
    new Setting(this.containerEl)
      .setName('Sync on startup')
      .setDesc('Sync history notes when Obsidian starts.')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.syncOnStartup || false)
        .onChange(async (value) => {
          this.plugin.settings.syncOnStartup = value
          await this.plugin.saveSettings()
        }),
      )
  }

  private addAutoSyncSetting() {
    new Setting(this.containerEl)
      .setName('Auto sync')
      .setDesc('Set an interval for automatic history note sync.')
      .addDropdown((dropdown) => {
        dropdown.addOption('-1', 'Disabled')
        dropdown.addOption(`${1000 * 60 * 1}`, '1 min')
        dropdown.addOption(`${1000 * 60 * 5}`, '5 min')
        dropdown.addOption(`${1000 * 60 * 10}`, '10 min')
        dropdown.addOption(`${1000 * 60 * 30}`, '30 min')
        dropdown.addOption(`${1000 * 5 * 1}`, '5 seconds (testing)')
        dropdown.setValue(String(this.plugin.settings.autoSyncMs || -1))
          .onChange(async (value) => {
            const ms = Number(value)
            this.plugin.settings.autoSyncMs = ms
            await this.plugin.saveSettings()

            if (ms > 0) {
              if (this.plugin.autoSyncId)
                window.clearInterval(this.plugin.autoSyncId)

              this.plugin.autoSyncId = this.plugin.registerInterval(
                window.setInterval(() => {
                  this.plugin.history.syncNotes()
                }, ms),
              )
            }

            else {
              window.clearInterval(this.plugin.autoSyncId)
              this.plugin.autoSyncId = undefined
            }
          })
      })
  }
}
