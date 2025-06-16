import type { App, TFile } from 'obsidian'
import type BrowserHistoryPlugin from './main'
import { dayjs } from './dayjs'
import { DBClient } from './db'
import { log, notify } from './utils'

interface CreateDailyNoteOptions {
  date?: Date
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
      this.db = await DBClient.load({
        sqlitePath: this.plugin.settings.sqlitePath || '',
      })
      return true
    }
    catch (e) {
      notify(`Failed to load: ${e}`)
    }
  }

  async syncNotes() {
    const loaded = await this.load()
    if (!loaded)
      return

    const today = dayjs().startOf('day').toDate()
    const _fromDate = this.plugin.settings.fromDate
    const fromDate = _fromDate ? new Date(`${_fromDate} 00:00:00`) : today
    const dayCount = dayjs(today).diff(fromDate, 'day') + 1
    const dates = Array.from({ length: dayCount })
      .map((_, i) => dayjs(today).subtract(i, 'day').toDate())
    const files: TFile[] = []

    for (const date of dates) {
      const path = await this.syncNote({ date })
      if (path)
        files.push(path)
    }

    this.plugin.settings.fromDate = dayjs(today).format('YYYY-MM-DD')
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
    const { date = dayjs().startOf('day').toDate() } = options || {}

    const template = this.plugin.settings.fileNameFormat || 'YYYY-MM-DD'
    const fileName = dayjs(date).format(template)
    const filePath = [this.plugin.settings.folderPath, `${fileName}.md`].join('/')

    const records = this.db.getUrls({
      fromDate: date,
      toDate: dayjs(date).add(1, 'day').toDate(),
    })

    // return if no history
    if (!records.length) {
      log(`no history for ${fileName}`)
      return
    }

    const content = records.map((v) => {
      const timestamp = dayjs(v.visit_time as number).format('HH:mm')
      return `- ${timestamp} [${v.title}](${v.url})`
    }).join('\n')

    return upsertFile(this.plugin, { filePath, content })
  }
}

export async function checkConnection(plugin: BrowserHistoryPlugin) {
  const { history } = plugin
  const loaded = await history.load()
  if (!loaded)
    return

  const count = history.db.getUrlCount().toLocaleString()
  const data = history.db.getUrls({ limit: 1, desc: false }).at(0)
  const oldestDate = data
    ? dayjs(data.visit_time as number).format('YYYY-MM-DD')
    : ''

  const message = `Successfully connected. ${count} records found${count ? ` (oldest: ${oldestDate})` : ''}`
  notify(message)
}

export async function openTodayHistory(
  plugin: BrowserHistoryPlugin,
  newLeaf?: boolean,
) {
  const { app, history } = plugin
  const loaded = await history.load()
  if (!loaded)
    return

  const todayFile = await history.syncNote()

  if (todayFile)
    app.workspace.getLeaf(newLeaf).openFile(todayFile)
  else
    notify('No history for today.')
}

async function upsertFile(
  plugin: BrowserHistoryPlugin,
  params: {
    filePath: string
    content: string
  },
) {
  const { app } = plugin
  const { filePath, content } = params
  const paths = filePath.split('/')
  const _fileName = paths.pop()
  const folderPath = paths.join('/')

  // create folder if it doesn't exist
  if (folderPath) {
    const folder = app.vault.getFolderByPath(folderPath)
    if (!folder)
      await app.vault.createFolder(folderPath)
  }

  let file = app.vault.getFileByPath(filePath)
  if (!file)
    file = await app.vault.create(filePath, content)
  else
    await app.vault.modify(file, content)
  return file
}
