import { VM } from 'vm2'
import fs from 'fs'
import { v4 as uuidv4 } from 'uuid'
import Bottleneck from 'bottleneck'

import { getPlaywright, getPlaywrightVideo, registerFileListener } from "./playwright"

// eslint-disable-next-line @typescript-eslint/no-var-requires
const packageJson = require("../package.json")

const FILE_DELETION_TIME = 60 * 1000
const PLAYWRIGHT_VERSION = packageJson.dependencies["playwright-core"]

const limiter = new Bottleneck({
  maxConcurrent: 5
});

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

  const getFiles = registerFileListener(browserId)

  const sandbox = {
    require: (packageName: string): unknown => {
      switch (packageName) {
        case "playwright-video":
          return getPlaywrightVideo(browserId)
        case "playwright":
        case "playwright-core":
          return getPlaywright(browserId)
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

  await limiter.schedule(() => new VM({
    timeout: 30 * 1000,
    sandbox,
  }).run(code));

  const files = getFiles()

  files.forEach(file => {
    setTimeout(() => {
      console.log(`Removing old file '${file.publicURL}'`)
      fs.unlinkSync(file.publicURL)
    }, FILE_DELETION_TIME)
  })

  return {
    version: PLAYWRIGHT_VERSION,
    duration: Math.abs(new Date().getTime() - executionStart),
    files,
    logs: logEntries
  }
}