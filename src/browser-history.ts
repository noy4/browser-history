import type { App, TFile } from 'obsidian'
import type BrowserHistoryPlugin from './main'
import { addDays, differenceInDays, format, startOfDay, startOfToday, subDays } from 'date-fns'
import dayjs from 'dayjs'
import { DBClient } from './db'
import { log, notify } from './utils'

interface CreateDailyNoteOptions {
  date?: Date
  load?: boolean
}

export class BrowserHistory {
  plugin: BrowserHistoryPlugin
  app: App
  db: DBClient

  constructor(plugin: BrowserHistoryPlugin) {
    this.plugin = plugin
    this.app = plugin.app
  }

  async load() {
    try {
      await this._load()
      return true
    }
    catch (e) {
      notify(`Failed to load: ${e}`)
    }
  }

  async _load() {
    this.db = await DBClient.load({
      sqlitePath: this.plugin.settings.sqlitePath || '',
    })
  }

  async syncNotes() {
    const loaded = await this.load()
    if (!loaded)
      return

    const today = startOfToday()
    const _fromDate = this.plugin.settings.fromDate
    const fromDate = _fromDate ? new Date(`${_fromDate} 00:00:00`) : today
    const dayCount = differenceInDays(today, fromDate) + 1
    const dates = Array.from({ length: dayCount })
      .map((_, i) => subDays(today, i))
    const files: TFile[] = []

    for (const date of dates) {
      const path = await this.syncNote({ date, load: false })
      if (path)
        files.push(path)
    }

    this.plugin.settings.fromDate = format(today, 'yyyy-MM-dd')
    await this.plugin.saveSettings()
    log(`synced ${files.length} notes`)
    return files
  }

  async syncNote(options?: CreateDailyNoteOptions) {
    try {
      return await this._syncNote(options)
    }
    catch (e) {
      notify(e)
    }
  }

  async _syncNote(options?: CreateDailyNoteOptions) {
    const { date, load } = {
      date: startOfDay(new Date()),
      load: true,
      ...options,
    }

    if (load)
      await this._load()

    const template = this.plugin.settings.fileNameFormat || 'YYYY-MM-DD'
    const fileName = dayjs(date).format(template)
    const path = [this.plugin.settings.folderPath, `${fileName}.md`].join('/')

    const records = this.db.getUrls({
      fromDate: date,
      toDate: addDays(date, 1),
    })

    // return if no history
    if (!records.length) {
      log(`no history for ${fileName}`)
      return
    }

    const content = records.map((v) => {
      const timestamp = format(new Date(v.visit_time as number), 'HH:mm')
      return `- ${timestamp} [${v.title}](${v.url})`
    }).join('\n')

    return this.upsertFile(path, content)
  }

  async upsertFile(path: string, data: string) {
    const paths = path.split('/')
    const _fileName = paths.pop()
    const folderPath = paths.join('/')

    // create folder if it doesn't exist
    if (folderPath) {
      const folder = this.app.vault.getFolderByPath(folderPath)
      if (!folder)
        await this.app.vault.createFolder(folderPath)
    }

    let file = this.app.vault.getFileByPath(path)
    if (!file)
      file = await this.app.vault.create(path, data)
    else
      await this.app.vault.modify(file, data)
    return file
  }

  onClickRibbon = async (e: MouseEvent) => {
    const files = await this.syncNotes()
    const todayFile = files?.at(0)

    if (todayFile)
      this.app.workspace.getLeaf(e.metaKey).openFile(todayFile)
    else
      notify('No history for today.')
  }
}
