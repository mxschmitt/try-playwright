import { VM } from 'vm2'
import playwright from 'playwright-core'
import fs from 'fs'
import chokidar from 'chokidar';

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
  if (code.match(/file:/g)) {
    throw new Error('Its not allowed to access local files');
  }

  code = `
        const browser = await playwright.chromium.launch();
        const context = await browser.newContext();
        const page = await context.newPage();
        await page.goto('http://whatsmyuseragent.org/');
        await page.screenshot({ path: "example.png" });
        const userAgent = await page.$eval(".user-agent > .intro-text", x => x.innerText)
        console.log(userAgent)
        await browser.close();
  `

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

  const filesContent = files.map((filename: string) => {
    const buffer = fs.readFileSync(filename)
    fs.unlinkSync(filename);
    return buffer.toString("base64")
  })

  return {
    files: filesContent,
    logs: logEntries
  }
}