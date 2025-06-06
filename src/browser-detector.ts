/**
 * Browser type enumeration
 */
export enum BrowserType {
  CHROME = 'chrome',
  FIREFOX = 'firefox',
  UNKNOWN = 'unknown',
}

/**
 * Automatically detect browser type from path string
 * @param path Browser history file path
 * @returns Detected browser type
 */
export function detectBrowserType(path: string): BrowserType {
  const lowercasePath = path.toLowerCase()

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
