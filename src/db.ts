import type { Database, QueryExecResult, SqlValue } from 'sql.js'
import * as fs from 'node:fs'
import initSqlJs from 'sql.js'

// @ts-expect-error wasm binary
// eslint-disable-next-line antfu/no-import-dist, antfu/no-import-node-modules-by-path
import sqlWasm from '../node_modules/sql.js/dist/sql-wasm.wasm'

// urls
// "id"
// "url"
// "title"
// "visit_count"
// "typed_count"
// "last_visit_time"
// "hidden"

/**
 * Calculates the Unix epoch offset in milliseconds.
 *
 * ref. [sqlite - What is the format of Chrome's timestamps? - Stack Overflow](https://stackoverflow.com/questions/20458406/what-is-the-format-of-chromes-timestamps)
 *
 * @returns {number} The Unix epoch offset.
 */
function getUnixEpochOffset() {
  const epoch1970 = new Date('1970-01-01T00:00:00Z')
  const epoch1601 = new Date('1601-01-01T00:00:00Z')
  return epoch1970.getTime() - epoch1601.getTime() // 11644473600000
}

const UNIX_EPOCH_OFFSET = getUnixEpochOffset()

/**
 * Converts a Chrome timestamp (microseconds since 1601-01-01) to a Unix timestamp (milliseconds since 1970-01-01).
 * @param {number} chromeTimestamp The Chrome timestamp in microseconds.
 * @returns {number} The Unix timestamp in milliseconds.
 */
function chromeTimeToUnixTime(chromeTimestamp: number) {
  return chromeTimestamp / 1000 - UNIX_EPOCH_OFFSET
}

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
  limit?: number
  desc?: boolean
}

interface LoadOptions {
  sqlitePath: string
}

export class DBClient {
  db: Database

  constructor(db: Database) {
    this.db = db
  }

  static async load(options: LoadOptions) {
    const SQL = await initSqlJs({ wasmBinary: sqlWasm })
    const dbBuffer = fs.readFileSync(options.sqlitePath)
    const db = new SQL.Database(dbBuffer)
    db.create_function('unix', chromeTimeToUnixTime)
    return new DBClient(db)
  }

  getUrls(params: GetUrlsParams) {
    const { fromDate, toDate, limit, desc = true } = params
    const whereClause = [
      'last_visit_time != 0', // broken data?
      fromDate && `${fromDate.getTime()} <= unix(last_visit_time)`,
      toDate && `unix(last_visit_time) < ${toDate.getTime()}`,
    ].filter(Boolean).join(' and ')

    const query = `
      select
        *,
        unix(last_visit_time) as last_visit_time
      from urls
      ${whereClause ? `where ${whereClause}` : ''}
      order by last_visit_time ${desc ? 'desc' : 'asc'}
      ${limit ? `limit ${limit}` : ''}
    `
    const results = this.db.exec(query)
    const records = results.map(toRecords)[0] || []
    return records
  }
}
