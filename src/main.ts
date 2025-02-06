import type { BrowserHistoryPluginSettings } from './setting'
import { Plugin } from 'obsidian'
import { BrowserHistory } from './browser-history'
import { BrowserHistorySettingTab, DEFAULT_SETTINGS } from './setting'

export default class BrowserHistoryPlugin extends Plugin {
  settings: BrowserHistoryPluginSettings
  history = new BrowserHistory(this)
  autoSyncId: number | undefined

  async onload() {
    await this.loadSettings()

    this.addRibbonIcon(
      'history',
      'Open today\'s browser history',
      this.history.onClickRibbon,
    )
    this.addSettingTab(new BrowserHistorySettingTab(this.app, this))

    // sync on startup
    // load after 1s to avoid > Error: Folder already exists.
    if (this.settings.syncOnStartup)
      setTimeout(() => this.history.syncNotes(), 1000)

    // auto sync
    if ((this.settings.autoSyncMs || -1) > 0) {
      this.autoSyncId = this.registerInterval(window.setInterval(() => {
        this.history.syncNotes()
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
