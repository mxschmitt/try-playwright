import { VM } from 'vm2'
import playwright from 'playwright-core'
import fs from 'fs'
import chokidar from 'chokidar';
import path from 'path'
import { v4 as uuidv4 } from 'uuid'

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface ResponseObject {
  logs: LogEntry[]
  files: string[]
}

type LogMode = "log" | "error"

interface LogEntry {
  mode: LogMode,
  args: any
}

export const runUntrustedCode = async (code: string): Promise<ResponseObject> => {
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
      const watcher = chokidar.watch("./*{png,jpeg,jpg}", {
        ignored: /node_modules/
      }).on("add", (filePath) => {
        files.push(filePath)
      })
      return async () => {
        await sleep(100)
        watcher.close()
        return files
      }
    }
  };

  const files: string[] = await new VM({
    timeout: 30 * 1000,
    sandbox,
  }).run(code);

  const publicFiles = files ? files.map((filename: string) => {
    const fileExtension = path.extname(filename)
    if (fileExtension !== ".png") {
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
    return newFileLocation
  }).filter(Boolean) as string[] : []

  return {
    files: publicFiles,
    logs: logEntries
  }
}