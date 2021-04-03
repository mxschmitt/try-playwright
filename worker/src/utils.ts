import { VM } from 'vm2'
import tmp from 'tmp'

import { getPlaywright, registerFileListener } from "./playwright"

const PLAYWRIGHT_VERSION = (process.env.npm_package_dependencies_playwright || "").replace(/[\^|=]/, "")

export const runUntrustedCode = async (code: string): Promise<SuccessExecutionResponse> => {
  if (!code) {
    throw new Error("no code specified")
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

  const assetDir = tmp.dirSync();

  const getFiles = registerFileListener(assetDir.name)

  const sandbox = {
    require: (packageName: string): unknown => {
      switch (packageName) {
        case "playwright":
        case "playwright-core":
        case "playwright-chromium":
        case "playwright-firefox":
        case "playwright-webkit":
          return getPlaywright(assetDir.name)
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

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  let unhandledRejectionPromiseReject: ((reason: string) => void) = () => { }
  const unhandledRejectionPromise = new Promise((resolve, reject) => unhandledRejectionPromiseReject = reject)
  const uncaughtExceptionHandler = (err: Error) => {
    unhandledRejectionPromiseReject(err.message)
  }
  process.once('uncaughtException', uncaughtExceptionHandler);

  const vm = new VM({
    timeout: 30 * 1000,
    sandbox,
  })

  await Promise.race([
    unhandledRejectionPromise,
    vm.run(code)
  ]);

  const files = await getFiles()

  return {
    success: true,
    version: PLAYWRIGHT_VERSION,
    files,
    logs: logEntries
  }
}