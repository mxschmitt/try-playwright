interface MetaExample {
  id: string;
  title: string;
  description?: string;
}

export interface Example extends MetaExample {
  code: string;
}

const injectCode = (example: MetaExample): Example => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const code = require(`!!raw-loader!./examples/${example.id}.js`)
  return {
    ...example,
    code: code.default
  }
}

const meta: MetaExample[] = [
  {
    id: "page-screenshot",
    title: "Page screenshot",
    description: "This code snippet navigates to whatsmyuseragent.org in Chromium and WebKit, and saves 2 screenshots.",
  }, {
    id: "mobile-and-geolocation",
    title: "Mobile and geolocation emulation",
    description: "This snippet emulates Mobile Safari on a device at a given geolocation, navigates to maps.google.com, performs action and takes a screenshot.",
  }, {
    id: "generate-pdf",
    title: "PDF generation with Chromium",
    description: "This example will search for 'Google' on Google and stores the rendered site as a PDF.",
  }, {
    id: "record-video",
    title: "Video recording using 'playwright-video'",
    description: "This example navigates to 'example.com', clicks on the first 'a' link and stores it as a video.",
  }, {
    id: "evaluate-javascript",
    title: "JavaScript evaluation in browser context",
    description: "This code snippet navigates to example.com in WebKit, and executes a script in the page context.",
  }, {
    id: "intercept-requests",
    title: `Logging network requests`,
    description: "This code snippet sets up network interception for a WebKit page to log all network requests.",
  }, {
    id: "intercept-modify-requests",
    title: "Modifying network requests",
    description: "In that example Try Playwright opens itself and emulates the endpoint for running code by returning a hard-coded image."
  }, {
    id: "todo-mvc",
    title: "End-to-End test a todo application",
    description: "In this example we are going to make a fully e2e test by asserting the shown data of the todomvc.com application.",
  }
]

export const Examples: Example[] = meta.map(injectCode)
