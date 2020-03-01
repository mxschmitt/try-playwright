import { VM } from 'vm2'
import playwright, { Browser } from 'playwright-core'
import { VideoCapture } from 'playwright-video'
import fs from 'fs'
import chokidar from 'chokidar';
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import mimeTypes from 'mime-types'
import { CRBrowser } from 'playwright-core/lib/chromium/crBrowser';

const allowedFileExtensions: string[] = [
  ".png",
  ".pdf",
  ".mp4"
]

const FILE_DELETION_TIME = 60 * 1000

const ALLOWED_BROWSERS: BrowserType[] = ["chromium", "firefox", "webkit"]

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const BROWSER_STORE: Record<string, Browser> = {}

export const startBrowsers = async () => {
  await Promise.all(ALLOWED_BROWSERS.map(async (browserName) => {
    BROWSER_STORE[browserName] = await playwright[browserName].launch({
      ...(browserName === "chromium" ? { args: ["--no-sandbox"] } : {})
    });
    // prevent that the user can download the whole browser
    // @ts-ignore
    BROWSER_STORE[browserName].close = () => null
  }))
}

export const runUntrustedCode = async (code: string, browserName: BrowserType): Promise<APIResponse> => {
  if (!code) {
    throw new Error("no code specified")
  }
  if (!ALLOWED_BROWSERS.includes(browserName)) {
    throw new Error("No valid browser specified!")
  }
  if (code.match(/file:/g)) {
    throw new Error('Its not allowed to access local files');
  }

  code = `
    try {
      ${code}
    } catch(err) {
      console.error("Runtime error", err)
    }
  `
  console.log("Running code", code)

  const logEntries: LogEntry[] = []
  // emulates console.log and console.error and redirects it to the stdout and
  // stores it in the logEntries array
  const mitmConsoleLog = (mode: LogMode) => (...args: any[]) => {
    console[mode](...args)
    logEntries.push({
      mode: mode,
      args: args.map(arg => arg.toString ? arg.toString() : arg)
    })
  }
  var capture: VideoCapture | null = null

  const sandbox = {
    browser: new Proxy(BROWSER_STORE[browserName], {
      get: (target, prop, receiver) => {
        if (prop === "newContext" && browserName === "chromium") {
          const newContext = Reflect.get(target, prop, receiver)
          return new Proxy(newContext, {
            apply: async (target, thisArg, argumentList) => {
              const context = await target.apply(thisArg, argumentList)
              context.newPage = new Proxy(context.newPage, {
                apply: async (target, thisArg, argumentList) => {
                  const page = await target.apply(thisArg, argumentList)
                  capture = await VideoCapture.start({
                    browser: BROWSER_STORE[browserName] as CRBrowser,
                    page,
                    savePath: 'video.mp4',
                  });
                  return page
                }
              })
              return context
            }
          })
        }
        return Reflect.get(target, prop, receiver);
      }
    }),
    console: {
      log: mitmConsoleLog("log"),
      error: mitmConsoleLog("error"),
      warn: mitmConsoleLog("error")
    },
    setTimeout,
  };

  const startFileWatcher = (): (() => Promise<string[]>) => {
    const files: string[] = []
    const allowedGlobExtensions = allowedFileExtensions.map(extension => extension.replace(/^\./, '')).join(",")
    const watcher = chokidar.watch(`./*{${allowedGlobExtensions}}`, {
      ignored: /node_modules/
    }).on("add", (filePath) => {
      files.push(filePath)
    })
    return async () => {
      await sleep(150)
      await watcher.close()
      return files
    }
  }

  const stopFileWatcher = startFileWatcher()

  await new VM({
    timeout: 30 * 1000,
    sandbox,
  }).run(code);


  if (capture) {
    console.log("Closing capture")
    // @ts-ignore
    await capture.stop()
    console.log("Closed capture")
  }
  const files = await stopFileWatcher()

  const publicFiles = files.map((filename: string): FileWrapper | undefined => {
    const fileExtension = path.extname(filename)
    if (!allowedFileExtensions.includes(fileExtension)) {
      return
    }
    const newFileName = uuidv4() + fileExtension
    const publicFolder = "public"
    const newFileLocation = path.join(publicFolder, newFileName)
    if (!fs.existsSync(publicFolder)) {
      fs.mkdirSync(publicFolder);
    }
    fs.renameSync(filename, newFileLocation)
    // delete the file after FILE_DELETION_TIME
    setTimeout(() => {
      console.log(`Removing old file '${newFileLocation}'`)
      fs.unlinkSync(newFileLocation)
    }, FILE_DELETION_TIME)
    return {
      publicURL: newFileLocation,
      filename: filename,
      mimetype: mimeTypes.lookup(newFileLocation) || ''
    }
  }).filter(Boolean) as FileWrapper[]

  return {
    files: publicFiles,
    logs: logEntries
  }
}