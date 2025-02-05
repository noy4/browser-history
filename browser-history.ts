import type BrowserHistoryPlugin from 'main'
import type { App, TFile } from 'obsidian'
import type { QueryExecResult, SqlValue } from 'sql.js'
import * as fs from 'node:fs'
import { addMonths, format, startOfDay, startOfMonth, subMonths } from 'date-fns'
import { Notice } from 'obsidian'
import initSqlJs from 'sql.js'

// @ts-expect-error wasm binary
// eslint-disable-next-line antfu/no-import-dist, antfu/no-import-node-modules-by-path
import sqlWasm from './node_modules/sql.js/dist/sql-wasm.wasm'

// urls
// "id"
// "url"
// "title"
// "visit_count"
// "typed_count"
// "last_visit_time"
// "hidden"

// last_visit_time is in microseconds since 1601-01-01T00:00:00Z
// [sqlite - What is the format of Chrome's timestamps? - Stack Overflow](https://stackoverflow.com/questions/20458406/what-is-the-format-of-chromes-timestamps)
const epoch1970 = new Date('1970-01-01T00:00:00Z')
const epoch1601 = new Date('1601-01-01T00:00:00Z')
const UNIX_EPOCH_OFFSET = epoch1970.getTime() - epoch1601.getTime() // 11644473600000

function toRecords(
  result: QueryExecResult,
): Record<string, SqlValue>[] {
  const { columns, values } = result
  return values.map(row =>
    Object.assign({}, ...row.map((value, index) => ({
      [columns[index]]: value,
    }))),
  )
}

function log(message: string) {
  console.log(`[Browser History] ${message}`)
}

interface CreateNoteParams {
  fromDate?: Date
  toDate?: Date
  skipIfExists?: boolean
}

export class BrowserHistory {
  plugin: BrowserHistoryPlugin
  app: App

  constructor(plugin: BrowserHistoryPlugin) {
    this.plugin = plugin
    this.app = plugin.app
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
      await this.createNote({ fromDate, toDate, skipIfExists: true })
    }
  }

  createNote(params?: CreateNoteParams) {
    try {
      return this._createNote(params)
    }
    catch (e) {
      new Notice(`[Browser History] ${e}`)
    }
  }

  async _createNote(params?: CreateNoteParams) {
    const {
      fromDate = startOfMonth(new Date()),
      toDate,
      skipIfExists,
    } = params || {}

    const SQL = await initSqlJs({ wasmBinary: sqlWasm })
    const dbBuffer = fs.readFileSync(this.plugin.settings.sqlitePath)
    const db = new SQL.Database(dbBuffer)

    const title = format(fromDate, 'yyyy-MM')
    const path = [this.plugin.settings.folderPath, `${title}.md`].join('/')
    log(`create note: ${path}`)

    if (skipIfExists && this.app.vault.getAbstractFileByPath(path)) {
      log(`skip creating note: ${path}`)
      return
    }

    const condition = [
      fromDate && `${fromDate.getTime()} <= last_visit_time`,
      toDate && `last_visit_time < ${toDate.getTime()}`,
    ].filter(Boolean).join(' and ') || 'true'

    const query = `
        select
          *,
          (last_visit_time / 1000 - ${UNIX_EPOCH_OFFSET}) as last_visit_time
        from urls
        where ${condition}
        order by id desc
        limit 50
      `
    const results = db.exec(query)
    const records = results.map(toRecords)[0] || []

    if (records.length === 0) {
      log(`no records found for ${title}`)
      return
    }

    const dayMap = new Map<number, Record<string, SqlValue>[]>()
    for (const row of records) {
      const { last_visit_time } = row
      const date = new Date(Number(last_visit_time))
      const day = startOfDay(date).getTime()
      const dayMapValue = dayMap.get(day) || []
      dayMapValue.push(row)
      dayMap.set(day, dayMapValue)
    }

    const content = [...dayMap].map(([day, rows]) => {
      const formattedDate = format(new Date(Number(day)), 'M/d')
      const formattedRows = rows.map((row) => {
        const { title, url, last_visit_time } = row
        const timestamp = format(new Date(Number(last_visit_time)), 'HH:mm')
        return `- ${timestamp} [${title}](${url})`
      })
      return `## ${formattedDate}\n${formattedRows.join('\n')}`
    }).join('\n\n')

    await this.upsertFile(path, content)
    new Notice('Browser history note created!')
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
}
