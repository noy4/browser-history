import { Notice } from 'obsidian'

const messageHeader = '[Browser History]'
const debug = false

export function log(message: string) {
  if (debug)
    console.log(`${messageHeader} ${message}`)
}

export class BrowserHistoryNotice extends Notice {
  constructor(message: string) {
    super(`${messageHeader} ${message}`)
  }
}

export function notify(message: string) {
  new BrowserHistoryNotice(message)
}
