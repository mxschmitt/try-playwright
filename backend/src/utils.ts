import { VM } from 'vm2'
import playwright from 'playwright-core'
import fs from 'fs'
import chokidar from 'chokidar';
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import mimeTypes from 'mime-types'

const allowedFileExtensions: string[] = [
  ".png",
  ".pdf"
]

const FILE_DELETION_TIME = 60 * 1000

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const runUntrustedCode = async (code: string): Promise<APIResponse> => {
  if (!code) {
    throw new Error("no code specified")
  }
  if (code.match(/file:/g)) {
    throw new Error('Its not allowed to access local files');
  }

  // remove the async at the beginning
  code = code.replace(/^\(async \(\) => {/, "")
  // remove the brackets at the end
  code = code.replace(/}\)\(\);$/, "")

  code = `
    (async () => {
      try {
        const getCreatedFiles = fileWatcherWrapper()
        ${code}
        return await getCreatedFiles()
      } catch(err) {
        console.error("Runtime error", err)
      }
    })();
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

  // Chromium does not have '--cap-add=SYS_ADMIN' on Heroku, that's why we need
  // to set '--no-sandbox' as default
  playwright.chromium.launch = new Proxy(playwright.chromium.launch, {
    apply: (target, thisArg, [options = {}]) => {
      return target.apply(thisArg, [{
        ...options,
        args: [...(options.args !== undefined ? options.args : []), "--no-sandbox"]
      }])
    }
  });
  const sandbox = {
    playwright,
    console: {
      log: mitmConsoleLog("log"),
      error: mitmConsoleLog("error"),
      warn: mitmConsoleLog("error")
    },
    setTimeout,
    fileWatcherWrapper: () => {
      const files: string[] = []
      const allowedGlobExtensions = allowedFileExtensions.map(extension => extension.replace(/^\./, '')).join(",")
      const watcher = chokidar.watch(`./*{${allowedGlobExtensions}}`, {
        ignored: /node_modules/
      }).on("add", (filePath) => {
        files.push(filePath)
      })
      return async () => {
        await sleep(150)
        watcher.close()
        return files
      }
    }
  };

  const files: string[] = await new VM({
    timeout: 30 * 1000,
    sandbox,
  }).run(code);

  const publicFiles = files ? files.map((filename: string): FileWrapper | undefined => {
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
  }).filter(Boolean) as FileWrapper[] : []

  return {
    files: publicFiles,
    logs: logEntries
  }
}