import type { App, TFile } from 'obsidian'
import type BrowserHistoryPlugin from './main'
import { dayjs } from './dayjs'
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

    const today = dayjs().startOf('day').toDate()
    const _fromDate = this.plugin.settings.fromDate
    const fromDate = _fromDate ? new Date(`${_fromDate} 00:00:00`) : today
    const dayCount = dayjs(today).diff(fromDate, 'day') + 1
    const dates = Array.from({ length: dayCount })
      .map((_, i) => dayjs(today).subtract(i, 'day').toDate())
    const files: TFile[] = []

    for (const date of dates) {
      const path = await this.syncNote({ date, load: false })
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
    const { date, load } = {
      date: dayjs().startOf('day').toDate(),
      load: true,
      ...options,
    }

    if (load)
      await this._load()

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

    return upsertFile(this.app, { filePath, content })
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

async function upsertFile(app: App, params: {
  filePath: string
  content: string
}) {
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
