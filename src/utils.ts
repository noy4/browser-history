import { Notice } from 'obsidian'

const messageHeader = '[Browser History]'

export function log(message: string) {
  console.log(`${messageHeader} ${message}`)
}

type Result<T> = {
  data: T
  error: null
} | {
  data: null
  error: Error
}

export function wrap<T>(fn: () => T): Result<T> {
  try {
    const data = fn()
    return { data, error: null }
  }
  catch (e) {
    return { data: null, error: e }
  }
}

export class BrowserHistoryNotice extends Notice {
  constructor(message: string) {
    super(`${messageHeader} ${message}`)
  }
}

export function notify(message: string) {
  new BrowserHistoryNotice(message)
}
