import type { TFile } from 'obsidian'
import type BrowserHistoryPlugin from './main'
import { dayjs } from './dayjs'
import { DBClient } from './db'
import { log, notify } from './utils'

/**
 * Loads the browser history database.
 */
export async function loadDB(plugin: BrowserHistoryPlugin) {
  try {
    return plugin.db = await DBClient.load({
      sqlitePath: plugin.settings.sqlitePath || '',
    })
  }
  catch (e) {
    notify(`Failed to load database: ${e}`)
  }
}

/**
 * Tests database connection.
 */
export async function checkConnection(plugin: BrowserHistoryPlugin) {
  const db = await loadDB(plugin)
  if (!db)
    return

  const count = db.getUrlCount().toLocaleString()
  const data = db.getUrls({ limit: 1, desc: false }).at(0)
  const oldestDate = data
    ? dayjs(data.visit_time as number).format('YYYY-MM-DD')
    : ''

  const message = `Successfully connected. ${count} records found${count ? ` (oldest: ${oldestDate})` : ''}`
  notify(message)
}

/**
 * Syncs browser history notes for the specified date range.
 */
export async function syncNotes(plugin: BrowserHistoryPlugin) {
  const db = await loadDB(plugin)
  if (!db)
    return

  const today = dayjs().startOf('day').toDate()
  const _fromDate = plugin.settings.fromDate
  const fromDate = _fromDate ? new Date(`${_fromDate} 00:00:00`) : today
  const dayCount = dayjs(today).diff(fromDate, 'day') + 1
  const dates = Array.from({ length: dayCount })
    .map((_, i) => dayjs(today).subtract(i, 'day').toDate())
  const files: TFile[] = []

  for (const date of dates) {
    const path = await syncNote(plugin, date)
    if (path)
      files.push(path)
  }

  plugin.settings.fromDate = dayjs(today).format('YYYY-MM-DD')
  await plugin.saveSettings()
  log(`synced ${files.length} notes`)
  return files
}

/**
 * Syncs a single history note.
 */
async function syncNote(plugin: BrowserHistoryPlugin, date?: Date) {
  try {
    return await _syncNote(plugin, date)
  }
  catch (e) {
    notify(e)
  }
}

/**
 * _Syncs a single history note.
 */
async function _syncNote(
  plugin: BrowserHistoryPlugin,
  date = dayjs().startOf('day').toDate(),
) {
  const template = plugin.settings.fileNameFormat || 'YYYY-MM-DD'
  const fileName = dayjs(date).format(template)
  const filePath = [plugin.settings.folderPath, `${fileName}.md`].join('/')

  const records = plugin.db.getUrls({
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

  return upsertFile(plugin, { filePath, content })
}

/**
 * Opens today's browser history note.
 */
export async function openTodayHistory(
  plugin: BrowserHistoryPlugin,
  newLeaf?: boolean,
) {
  const { app } = plugin
  const db = await loadDB(plugin)
  if (!db)
    return

  const todayFile = await syncNote(plugin)

  if (todayFile)
    app.workspace.getLeaf(newLeaf).openFile(todayFile)
  else
    notify('No history for today.')
}

/**
 * Creates or updates a file with the specified content.
 */
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
