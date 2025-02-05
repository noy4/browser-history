import type { Database, QueryExecResult, SqlValue } from 'sql.js'
import * as fs from 'node:fs'
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

interface GetUrlsParams {
  fromDate?: Date
  toDate?: Date
}

interface SqlJsOptions {
  sqlitePath: string
}

export class DBClient {
  db: Database

  constructor(db: Database) {
    this.db = db
  }

  static async load(options: SqlJsOptions) {
    const SQL = await initSqlJs({ wasmBinary: sqlWasm })
    const dbBuffer = fs.readFileSync(options.sqlitePath)
    const db = new SQL.Database(dbBuffer)
    return new DBClient(db)
  }

  getUrls(params?: GetUrlsParams) {
    const { fromDate, toDate } = params || {}
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
    const results = this.db.exec(query)
    const records = results.map(toRecords)[0] || []
    return records
  }
}
