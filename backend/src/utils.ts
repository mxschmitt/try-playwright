import { VM } from 'vm2'
import playwright from 'playwright-core'
import fs from 'fs'
import chokidar from 'chokidar';
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import mimeTypes from 'mime-types'

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const runUntrustedCode = async (code: string): Promise<APIResponse> => {
  if (!code) {
    throw new Error("no code specified")
  }
  if (code.match(/file:/g)) {
    throw new Error('Its not allowed to access local files');
  }

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
  const mitmConsoleLog = (mode: LogMode) => (...args: any[]) => {
    console[mode](...args)
    logEntries.push({
      mode: mode,
      args: args.map(arg => arg.toString ? arg.toString() : arg)
    })
  }

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
      const watcher = chokidar.watch("./*{png,pdf}", {
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

  const allowedExtensions: string[] = [
    ".png",
    ".pdf"
  ]

  const publicFiles = files ? files.map((filename: string): FileWrapper | undefined => {
    const fileExtension = path.extname(filename)
    if (!allowedExtensions.includes(fileExtension)) {
      return
    }
    const newFileName = uuidv4() + fileExtension
    const publicFolder = "public"
    const newFileLocation = path.join(publicFolder, newFileName)
    if (!fs.existsSync(publicFolder)) {
      fs.mkdirSync(publicFolder);
    }
    fs.renameSync(filename, newFileLocation)
    setTimeout(() => {
      console.log(`Removing old file '${newFileLocation}'`)
      fs.unlinkSync(newFileLocation)
    }, 1000 * 60)
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