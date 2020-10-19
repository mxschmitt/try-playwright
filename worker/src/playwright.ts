import path from 'path'
import fs from 'fs'
import { EventEmitter } from 'events'
import { v4 as uuidv4 } from 'uuid'
import { saveVideo, PageVideoCapture } from 'playwright-video'
import playwright, { Browser, WebKitBrowser, ChromiumBrowser, FirefoxBrowser, Page as PageType, LaunchOptions, BrowserContextOptions, BrowserContext, ChromiumBrowserContext } from 'playwright'
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

const dir2Filesizes = async (dir: string): Promise<Map<string, number>> => {
  const out = new Map<string, number>();
  for (const file of await fs.promises.readdir(dir)) {
    out.set(file, (await fs.promises.stat(path.join(dir, file))).size)
  }
  return out
}

export const registerFileListener = (browserId: string, assetDir: string): (() => Promise<FileWrapper[]>) => {
  const files: FileWrapper[] = []
  const handler = (file: FileWrapper): void => {
    files.push(file)
  }
  fileEmitter.on(browserId, handler)
  return async (): Promise<FileWrapper[]> => {
    fileEmitter.removeListener(browserId, handler)
    let fileStats = await dir2Filesizes(assetDir)
    for (; ;) {
      await new Promise(resolve => setTimeout(resolve, 100))
      const currentStats = await dir2Filesizes(assetDir)
      const changed = [...fileStats.entries()].some(([k, v]) => v !== currentStats.get(k) || currentStats.get(k) === 0)
      if (!changed)
        break
      fileStats = currentStats
    }
    for (const file of await fs.promises.readdir(assetDir)) {
      const ext = path.extname(file)
      const publicPath = path.join("public", uuidv4() + ext)
      await fs.promises.rename(path.join(assetDir, file), publicPath);
      files.push({
        extension: ext,
        filename: path.basename(file),
        publicURL: publicPath
      })
    }
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
    const browserId = this.context().browser()[BROWSER_ID];
    const publicPath = emitNewFile(browserId, options.path)
    const buffer = await superScreenshot.call(this, {
      ...options,
      path: publicPath
    });
    return buffer
  }
  return Buffer.from([]);
}

const superCRPDF: PageType["pdf"] = Page.prototype._pdf;

Page.prototype._pdf = async function (this: PageType, options?: Parameters<typeof superCRPDF>[0]): Promise<Buffer> {
  if (options?.path && superCRPDF) {
    // @ts-ignore
    const browserId = this.context().browser()[BROWSER_ID];
    const publicPath = emitNewFile(browserId, options.path)
    const buffer = await superCRPDF.call(this, {
      ...options,
      path: publicPath
    });
    return buffer
  }
  return Buffer.from([]);
}

const preBrowserLaunch = async (browser: Browser, id: string, assetDir: string): Promise<void> => {
  const originalNewContext = browser.newContext
  browser.newContext = async (contextOptions: BrowserContextOptions = {}): Promise<BrowserContext> => {
    if (contextOptions.videosPath) {
      contextOptions.videosPath = assetDir
    }
    const context = await originalNewContext.apply(browser, [contextOptions])
    return context
  }
  setTimeout(() => {
    browser.close()
    console.log("Closing browser...")
  }, 30 * 1000)
  // @ts-ignore
  browser[BROWSER_ID] = id
}

const pwDirname = path.join(__dirname, "..", "node_modules", "playwright")

export const getPlaywright = (id: string, assetDir: string): typeof playwright => {
  const pw: typeof playwright = setupInProcess(new Playwright(pwDirname, playwrightBrowsers["browsers"]))
  const originalChromiumLaunch = pw.chromium.launch
  pw.chromium.launch = async (options: LaunchOptions = {}): Promise<ChromiumBrowser> => {
    const browser = await originalChromiumLaunch.apply(pw.chromium, [options])
    await preBrowserLaunch(browser, id, assetDir)
    return browser
  }

  const originalWebKitLaunch = pw.webkit.launch
  pw.webkit.launch = async (options: LaunchOptions = {}): Promise<WebKitBrowser> => {
    const browser = await originalWebKitLaunch.apply(pw.webkit, [options])
    await preBrowserLaunch(browser, id, assetDir)
    return browser
  }

  const originalFirefoxLaunch = pw.firefox.launch
  pw.firefox.launch = async (options: LaunchOptions = {}): Promise<FirefoxBrowser> => {
    const browser = await originalFirefoxLaunch.apply(pw.firefox, [options])
    await preBrowserLaunch(browser, id, assetDir)
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