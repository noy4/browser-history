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
      async (e) => {
        const files = await this.history.syncNotes()
        const todayFile = files?.at(0)
        if (todayFile)
          this.app.workspace.getLeaf(e.metaKey).openFile(todayFile)
      },
    )

    this.addSettingTab(new BrowserHistorySettingTab(this.app, this))

    // sync on startup
    if (this.settings.syncOnStartup)
      await this.history.syncNotes()

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
