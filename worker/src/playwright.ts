import path from 'path'
import fs from 'fs'
import os from 'os'
import { EventEmitter } from 'events'
import { v4 as uuidv4 } from 'uuid'
import playwright, { Browser, WebKitBrowser, ChromiumBrowser, FirefoxBrowser, Page as PageType, LaunchOptions, BrowserContextOptions, BrowserContext } from 'playwright'
// @ts-ignore
import { Page } from 'playwright/lib/client/page';
import fetch from 'node-fetch'
import FormData from 'form-data'

const fileEmitter = new EventEmitter()

const uploadFiles = async (files: RegisteredFile[]): Promise<FileWrapper[]> => {
  if (files.length === 0)
    return []
  const form = new FormData();
  let i = 0
  for (const file of files) {
    const content = await fs.promises.readFile(file.filePath)
    form.append(`file-${i}`, content, {
      filename: file.fileName,
    });
    i++
  }
  const resp = await fetch(`${process.env.FILE_SERVICE_URL}/api/v1/file/upload`, {
    body: form,
    method: "POST",
  })
  if (!resp.ok) {
    throw new Error("could not upload file: " + await resp.text())
  }
  return await resp.json()
}

const dir2Filesizes = async (dir: string): Promise<Map<string, number>> => {
  const out = new Map<string, number>();
  for (const file of await fs.promises.readdir(dir)) {
    out.set(file, (await fs.promises.stat(path.join(dir, file))).size)
  }
  return out
}

type RegisteredFile = {
  fileName: string
  filePath: string
}

export const registerFileListener = (assetDir: string): (() => Promise<FileWrapper[]>) => {
  const files: RegisteredFile[] = []
  const handler = (file: RegisteredFile): number => files.push(file)
  fileEmitter.on("created", handler)
  return async (): Promise<FileWrapper[]> => {
    let fileStats = await dir2Filesizes(assetDir)
    for (; ;) {
      await new Promise(resolve => setTimeout(resolve, 100))
      const currentStats = await dir2Filesizes(assetDir)
      const changed = [...fileStats.entries()].some(([k, v]) => v !== currentStats.get(k) || currentStats.get(k) === 0)
      if (!changed)
        break
      fileStats = currentStats
    }
    return [
      ...await uploadFiles(files),
      ...await uploadFiles(((await fs.promises.readdir(assetDir)).map(file => ({
        fileName: file,
        filePath: path.join(assetDir, file)
      })
      )))
    ]
  }
}

const superScreenshot: PageType["screenshot"] = Page.prototype.screenshot;

export const emitNewFile = (originalFileName: string): string => {
  const ext = path.extname(originalFileName)
  const mockPath = path.join(os.tmpdir(), uuidv4() + ext)
  fileEmitter.emit("created", {
    fileName: originalFileName,
    filePath: mockPath
  })
  return mockPath
}

Page.prototype.screenshot = async function (this: PageType, options?: Parameters<typeof superScreenshot>[0]): Promise<Buffer> {
  if (options?.path) {
    // @ts-ignore
    const publicPath = emitNewFile(options.path)
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
    const publicPath = emitNewFile(options.path)
    const buffer = await superCRPDF.call(this, {
      ...options,
      path: publicPath
    });
    return buffer
  }
  return Buffer.from([]);
}

const preBrowserLaunch = async (browser: Browser, assetDir: string): Promise<void> => {
  const originalNewContext = browser.newContext
  browser.newContext = async (contextOptions: BrowserContextOptions = {}): Promise<BrowserContext> => {
    if (contextOptions.recordVideo) {
      contextOptions.recordVideo = {
        ...contextOptions.recordVideo,
        dir: assetDir
      }
    }
    const context = await originalNewContext.apply(browser, [contextOptions])
    return context
  }
}

const addProxyOptions = (options: LaunchOptions): LaunchOptions => {
  return {
    ...options,
    proxy: {
      server: process.env.WORKER_HTTP_PROXY!
    }
  }
}

export const getPlaywright = (assetDir: string): typeof playwright => {
  const originalChromiumLaunch = playwright.chromium.launch
  playwright.chromium.launch = async (options: LaunchOptions): Promise<ChromiumBrowser> => {
    const browser = await originalChromiumLaunch.apply(playwright.chromium, [addProxyOptions(options)])
    await preBrowserLaunch(browser, assetDir)
    return browser
  }

  const originalWebKitLaunch = playwright.webkit.launch
  playwright.webkit.launch = async (options: LaunchOptions): Promise<WebKitBrowser> => {
    const browser = await originalWebKitLaunch.apply(playwright.webkit, [addProxyOptions(options)])
    await preBrowserLaunch(browser, assetDir)
    return browser
  }

  const originalFirefoxLaunch = playwright.firefox.launch
  playwright.firefox.launch = async (options: LaunchOptions): Promise<FirefoxBrowser> => {
    const browser = await originalFirefoxLaunch.apply(playwright.firefox, [addProxyOptions(options)])
    await preBrowserLaunch(browser, assetDir)
    return browser
  }

  return playwright
}
