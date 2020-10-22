import { VM } from 'vm2'
import tmp from 'tmp'
import { v4 as uuidv4 } from 'uuid'

import { getPlaywright, getPlaywrightVideo, registerFileListener } from "./playwright"

// eslint-disable-next-line @typescript-eslint/no-var-requires
const packageJson = require("../package.json")

const PLAYWRIGHT_VERSION = packageJson.dependencies["playwright"]

export const runUntrustedCode = async (code: string): Promise<APIResponse> => {
  if (!code) {
    throw new Error("no code specified")
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mitmConsoleLog = (mode: LogMode) => (...args: any[]): void => {
    console[mode](...args)
    logEntries.push({
      mode: mode,
      args: args.map(arg => arg?.toString ? arg.toString() : arg)
    })
  }

  const browserId = uuidv4()

  const assetDir = tmp.dirSync();

  const getFiles = registerFileListener(browserId, assetDir.name)

  const sandbox = {
    require: (packageName: string): unknown => {
      switch (packageName) {
        case "playwright-video":
          return getPlaywrightVideo(browserId)
        case "playwright":
        case "playwright-core":
        case "playwright-chromium":
        case "playwright-firefox":
        case "playwright-webkit":
          return getPlaywright(browserId, assetDir.name)
        default:
          throw new Error(`Package ${packageName} not recognized`)
      }
    },
    console: {
      log: mitmConsoleLog("log"),
      error: mitmConsoleLog("error"),
      warn: mitmConsoleLog("error")
    },
    setTimeout,
  };

  const executionStart = new Date().getTime()

  const vm = new VM({
    timeout: 30 * 1000,
    sandbox,
  })

  await vm.run(code);

  const files = await getFiles()

  return {
    version: PLAYWRIGHT_VERSION,
    duration: Math.abs(new Date().getTime() - executionStart),
    files,
    logs: logEntries
  }
}