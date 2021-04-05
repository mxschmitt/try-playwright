package org.example;

import com.microsoft.playwright.*;

public class EvaluateInBrowserContext {
  public static void main(String[] args) {
    try (Playwright playwright = Playwright.create()) {
      Browser browser = playwright.webkit().launch();
      BrowserContext context = browser.newContext();
      Page page = context.newPage();
      page.navigate("http://www.example.com/");
      Object dimensions = page.evaluate("() => {\n" +
          "  return {\n" +
          "      width: document.documentElement.clientWidth,\n" +
          "      height: document.documentElement.clientHeight,\n" +
          "      deviceScaleFactor: window.devicePixelRatio\n" +
          "  }\n" +
          "}");
      System.out.println(dimensions);
    }
  }
}
