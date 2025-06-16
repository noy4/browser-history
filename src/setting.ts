import type { App } from 'obsidian'
import type BrowserHistoryPlugin from './main'
import { PluginSettingTab, Setting } from 'obsidian'
import { BrowserType, detectBrowserType, getDefaultBrowserPath } from './browser'
import { checkConnection } from './browser-history'
import { dayjs } from './dayjs'
import { notify } from './utils'

export interface BrowserHistoryPluginSettings {
  sqlitePath?: string
  folderPath: string
  fromDate?: string
  syncOnStartup?: boolean
  autoSyncMs?: number
  fileNameFormat?: string
}

export const DEFAULT_SETTINGS: BrowserHistoryPluginSettings = {
  folderPath: 'Browser History',
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
    this.addFileNameFormatSetting()
    const startDateSetting = this.addStartDateSetting()
    this.addSyncSetting(startDateSetting)
    this.addSyncOnStartupSetting()
    this.addAutoSyncSetting()
  }

  private addDatabaseLocationSetting() {
    const defaultPath = getDefaultBrowserPath()

    // Auto-set path if not already set
    if (!this.plugin.settings.sqlitePath) {
      this.plugin.settings.sqlitePath = getDefaultBrowserPath()
      this.plugin.saveSettings()
    }

    const selectedBrowser = detectBrowserType(this.plugin.settings.sqlitePath) || BrowserType.CHROME

    new Setting(this.containerEl)
      .setName('Database location')
      .setDesc(`Path to your browser history database file. Select your browser to automatically set the database path.`)
      .addDropdown(dropdown => dropdown
        .addOption(BrowserType.CHROME, 'Chrome')
        .addOption(BrowserType.FIREFOX, 'Firefox')
        .addOption(BrowserType.BRAVE, 'Brave')
        .addOption(BrowserType.UNKNOWN, 'Manual (Custom Path)')
        .setValue(selectedBrowser)
        .onChange(async (value) => {
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
        .onClick(() => checkConnection(this.plugin)))
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

  private addFileNameFormatSetting() {
    let previewEl: HTMLElement

    new Setting(this.containerEl)
      .setName('File name format')
      .setDesc(createFragment((frag) => {
        frag.appendText('Example: YYYY-MM-DD, [Browser History] YYYY-MM-DD')
        frag.createEl('br')
        frag.appendText('For more syntax, refer to ')
        frag.createEl('a', {
          text: 'format reference',
          href: 'https://momentjs.com/docs/#/displaying/format/',
        })
        frag.createEl('br')
        frag.appendText('Your current syntax looks like this: ')
        previewEl = frag.createEl('b', { cls: 'u-pop' })
      }))
      .addText(text => text
        .setPlaceholder('YYYY-MM-DD')
        .setValue(this.plugin.settings.fileNameFormat || 'YYYY-MM-DD')
        .onChange(async (value) => {
          this.plugin.settings.fileNameFormat = value
          await this.plugin.saveSettings()
          updatePreviewDisplay(previewEl, value)
        }),
      )

    // Initial preview display
    const currentValue = this.plugin.settings.fileNameFormat || ''
    updatePreviewDisplay(previewEl!, currentValue)

    function updatePreviewDisplay(container: HTMLElement, template: string) {
      const previewText = dayjs().format(template || 'YYYY-MM-DD')
      container.textContent = `${previewText}.md`
    }
  }

  private addStartDateSetting() {
    return new Setting(this.containerEl)
      .setName('Start date')
      .setDesc('Starting date for history note creation. This automatically updates to today after sync.')
      .addText(text => text
        .setPlaceholder('Example: 2025-01-01')
        .setValue(this.plugin.settings.fromDate || dayjs().startOf('day').format('YYYY-MM-DD'))
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
