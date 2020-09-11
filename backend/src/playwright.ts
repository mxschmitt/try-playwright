import path from 'path'
import { EventEmitter } from 'events'
import { v4 as uuidv4 } from 'uuid'
import { saveVideo, PageVideoCapture } from 'playwright-video'
import playwright, { Browser, WebKitBrowser, ChromiumBrowser, FirefoxBrowser, Page as PageType, LaunchOptions } from 'playwright'
// @ts-ignore
import { Playwright } from 'playwright/lib/server/playwright'
// @ts-ignore
import { Page } from 'playwright/lib/client/page';
// @ts-ignore
import playwrightBrowsers from 'playwright/browsers.json';
// @ts-ignore
import { setupInProcess } from 'playwright/lib/inprocess'

const BROWSER_ID = Symbol('BROWSER_ID');

const fileEmitter = new EventEmitter()

export const registerFileListener = (browserId: string): (() => FileWrapper[]) => {
  const files: FileWrapper[] = []
  const handler = (file: FileWrapper): void => {
    files.push(file)
  }
  fileEmitter.on(browserId, handler)
  return (): FileWrapper[] => {
    fileEmitter.removeListener(browserId, handler)
    return files
  }
}

const superScreenshot: PageType["screenshot"] = Page.prototype.screenshot;

export const emitNewFile = (browserId: string, originalFileName: string): string => {
  const ext = path.extname(originalFileName)
  const publicPath = path.join("public", uuidv4() + ext)
  const event: FileWrapper = {
    filename: originalFileName,
    publicURL: publicPath,
    extension: ext
  }
  fileEmitter.emit(browserId, event)
  return publicPath
}


Page.prototype.screenshot = async function (this: PageType, options?: Parameters<typeof superScreenshot>[0]): Promise<Buffer> {
  if (options?.path) {
    // @ts-ignore
    const browserId = this.context()._browser[BROWSER_ID];
    const publicPath = emitNewFile(browserId, options.path)
    const buffer = await superScreenshot.call(this, {
      ...options,
      path: publicPath
    });
    return buffer
  }
  return Buffer.from([]);
}

const superCRPDF: PageType["pdf"] = Page.prototype.pdf;

Page.prototype._pdf = async function (this: PageType, options?: Parameters<typeof superCRPDF>[0]): Promise<Buffer> {
  if (options?.path && superCRPDF) {
    // @ts-ignore
    const browserId = this._page.context()._browser[BROWSER_ID];
    const publicPath = emitNewFile(browserId, options.path)
    const buffer = await superCRPDF.call(this, {
      ...options,
      path: publicPath
    });
    return buffer
  }
  return Buffer.from([]);
}

const preBrowserLaunch = async (browser: Browser, id: string): Promise<void> => {
  setTimeout(() => {
    if (browser.isConnected()) {
      browser.close()
      console.log("Browser was closed because it was not closed in the VM")
    }
  }, 30 * 1000)
  // @ts-ignore
  browser[BROWSER_ID] = id
}

const pwDirname = path.join(__dirname, "..", "node_modules", "playwright")

export const getPlaywright = (id: string): typeof playwright => {
  const pw: typeof playwright = setupInProcess(new Playwright(pwDirname, playwrightBrowsers["browsers"]))

  const originalChromiumLaunch = pw.chromium.launch
  pw.chromium.launch = async (options: LaunchOptions = {}): Promise<ChromiumBrowser> => {
    const browser = await originalChromiumLaunch.apply(pw.chromium, [options])
    await preBrowserLaunch(browser, id)
    return browser
  }

  const originalWebKitLaunch = pw.webkit.launch
  pw.webkit.launch = async (options: LaunchOptions = {}): Promise<WebKitBrowser> => {
    const browser = await originalWebKitLaunch.apply(pw.webkit, [options])
    await preBrowserLaunch(browser, id)
    return browser
  }

  const originalFirefoxLaunch = pw.firefox.launch
  pw.firefox.launch = async (options: LaunchOptions = {}): Promise<FirefoxBrowser> => {
    const browser = await originalFirefoxLaunch.apply(pw.firefox, [options])
    await preBrowserLaunch(browser, id)
    return browser
  }

  return pw
}

export const getPlaywrightVideo = (browserId: string): unknown => {
  return {
    saveVideo: (page: Page, path: string): Promise<PageVideoCapture> => {
      const publicPath = emitNewFile(browserId, path)
      return saveVideo(page, publicPath)
    }
  }
}