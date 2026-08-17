import base64
import io
import json
import time
import wave
from playwright.sync_api import sync_playwright


def collect_console(page, bucket):
    page.on("console", lambda message: bucket.append(f"console:{message.type}:{message.text}") if message.type == "error" else None)
    page.on("pageerror", lambda error: bucket.append(f"pageerror:{error}"))
    page.on("response", lambda response: bucket.append(f"response:{response.status}:{response.url}") if response.status >= 400 else None)


def silent_wav_data_url():
    output = io.BytesIO()
    with wave.open(output, "wb") as audio:
        audio.setnchannels(1)
        audio.setsampwidth(2)
        audio.setframerate(32000)
        audio.writeframes(b"\x00\x00" * 96000)
    return "data:audio/wav;base64," + base64.b64encode(output.getvalue()).decode("ascii")


def install_api_mocks(context, blessing_requests, recommendation_requests, speech_requests, speech_delay):
    blessing_index = {"value": 0}

    def mock_blessing(route):
        request = json.loads(route.request.post_data or "{}")
        blessing_requests.append(request)
        blessing_index["value"] += 1
        route.fulfill(
            status=200,
            content_type="application/json",
            headers={"Cache-Control": "no-store"},
            body=json.dumps({
                "blessing": f"第{blessing_index['value']}张签会认真接住此刻，也陪你慢慢向前。",
                "model": "deepseek-v4-pro",
                "speechToken": f"mock-token-{blessing_index['value']}",
            }),
        )

    def mock_speech(route):
        speech_requests.append(json.loads(route.request.post_data or "{}"))
        if speech_delay["seconds"]:
            time.sleep(speech_delay["seconds"])
            speech_delay["seconds"] = 0
        try:
            route.fulfill(
                status=200,
                content_type="application/json",
                headers={"Cache-Control": "no-store"},
                body=json.dumps({"audio": silent_wav_data_url()}),
            )
        except Exception:
            # The browser intentionally aborts the old request in the race test.
            pass

    def mock_recommendation(route):
        request = json.loads(route.request.post_data or "{}")
        recommendation_requests.append(request)
        route.fulfill(
            status=200,
            content_type="application/json",
            headers={"Cache-Control": "no-store"},
            body=json.dumps({
                "recipeId": "coconut-guava-zero",
                "blessing": "这杯柔软刚好接住此刻，也陪你慢慢向前。",
                "model": "deepseek-v4-pro",
                "speechToken": f"recommend-token-{len(recommendation_requests)}",
            }),
        )

    context.route("**/api/blessing", mock_blessing)
    context.route("**/api/recommendation", mock_recommendation)
    context.route("**/api/speech", mock_speech)


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context(viewport={"width": 1440, "height": 1000}, device_scale_factor=1)
    blessing_requests = []
    recommendation_requests = []
    speech_requests = []
    speech_delay = {"seconds": 0}
    install_api_mocks(context, blessing_requests, recommendation_requests, speech_requests, speech_delay)
    context.grant_permissions(["clipboard-read", "clipboard-write"], origin="http://127.0.0.1:4173")
    desktop = context.new_page()
    errors = []
    collect_console(desktop, errors)
    desktop.goto("http://127.0.0.1:4173")
    desktop.wait_for_load_state("networkidle")
    desktop.wait_for_timeout(1300)

    assert desktop.locator(".recipe-card h2").is_visible()
    assert desktop.locator(".category-card").count() == 5
    assert desktop.get_by_role("button", name="按我的心情推荐").is_disabled()
    note = "今天失业了，心里有点难受。"
    desktop.locator("#mood-note-input").fill(note)
    assert desktop.locator(".mood-note__actions > span").inner_text() == f"{len(note)} / 120"
    desktop.get_by_role("button", name="按我的心情推荐").click()
    desktop.locator(".ai-blessing--ready").wait_for(timeout=15000)
    assert desktop.locator(".recipe-card h2").inner_text() == "芭乐晚安云"
    assert desktop.locator(".recipe-card__label").inner_text() == "AI 按此刻心情推荐"
    assert len(desktop.locator(".ai-blessing p").inner_text()) >= 10
    assert recommendation_requests[-1]["moodNote"] == note
    assert len(recommendation_requests[-1]["candidates"]) == 12
    assert recommendation_requests[-1]["localTime"]
    assert len(blessing_requests) == 0

    desktop.locator(".mood-strip button", has_text="甜酷充电").click()
    desktop.locator(".ai-blessing--ready").wait_for(timeout=15000)
    assert "苦巧" in desktop.locator(".category-stamp").inner_text()
    assert desktop.locator(".recipe-card__label").inner_text() == "你的今日特调"
    assert blessing_requests[-1]["moodNote"] == "", "manual selection must not reuse mood text"

    speech_button = desktop.get_by_role("button", name="生成并播放签语")
    assert speech_button.is_visible()
    speech_button.click()
    desktop.get_by_role("button", name="暂停签语").wait_for(timeout=5000)
    assert len(speech_requests) == 1
    assert speech_requests[0]["text"] == desktop.locator(".ai-blessing p").inner_text()
    desktop.get_by_role("button", name="暂停签语").click()
    desktop.get_by_role("button", name="播放签语").wait_for(timeout=3000)
    assert "继续播放" in desktop.locator(".speech-button").inner_text()
    desktop.get_by_role("button", name="播放签语").click()
    desktop.get_by_role("button", name="暂停签语").wait_for(timeout=3000)
    assert len(speech_requests) == 1, "cached speech must not call the API twice"

    desktop.get_by_role("button", name="再摇一杯").click()
    assert desktop.locator(".speech-player").count() == 0
    desktop.locator(".ai-blessing--ready").wait_for(timeout=15000)
    assert len(speech_requests) == 1, "new blessings should remain lazy until clicked"

    speech_delay["seconds"] = 0.8
    desktop.evaluate("""() => {
      document.querySelector('.speech-button').click();
      window.setTimeout(() => document.querySelector('.roll-button').click(), 50);
    }""")
    desktop.locator(".ai-blessing--loading").wait_for(timeout=3000)
    desktop.locator(".ai-blessing--ready").wait_for(timeout=15000)
    assert len(speech_requests) == 2
    assert desktop.get_by_role("button", name="生成并播放签语").is_visible(), "stale audio must not enter the new blessing"

    desktop.get_by_role("button", name="收藏配方").click()
    assert "已暂存" in desktop.locator(".toast").inner_text()
    desktop.wait_for_timeout(450)
    assert desktop.locator(".auth-panel, .auth-setup").is_visible()
    if desktop.locator(".auth-panel").is_visible():
        assert desktop.locator(".auth-panel input").count() == 2
        assert desktop.locator(".auth-tabs button").count() == 2
    else:
        assert desktop.locator(".auth-setup code").count() == 2
    desktop.locator(".sheet__close").click()
    desktop.get_by_role("button", name="登录同步收藏").click()
    assert desktop.locator(".auth-panel, .auth-setup").is_visible()
    desktop.wait_for_timeout(500)
    desktop.screenshot(path="/tmp/heytea-auth-setup.png", full_page=False)
    desktop.locator(".sheet__close").click()
    desktop.get_by_role("button", name="资料说明").click()
    assert desktop.locator(".source-list a").count() == 5
    desktop.locator(".sheet__close").click()
    desktop.screenshot(path="/tmp/heytea-desktop.png", full_page=True)

    mobile_context = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=1)
    install_api_mocks(mobile_context, blessing_requests, recommendation_requests, speech_requests, speech_delay)
    mobile = mobile_context.new_page()
    collect_console(mobile, errors)
    mobile.goto("http://127.0.0.1:4173")
    mobile.wait_for_load_state("networkidle")
    mobile.wait_for_timeout(1300)
    mobile.locator("#mood-note-input").fill("今天终于升职了，想庆祝一下！")
    mobile.get_by_role("button", name="按我的心情推荐").click()
    mobile.locator(".ai-blessing--ready").wait_for(timeout=15000)
    assert "0 咖乳饮" in mobile.locator(".category-stamp").inner_text()
    mobile.get_by_role("button", name="生成并播放签语").click()
    mobile.get_by_role("button", name="暂停签语").wait_for(timeout=5000)
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
