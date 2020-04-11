import path from 'path'
import { EventEmitter } from 'events'
import { v4 as uuidv4 } from 'uuid'
import playwright from 'playwright-core'
import { Browser, WebKitBrowser, ChromiumBrowser, FirefoxBrowser, Page as PageType } from 'playwright-core'
// @ts-ignore
import { Playwright } from 'playwright-core/lib/server/playwright'
// @ts-ignore
import { CRPage } from 'playwright-core/lib/chromium/crPage';
// @ts-ignore
import { Page } from 'playwright-core/lib/api';
// @ts-ignore
import { downloadOptionsFromENV } from 'playwright-core/download-browser';

import { saveVideo, PageVideoCapture } from 'playwright-video'

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


Page.prototype.screenshot = async function (this: PageType, options?: any): Promise<Buffer> {
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

const superCRPDF: PageType["pdf"] = CRPage.prototype.pdf;

CRPage.prototype.pdf = async function (this: PageType, options?: any): Promise<Buffer> {
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
const crExecutablePath = downloadOptionsFromENV(pwDirname, 'chromium').executablePath
const ffExecutablePath = downloadOptionsFromENV(pwDirname, 'firefox').executablePath
const wkExecutablePath = downloadOptionsFromENV(pwDirname, 'webkit').executablePath

export const getPlaywright = (id: string): typeof playwright => {
  const pw: typeof playwright = new Playwright({
    browsers: ['webkit', 'chromium', 'firefox'],
  });
  // @ts-ignore
  pw.chromium._executablePath = crExecutablePath;
  // @ts-ignore
  pw.webkit._executablePath = wkExecutablePath;
  // @ts-ignore
  pw.firefox._executablePath = ffExecutablePath;

  const originalChromiumLaunch = pw.chromium.launch
  pw.chromium.launch = async (options: any = {}): Promise<ChromiumBrowser> => {
    const browser = await originalChromiumLaunch.apply(pw.chromium, [{
      ...options,
      args: [...(options.args !== undefined ? options.args : []), "--no-sandbox"]
    }])
    await preBrowserLaunch(browser, id)
    return browser
  }

  const originalWebKitLaunch = pw.webkit.launch
  pw.webkit.launch = async (options: any = {}): Promise<WebKitBrowser> => {
    const browser = await originalWebKitLaunch.apply(pw.webkit, [options])
    await preBrowserLaunch(browser, id)
    return browser
  }

  const originalFirefoxLaunch = pw.firefox.launch
  pw.firefox.launch = async (options: any = {}): Promise<FirefoxBrowser> => {
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