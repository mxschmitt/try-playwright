import codeScreenshot from './screenshot.cs?raw';
import codeGeneratePdf from './generate-pdf.cs?raw';
import codeRequestLogging from './request-logging.cs?raw';
import codeDeviceEmulation from './device-emulation.cs?raw';

export default [
  {
    id: "screenshot",
    title: "Page screenshot",
    description: "This code snippet navigates to the Playwright GitHub repository in WebKit and saves a screenshot.",
    code: codeScreenshot,
  },
  {
    id: "generate-pdf",
    title: "Generate PDF",
    description: "This code snippet navigates to the Playwright GitHub repository and generates a PDF file and saves it to disk.",
    code: codeGeneratePdf,
  },
  {
    id: "request-logging",
    title: "Request and response logging",
    description: "This example will navigate to example.com and log all its request methods and URLs and for the response the status.",
    code: codeRequestLogging,
  },
  {
    id: "device-emulation",
    title: "Device emulation",
    description: "This example emulates a Pixel 2 and creates a screenshot with its screen size.",
    code: codeDeviceEmulation,
  },
]