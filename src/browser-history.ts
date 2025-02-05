import type { App, TFile } from 'obsidian'
import type BrowserHistoryPlugin from './main'
import { addDays, differenceInDays, format, startOfDay, subDays } from 'date-fns'
import { Notice } from 'obsidian'
import { DBClient } from './db'
import { log } from './utils'

interface CreateDailyNoteOptions {
  date?: Date
  overwrite?: boolean
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
    this.db = await DBClient.load({
      sqlitePath: this.plugin.settings.sqlitePath,
    })
  }

  async createDailyNotes() {
    const today = startOfDay(new Date())
    const _fromDate = this.plugin.settings.fromDate
    const fromDate = _fromDate ? new Date(`${_fromDate} 00:00:00`) : today
    const dayCount = differenceInDays(today, fromDate) + 1
    const dates = Array.from({ length: dayCount })
      .map((_, i) => subDays(today, i))
    const files: TFile[] = []

    for (const date of dates) {
      const path = await this.createDailyNote({ date })
      if (path)
        files.push(path)
    }

    new Notice(`Created ${files.length} notes`)
  }

  createDailyNote(options?: CreateDailyNoteOptions) {
    try {
      return this._createDailyNote(options)
    }
    catch (e) {
      new Notice(`[Browser History] ${e}`)
    }
  }

  async _createDailyNote(options?: CreateDailyNoteOptions) {
    const { date, overwrite } = {
      date: startOfDay(new Date()),
      ...options,
    }

    const title = format(date, 'yyyy-MM-dd')
    const path = [this.plugin.settings.folderPath, `${title}.md`].join('/')
    const file = this.app.vault.getAbstractFileByPath(path)

    // return if already exists
    if (file && !overwrite) {
      log(`already exists: ${path}`)
      return
    }

    const records = this.db.getUrls({
      fromDate: date,
      toDate: addDays(date, 1),
    })

    // return if no history
    if (!records.length) {
      log(`no history for ${title}`)
      return
    }

    const content = records.map((v) => {
      const timestamp = format(new Date(v.last_visit_time as number), 'HH:mm')
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

    let file = this.app.vault.getAbstractFileByPath(path) as TFile | null
    if (!file)
      file = await this.app.vault.create(path, data)
    else
      await this.app.vault.modify(file, data)
    return file
  }
}
