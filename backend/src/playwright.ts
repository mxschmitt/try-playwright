import path from 'path'
import { EventEmitter } from 'events'
import { v4 as uuidv4 } from 'uuid'
import playwright, { Browser, FirefoxBrowser, WebKitBrowser } from 'playwright-core'
import { CRBrowser } from 'playwright-core/lib/chromium/crBrowser';
import { CRPage } from 'playwright-core/lib/chromium/crPage';
import { Page } from 'playwright-core/lib/api';
import { ScreenshotOptions, PDFOptions } from 'playwright-core/lib/types';
import { BufferType } from 'playwright-core/lib/platform';

const BROWSER_ID = Symbol('BROWSER_ID');

const fileEmitter = new EventEmitter()

export const registerFileListener = (browserId: string): (() => FileWrapper[]) => {
  const files: FileWrapper[] = []
  const handler = (file: FileWrapper): void => {
    console.log(`Received file ${file.publicURL} for browser ${browserId}`)
    files.push(file)
  }
  fileEmitter.on(browserId, handler)
  return (): FileWrapper[] => {
    return files
  }
}

const superScreenshot = Page.prototype.screenshot;

Page.prototype.screenshot = async function (options?: ScreenshotOptions): Promise<BufferType> {
  if (options?.path) {
    // @ts-ignore
    const browserId = this.context()._browser[BROWSER_ID];
    const ext = path.extname(options.path)
    const publicPath = path.join("public", uuidv4() + ext)
    const event: FileWrapper = {
      filename: options.path,
      publicURL: publicPath,
      extension: ext
    }
    console.log(`Sending file ${options.path} for browser ${browserId}`)
    fileEmitter.emit(browserId, event)
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
    const ext = path.extname(options.path)
    const publicPath = path.join("public", uuidv4() + ext)
    const event: FileWrapper = {
      filename: options.path,
      publicURL: publicPath,
      extension: ext
    }
    fileEmitter.emit(browserId, event)
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

export const getPlaywright = (id: string): typeof playwright => Object.assign(playwright, {
  chromium: Object.assign(playwright.chromium,
    {
      launch: new Proxy(playwright.chromium.launch, {
        apply: async (target, thisArg, [options = {}]): Promise<CRBrowser> => {
          // Chromium does not have '--cap-add=SYS_ADMIN' on Heroku, that's why we need
          // to set '--no-sandbox' as default
          const browser = await target.apply(thisArg, [{
            ...options,
            args: [...(options.args !== undefined ? options.args : []), "--no-sandbox"]
          }])
          await preBrowserLaunch(browser, id)
          return browser
        }
      })
    }),
  firefox: Object.assign(playwright.firefox,
    {
      launch: new Proxy(playwright.firefox.launch, {
        apply: async (target, thisArg, args): Promise<FirefoxBrowser> => {
          const browser = await target.apply(thisArg, args)
          await preBrowserLaunch(browser, id)
          return browser
        }
      })
    }),
  webkit: Object.assign(playwright.webkit, {
    launch: new Proxy(playwright.webkit.launch, {
      apply: async (target, thisArg, args): Promise<WebKitBrowser> => {
        const browser = await target.apply(thisArg, args)
        await preBrowserLaunch(browser, id)
        return browser
      }
    })
  })
})