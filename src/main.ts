import type { DBClient } from './db'
import type { BrowserHistoryPluginSettings } from './setting'
import { Plugin } from 'obsidian'
import { openTodayHistory, syncNotes } from './commands'
import { BrowserHistorySettingTab, DEFAULT_SETTINGS } from './setting'

export default class BrowserHistoryPlugin extends Plugin {
  settings: BrowserHistoryPluginSettings
  autoSyncId: number | undefined
  db: DBClient

  async onload() {
    await this.loadSettings()

    this.addRibbonIcon(
      'history',
      'Open today\'s browser history',
      e => openTodayHistory(this, e.metaKey),
    )
    this.addSettingTab(new BrowserHistorySettingTab(this))

    // sync on startup
    this.app.workspace.onLayoutReady(() => {
      if (this.settings.syncOnStartup)
        syncNotes(this)
    })

    // auto sync
    if ((this.settings.autoSyncMs || -1) > 0) {
      this.autoSyncId = this.registerInterval(window.setInterval(() => {
        syncNotes(this)
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
