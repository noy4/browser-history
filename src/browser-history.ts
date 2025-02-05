import type { App, TFile } from 'obsidian'
import type BrowserHistoryPlugin from './main'
import { addDays, addMonths, format, startOfDay, startOfMonth, subMonths } from 'date-fns'
import { Notice } from 'obsidian'
import { DBClient } from './db'

function log(message: string) {
  console.log(`[Browser History] ${message}`)
}

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

  async onload() {
    this.db = await DBClient.load({
      sqlitePath: this.plugin.settings.sqlitePath,
    })
  }

  async createNotes() {
    const thisMonth = startOfMonth(new Date())
    const settingFromDate = this.plugin.settings.fromDate
      ? new Date(`${this.plugin.settings.fromDate} 00:00:00`)
      : thisMonth
    const monthDiff = thisMonth.getMonth() - settingFromDate.getMonth()

    const fromToDates = Array.from({ length: monthDiff + 1 })
      .map((_, i) => {
        const fromDate = subMonths(thisMonth, i)
        const toDate = addMonths(fromDate, 1)
        return [fromDate, toDate]
      })

    for (const [fromDate, toDate] of fromToDates) {
      // await this.createNote({ fromDate, toDate, skipIfExists: true })
    }
  }

  async createDailyNotes() {
    const today = startOfDay(new Date())
    const _fromDate = this.plugin.settings.fromDate
    const fromDate = _fromDate ? new Date(_fromDate) : today
    // const
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
    const { date: fromDate, overwrite } = {
      date: startOfDay(new Date()),
      ...options,
    }

    const title = format(fromDate, 'yyyy-MM-dd')
    const path = [this.plugin.settings.folderPath, `${title}.md`].join('/')
    const file = this.app.vault.getAbstractFileByPath(path)

    if (file && !overwrite) {
      log(`already exists: ${path}`)
      return
    }

    const records = this.db.getUrls({
      fromDate,
      toDate: addDays(fromDate, 1),
    })

    if (!records.length) {
      log(`no history for ${title}`)
      return
    }

    const content = records.map((v) => {
      const timestamp = format(new Date(v.last_visit_time as number), 'HH:mm')
      return `- ${timestamp} [${v.title}](${v.url})`
    }).join('\n')

    await this.upsertFile(path, content)
    return true
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

    const file = this.app.vault.getAbstractFileByPath(path)
    if (!file)
      await this.app.vault.create(path, data)
    else
      await this.app.vault.modify(file as TFile, data)
  }

  // createNote(params?: CreateNoteParams) {
  //   try {
  //     return this._createNote(params)
  //   }
  //   catch (e) {
  //     new Notice(`[Browser History] ${e}`)
  //   }
  // }

  // async _createNote(params?: CreateNoteParams) {
  //   let { fromDate, toDate, skipIfExists } = params || {}
  //   fromDate ||= startOfMonth(new Date())

  //   const title = format(fromDate, 'yyyy-MM')
  //   const path = [this.plugin.settings.folderPath, `${title}.md`].join('/')

  //   if (skipIfExists && this.app.vault.getAbstractFileByPath(path)) {
  //     log(`skip creating note: ${path}`)
  //     return
  //   }

  //   const records = this.db.getUrls({ fromDate, toDate })

  //   if (records.length === 0) {
  //     log(`no records found for ${title}`)
  //     return
  //   }

  //   const dayMap = new Map<number, Record<string, SqlValue>[]>()
  //   for (const row of records) {
  //     const { last_visit_time } = row
  //     const date = new Date(Number(last_visit_time))
  //     const day = startOfDay(date).getTime()
  //     const dayMapValue = dayMap.get(day) || []
  //     dayMapValue.push(row)
  //     dayMap.set(day, dayMapValue)
  //   }

  //   const content = [...dayMap].map(([day, rows]) => {
  //     const formattedDate = format(new Date(Number(day)), 'M/d')
  //     const formattedRows = rows.map((row) => {
  //       const { title, url, last_visit_time } = row
  //       const timestamp = format(new Date(Number(last_visit_time)), 'HH:mm')
  //       return `- ${timestamp} [${title}](${url})`
  //     })
  //     return `## ${formattedDate}\n${formattedRows.join('\n')}`
  //   }).join('\n\n')

  //   await this.upsertFile(path, content)
  //   new Notice('Browser history note created!')
  // }
}
