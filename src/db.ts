import type { Database, QueryExecResult, SqlValue } from 'sql.js'
import * as fs from 'node:fs'
import initSqlJs from 'sql.js'

// @ts-expect-error wasm binary
// eslint-disable-next-line antfu/no-import-dist, antfu/no-import-node-modules-by-path
import sqlWasm from '../node_modules/sql.js/dist/sql-wasm.wasm'
import { BrowserType, detectBrowserType } from './browser-detector'

/**
 * Converts a Chrome timestamp (microseconds since 1601-01-01) to a Unix timestamp (milliseconds since 1970-01-01).
 *
 * ref. [sqlite - What is the format of Chrome's timestamps? - Stack Overflow](https://stackoverflow.com/questions/20458406/what-is-the-format-of-chromes-timestamps)
 */
function chromeTimeToUnixTime(chromeTimestamp: number) {
  return chromeTimestamp / 1000 - 11644473600000
}

function firefoxTimeToUnixTime(firefoxTimestamp: number): number {
  return firefoxTimestamp / 1000
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
  browserType: BrowserType

  constructor(db: Database, browserType: BrowserType) {
    this.db = db
    this.browserType = browserType
  }

  static async load(options: LoadOptions) {
    const SQL = await initSqlJs({ wasmBinary: sqlWasm })
    const dbBuffer = fs.readFileSync(options.sqlitePath)
    const db = new SQL.Database(dbBuffer)

    // Determine browser type
    const browserType = detectBrowserType(options.sqlitePath)

    // Register functions based on browser type
    if (browserType === BrowserType.FIREFOX) {
      db.create_function('firefox_unix', firefoxTimeToUnixTime)
    }
    else {
      db.create_function('unix', chromeTimeToUnixTime)
    }

    return new DBClient(db, browserType)
  }

  getUrls(params: GetUrlsParams) {
    const { fromDate, toDate, limit, desc = true } = params

    if (this.browserType === BrowserType.FIREFOX) {
      // Query for Firefox
      const whereClause = [
        fromDate && `${fromDate.getTime()} <= firefox_unix(moz_historyvisits.visit_date)`,
        toDate && `firefox_unix(moz_historyvisits.visit_date) < ${toDate.getTime()}`,
      ].filter(Boolean).join(' and ')

      const query = `
        SELECT moz_places.title, moz_places.url, firefox_unix(moz_historyvisits.visit_date) as visit_time
        FROM moz_historyvisits
        LEFT JOIN moz_places ON moz_historyvisits.place_id = moz_places.id
        ${whereClause ? `WHERE ${whereClause}` : ''}
        ORDER BY moz_historyvisits.visit_date ${desc ? 'DESC' : 'ASC'}
        ${limit ? `LIMIT ${limit}` : ''}
      `
      const results = this.db.exec(query)
      const records = results.map(toRecords)[0] || []
      return records
    }
    else {
      // Query for Chrome
      const whereClause = [
        fromDate && `${fromDate.getTime()} <= unix(visit_time)`,
        toDate && `unix(visit_time) < ${toDate.getTime()}`,
      ].filter(Boolean).join(' and ')

      const query = `
        select
          urls.title,
          urls.url,
          unix(visits.visit_time) as visit_time
        from visits
        left join urls on visits.url = urls.id
        ${whereClause ? `where ${whereClause}` : ''}
        order by visits.id ${desc ? 'desc' : 'asc'}
        ${limit ? `limit ${limit}` : ''}
      `
      const results = this.db.exec(query)
      const records = results.map(toRecords)[0] || []
      return records
    }
  }

  getUrlCount() {
    let query = ''

    if (this.browserType === BrowserType.FIREFOX) {
      // Query for Firefox
      query = `
        SELECT count(*) as count FROM moz_historyvisits
      `
    }
    else {
      // Query for Chrome
      query = `
        select count(*) as count from visits
      `
    }

    const results = this.db.exec(query)
    const records = results.map(toRecords)[0] || []
    return records[0]?.count as number || 0
  }
}
