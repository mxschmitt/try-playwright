from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()

    def log_and_continue_request(route, request):
        print(request.url)
        route.continue_()

    # Log and continue all network requests
    page.route("**/*", log_and_continue_request)

    page.goto("http://todomvc.com")
    browser.close()
