import codePageScreenshot from './page-screenshot.js?raw';
import codeMobileAndGeolocation from './mobile-and-geolocation.js?raw';
import codeGeneratePdf from './generate-pdf.js?raw';
import codeRecordVideo from './record-video.js?raw';
import codeEvaluateJavaScript from './evaluate-javascript.js?raw';
import codeInterceptRequests from './intercept-requests.js?raw';
import codeInterceptModifyRequests from './intercept-modify-requests.js?raw';
import codeTodoMvc from './todo-mvc.js?raw';
import codeCrawlYCombinator from './crawl-y-combinator.js?raw';

export default [
  {
    id: "page-screenshot",
    title: "Page screenshot",
    description: "This code snippet navigates to whatsmyuseragent.org in Chromium and WebKit, and saves 2 screenshots.",
    code: codePageScreenshot,
  }, {
    id: "mobile-and-geolocation",
    title: "Mobile and geolocation emulation",
    description: "This snippet emulates Mobile Safari on a device at given geolocation, navigates to maps.google.com, performs action and takes a screenshot.",
    code: codeMobileAndGeolocation,
  }, {
    id: "generate-pdf",
    title: "PDF generation with Chromium",
    description: "This example will search for 'Google' on Google and stores the rendered site as a PDF.",
    code: codeGeneratePdf,
  }, {
    id: "record-video",
    title: "Video recording",
    description: "This example navigates to 'github.com', searches for Playwright, and clicks on its first finding.",
    code: codeRecordVideo,
  }, {
    id: "evaluate-javascript",
    title: "JavaScript evaluation in browser context",
    description: "This code snippet navigates to example.com in WebKit, and executes a script in the page context.",
    code: codeEvaluateJavaScript,
  }, {
    id: "intercept-requests",
    title: `Logging network requests`,
    description: "This code snippet sets up network interception for a WebKit page to log all network requests.",
    code: codeInterceptRequests,
  }, {
    id: "intercept-modify-requests",
    title: "Modifying network requests",
    description: "In that example, Try Playwright opens itself and emulates the endpoint for running code by returning a hard-coded image.",
    code: codeInterceptModifyRequests,
  }, {
    id: "todo-mvc",
    title: "End-to-End test a todo application",
    description: "In this example, we are going to make a fully e2e test by asserting the shown data of the todomvc.com application.",
    code: codeTodoMvc,
  }, {
    id:"crawl-y-combinator",
    title: "Crawling a website: Y-Combinator",
    description: "In this example, we are going to execute selectors and get the crawled data which was determined in the context of the browser, back to the main thread.",
    code: codeCrawlYCombinator,
  }
]