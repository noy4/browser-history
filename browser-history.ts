import { format, startOfDay } from 'date-fns';
import * as fs from 'fs';
import BrowserHistoryPlugin from 'main';
import { App, Notice, TFile } from 'obsidian';
import initSqlJs, { QueryExecResult, SqlValue } from 'sql.js';

// @ts-ignore
import sqlWasm from './node_modules/sql.js/dist/sql-wasm.wasm';

// last_visit_time is in microseconds since 1601-01-01T00:00:00Z
// [sqlite - What is the format of Chrome's timestamps? - Stack Overflow](https://stackoverflow.com/questions/20458406/what-is-the-format-of-chromes-timestamps)
const epoch1970 = new Date('1970-01-01T00:00:00Z');
const epoch1601 = new Date('1601-01-01T00:00:00Z');
const UNIX_EPOCH_OFFSET = epoch1970.getTime() - epoch1601.getTime(); // 11644473600000

function toRecords(
  result: QueryExecResult
): Record<string, SqlValue>[] {
  const { columns, values } = result
  return values.map((row) =>
    Object.assign({},
      ...row.map((value, index) => ({
        [columns[index]]: value
      })))
  )
}

export class BrowserHistory {
  plugin: BrowserHistoryPlugin
  app: App

  constructor(plugin: BrowserHistoryPlugin) {
    this.plugin = plugin;
    this.app = plugin.app;
  }

  async createBrowserHistoryNote() {
    try {
      const SQL = await initSqlJs({ wasmBinary: sqlWasm })
      const dbBuffer = fs.readFileSync(this.plugin.settings.sqlitePath);
      const db = new SQL.Database(dbBuffer);

      // urls
      // "id"
      // "url"
      // "title"
      // "visit_count"
      // "typed_count"
      // "last_visit_time"
      // "hidden"

      const results = db.exec(`
        select
          *,
          (last_visit_time / 1000 - ${UNIX_EPOCH_OFFSET}) as last_visit_time
        from urls
        order by id desc
        limit 50
      `)
      const records = toRecords(results[0])

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
        const formattedRows = rows.map(row => {
          const { title, url, last_visit_time } = row
          const date = format(new Date(Number(last_visit_time)), 'HH:mm')
          return `- ${date} [${title}](${url})`
        })
        return `## ${formattedDate}\n${formattedRows.join('\n')}`
      }).join('\n\n')

      const title = format(new Date(), 'yyyy-MM')
      const folderPath = 'Browser History'
      const path = `${folderPath}/${title}.md`

      await this.upsertFile(path, content)
      new Notice('Browser history note created!')
    } catch (e) {
      new Notice(`[Browser History] ${e}`)
    }
  }

  async upsertFile(path: string, data: string) {
    const paths = path.split('/')
    const fileName = paths.pop()
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