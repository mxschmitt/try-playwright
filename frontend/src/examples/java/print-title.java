package org.example;

import com.microsoft.playwright.*;

public class PrintTitle {
  public static void main(String[] args) {
    try (Playwright playwright = Playwright.create()) {
      Browser browser = playwright.chromium().launch();
      Page page = browser.newPage();
      page.navigate("http://playwright.dev");
      System.out.println(page.title());
    }
  }
}
