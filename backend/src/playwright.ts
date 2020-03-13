import path from 'path'
import { EventEmitter } from 'events'
import { v4 as uuidv4 } from 'uuid'
import { Browser, WebKitBrowser } from 'playwright-core'
import { Playwright } from 'playwright-core/lib/server/playwright'
import { CRBrowser } from 'playwright-core/lib/chromium/crBrowser';
import { CRPage } from 'playwright-core/lib/chromium/crPage';
import { Page, FirefoxBrowser } from 'playwright-core/lib/api';
import { ScreenshotOptions, PDFOptions } from 'playwright-core/lib/types';
import { BufferType } from 'playwright-core/lib/platform';
import { LaunchOptions } from 'playwright-core/lib/server/browserType';
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

const superScreenshot = Page.prototype.screenshot;

const emitNewFile = (browserId: string, originalFileName: string): string => {
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

Page.prototype.screenshot = async function (options?: ScreenshotOptions): Promise<BufferType> {
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

const superCRPDF = CRPage.prototype.pdf;

CRPage.prototype.pdf = async function (options?: PDFOptions): Promise<BufferType> {
  if (options?.path && superCRPDF) {
    // @ts-ignore
    const browserId = this.page().context()._browser[BROWSER_ID];
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

export const getPlaywright = (id: string): Playwright => {
  const pw = new Playwright({
    downloadPath: path.join(__dirname, "..", "node_modules", "playwright"),
    browsers: ['webkit', 'chromium', 'firefox'],
    respectEnvironmentVariables: false,
  });
  // @ts-ignore
  const originalChromiumLaunch = pw.chromium.launch
  // @ts-ignore
  pw.chromium.launch = async (options: LaunchOptions = {}): Promise<CRBrowser> => {
    const browser = await originalChromiumLaunch.apply(pw.chromium, [{
      ...options,
      args: [...(options.args !== undefined ? options.args : []), "--no-sandbox"]
    }])
    await preBrowserLaunch(browser, id)
    return browser
  }

  // @ts-ignore
  const originalWebKitLaunch = pw.webkit.launch
  // @ts-ignore
  pw.webkit.launch = async (options: LaunchOptions = {}): Promise<WebKitBrowser> => {
    const browser = await originalWebKitLaunch.apply(pw.webkit, [options])
    await preBrowserLaunch(browser, id)
    return browser
  }

  // @ts-ignore
  const originalFirefoxLaunch = pw.firefox.launch
  // @ts-ignore
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