from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    pixel_5 = p.devices["Pixel 5"]
    browser = p.chromium.launch()
    context = browser.new_context(
        **pixel_5,
        locale="en-US",
        geolocation={"longitude": 12.492507, "latitude": 41.889938},
        permissions=["geolocation"]
    )
    page = context.new_page()
    page.goto("https://www.openstreetmap.org")
    page.click("[aria-label='Show My Location']")
    page.wait_for_timeout(1000)
    page.screenshot(path="colosseum-iphone.png")
    browser.close()
