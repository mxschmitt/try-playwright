import codeScreenshotSync from './screenshot-sync.py?raw';
import codeScreenshotAsync from './screenshot-async.py?raw';
import codeEvaluateJavaScript from './evaluate-javascript.py?raw';
import codeInterceptNetworkRequests from './intercept-network-requests.py?raw';
import codeMobileAndGeolocationEmulation from './mobile-and-geolocation-emulation.py?raw';
export default [
  {
    id: "screenshot-sync",
    title: "Screenshot Sync",
    description: "This example navigates to playwright.dev and saves a screenshot of the page to the disk with the Sync API.",
    code: codeScreenshotSync,
  },{
    id: "screenshot-async",
    title: "Screenshot with Async API",
    description: "This example navigates to playwright.dev and saves a screenshot of the page to the disk with the Async API.",
    code: codeScreenshotAsync,
  },
  {
    id: "evaluate-javascript",
    title: "JavaScript evaluation",
    description: "This example evaluates JavaScript on the page and returns the result back to Python.",
    code: codeEvaluateJavaScript,
  }, {
    id: "intercept-network-requests",
    title: "Intercept and log network requests",
    description: "This example navigates to todomvc.com and intercepts all network requests by continuing them and printing the URL to the console.",
    code: codeInterceptNetworkRequests,
  }, {
    id: "mobile-and-geolocation-emulation",
    title: "Mobile and geolocation emulation",
    description: "This snippet emulates Mobile Safari on a device at given geolocation, navigates to maps.google.com, performs action and takes a screenshot.",
    code: codeMobileAndGeolocationEmulation,
  }
]