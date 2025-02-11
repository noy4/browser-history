import { Notice } from 'obsidian'

const messageHeader = '[Browser History]'

export function log(message: string) {
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
