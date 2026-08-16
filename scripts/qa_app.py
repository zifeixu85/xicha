from pathlib import Path
from playwright.sync_api import sync_playwright


def collect_console(page, bucket):
    page.on("console", lambda message: bucket.append(f"console:{message.type}:{message.text}") if message.type == "error" else None)
    page.on("pageerror", lambda error: bucket.append(f"pageerror:{error}"))


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context(viewport={"width": 1440, "height": 1000}, device_scale_factor=1)
    context.grant_permissions(["clipboard-read", "clipboard-write"], origin="http://127.0.0.1:4173")
    desktop = context.new_page()
    errors = []
    collect_console(desktop, errors)
    desktop.goto("http://127.0.0.1:4173")
    desktop.wait_for_load_state("networkidle")
    desktop.wait_for_timeout(1300)

    assert desktop.locator(".recipe-card h2").is_visible()
    assert desktop.locator(".category-card").count() == 5
    original_name = desktop.locator(".recipe-card h2").inner_text()
    desktop.get_by_role("button", name="再摇一杯").click()
    desktop.wait_for_timeout(650)
    assert desktop.locator(".recipe-card h2").inner_text() != original_name

    desktop.get_by_role("button", name="收藏配方").click()
    assert "已经记进小本本" in desktop.locator(".toast").inner_text()
    desktop.get_by_role("button", name="资料说明").click()
    assert desktop.locator(".source-list a").count() == 5
    desktop.locator(".sheet__close").click()
    desktop.screenshot(path="/tmp/heytea-desktop.png", full_page=True)

    mobile_context = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=1)
    mobile = mobile_context.new_page()
    collect_console(mobile, errors)
    mobile.goto("http://127.0.0.1:4173")
    mobile.wait_for_load_state("networkidle")
    mobile.wait_for_timeout(1300)
    mobile.get_by_role("button", name="晚间 0 咖").click()
    mobile.wait_for_timeout(650)
    assert "0 咖乳饮" in mobile.locator(".category-stamp").inner_text()
    overflow = mobile.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
    assert overflow <= 1, f"mobile horizontal overflow: {overflow}px"
    mobile.screenshot(path="/tmp/heytea-mobile.png", full_page=True)

    print(f"desktop_title={desktop.locator('.recipe-card h2').inner_text()}")
    print(f"mobile_title={mobile.locator('.recipe-card h2').inner_text()}")
    print(f"console_errors={len(errors)}")
    if errors:
        print("\n".join(errors))
        raise AssertionError("Browser console contains errors")

    mobile_context.close()
    context.close()
    browser.close()
