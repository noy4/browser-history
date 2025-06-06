import { userInfo } from 'node:os'
import { platform } from 'node:process'

/**
 * Browser type enumeration
 */
export enum BrowserType {
  CHROME = 'chrome',
  FIREFOX = 'firefox',
  BRAVE = 'brave',
  UNKNOWN = 'unknown',
}

/**
 * Automatically detect browser type from path string
 * @param path Browser history file path
 * @returns Detected browser type
 */
export function detectBrowserType(path: string): BrowserType {
  const lowercasePath = path.toLowerCase()

  // Brave detection logic (check before Chrome since Brave uses similar paths)
  if (lowercasePath.includes('brave')
    || lowercasePath.includes('brave-browser')) {
    return BrowserType.BRAVE
  }

  // Chrome detection logic
  if (lowercasePath.includes('chrome')
    || lowercasePath.includes('google-chrome')
    || lowercasePath.includes('history')) {
    return BrowserType.CHROME
  }

  // Firefox detection logic
  if (lowercasePath.includes('firefox')
    || lowercasePath.includes('places.sqlite')) {
    return BrowserType.FIREFOX
  }

  return BrowserType.UNKNOWN
}

/**
 * Get default Chrome history path for current platform
 * @returns Chrome history database path
 */
export function getChromeHistoryPath(): string {
  const username = userInfo().username

  if (platform === 'darwin')
    return `/Users/${username}/Library/Application Support/Google/Chrome/Default/History`

  if (platform === 'win32')
    return `C:\\Users\\${username}\\AppData\\Local\\Google\\Chrome\\User Data\\Default\\History`

  if (platform === 'linux')
    return `/home/${username}/.config/google-chrome/Default/History`

  return ''
}

/**
 * Get default Firefox history path for current platform
 * @returns Firefox history database path
 */
export function getFirefoxHistoryPath(): string {
  const username = userInfo().username

  if (platform === 'darwin')
    return `/Users/${username}/Library/Application Support/Firefox/Profiles/*/places.sqlite`

  if (platform === 'win32')
    return `C:\\Users\\${username}\\AppData\\Roaming\\Mozilla\\Firefox\\Profiles\\*\\places.sqlite`

  if (platform === 'linux')
    return `/home/${username}/.mozilla/firefox/*/places.sqlite`

  return ''
}

/**
 * Get default Brave history path for current platform
 * @returns Brave history database path
 */
export function getBraveHistoryPath(): string {
  const username = userInfo().username

  if (platform === 'darwin')
    return `/Users/${username}/Library/Application Support/BraveSoftware/Brave-Browser/Default/History`

  if (platform === 'win32')
    return `C:\\Users\\${username}\\AppData\\Local\\BraveSoftware\\Brave-Browser\\User Data\\Default\\History`

  if (platform === 'linux')
    return `/home/${username}/.config/BraveSoftware/Brave-Browser/Default/History`

  return ''
}

/**
 * Get default browser path based on browser type
 * @param browserType Browser type to get path for
 * @returns Default path for the specified browser
 */
export function getDefaultBrowserPath(browserType?: BrowserType): string {
  switch (browserType) {
    case BrowserType.CHROME:
      return getChromeHistoryPath()
    case BrowserType.FIREFOX:
      return getFirefoxHistoryPath()
    case BrowserType.BRAVE:
      return getBraveHistoryPath()
    default:
      return getChromeHistoryPath()
  }
}
