package org.example;

import com.microsoft.playwright.*;

public class InterceptNetworkRequests {
  public static void main(String[] args) {
    try (Playwright playwright = Playwright.create()) {
      Browser browser = playwright.webkit().launch();
      BrowserContext context = browser.newContext();
      Page page = context.newPage();
      page.route("**", route -> {
        System.out.println(route.request().url());
        route.resume();
      });
      page.navigate("http://todomvc.com");
    }
  }
}
