import codeWebKitScreenshot from './webkit-screenshot.java?raw';
import codeEvaluateInBrowserContext from './evaluate-in-browser-context.java?raw';
import codeInterceptNetworkRequests from './intercept-network-requests.java?raw';
import codeMobileAndGeolocation from './mobile-and-geolocation.java?raw';
import codePageScreenshot from './page-screenshot.java?raw';
import codePrintTitle from './print-title.java?raw';

export default [
  {
    id: "webkit-screenshot",
    title: "WebKit screenshot",
    description: "This examples navigates to playwright.dev and saves a screenshot to the disk using WebKit.",
    code: codeWebKitScreenshot,
  }, {
    id: "evaluate-in-browser-context",
    title: "Evaluate JavaScript",
    description: "This example evaluates JavaScript on the page and returns the result back to Java.",
    code: codeEvaluateInBrowserContext,
  }, {
    id: "intercept-network-requests",
    title: "Intercept and log network requests",
    description: "This example navigates to todomvc.com and intercepts all network requests by resuming them and printing the URL to the console.",
    code: codeInterceptNetworkRequests,
  }, {
    id: "mobile-and-geolocation",
    title: "Mobile and geolocation emulation",
    description: "This snippet emulates Mobile Safari on a device at given geolocation, navigates to openstreetmap, performs action and takes a screenshot.",
    code: codeMobileAndGeolocation,
  }, {
    id: "page-screenshot",
    title: "Screenshot on Chromium, Firefox, and WebKit",
    description: "This example navigates to playwright.dev and makes a screenshot in all three browsers.",
    code: codePageScreenshot,
  }, {
    id: "print-title",
    title: "Print page title",
    description: "The example navigates to playwright.dev and prints the page tite to the console.",
    code: codePrintTitle,
  },
]