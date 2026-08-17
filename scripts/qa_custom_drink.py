import base64
import io
import json
import time
import wave

from playwright.sync_api import sync_playwright


def silent_wav_data_url():
    output = io.BytesIO()
    with wave.open(output, "wb") as audio:
        audio.setnchannels(1)
        audio.setsampwidth(2)
        audio.setframerate(32000)
        audio.writeframes(b"\x00\x00" * 16000)
    return "data:audio/wav;base64," + base64.b64encode(output.getvalue()).decode("ascii")


IMAGE_DATA_URL = "data:image/svg+xml;base64," + base64.b64encode("""
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800">
  <rect width="800" height="800" fill="#dce6bd"/>
  <circle cx="400" cy="370" r="285" fill="#fffaf0" opacity=".75"/>
  <path d="M275 185h250l-32 430q-5 55-55 55h-76q-50 0-55-55z" fill="#d9b46d" stroke="#355c40" stroke-width="12"/>
  <path d="M299 385h202l-15 220q-4 40-45 40h-82q-41 0-45-40z" fill="#9fcf75"/>
  <circle cx="400" cy="485" r="62" fill="#fffaf0" stroke="#355c40" stroke-width="8"/>
  <text x="400" y="510" text-anchor="middle" font-size="74" font-family="serif" fill="#355c40">喜</text>
</svg>
""".encode("utf-8")).decode("ascii")


def collect_errors(page, bucket):
    page.on("console", lambda message: bucket.append(f"console:{message.type}:{message.text}") if message.type == "error" else None)
    page.on("pageerror", lambda error: bucket.append(f"pageerror:{error}"))


class ApiMocks:
    def __init__(self):
        self.custom_requests = []
        self.generation_headers = []
        self.image_starts = 0
        self.poll_counts = {}
        self.frame_polls = 0
        self.video_polls = 0
        self.speech_requests = []

    def install(self, context):
        def custom(route):
            payload = json.loads(route.request.post_data or "{}")
            self.custom_requests.append(payload)
            self.generation_headers.append(route.request.headers.get("authorization"))
            index = len(self.custom_requests)
            route.fulfill(status=200, content_type="application/json", body=json.dumps({
                "drink": {
                    "name": f"晚风青提签{index}",
                    "summary": "绿妍托住青提的清脆，桂花把晚风般的轻盈香气留在杯口。",
                    "tags": ["青提", "花香", "晚风"],
                    "receipt": ["绿妍茶底", "青提鲜果", "桂花露", "弹弹冻"],
                    "sweetness": payload.get("ingredients", {}).get("sweetness", "微微甜"),
                    "temperature": payload.get("ingredients", {}).get("temperature", "少冰"),
                    "imageDescriptor": "safe server image descriptor",
                    "videoDescriptor": "safe server video descriptor",
                },
                "blessing": f"第{index}杯替你收好晚风，也把轻松留给明天。",
                "speechTicket": f"speech-ticket-{index}",
            }, ensure_ascii=False))

        def image_start(route):
            self.image_starts += 1
            self.generation_headers.append(route.request.headers.get("authorization"))
            route.fulfill(status=200, content_type="application/json", body=json.dumps({"taskId": f"image-{self.image_starts}"}))

        def media_task(route):
            self.generation_headers.append(route.request.headers.get("authorization"))
            task_id = route.request.url.split("taskId=")[-1]
            self.poll_counts[task_id] = self.poll_counts.get(task_id, 0) + 1
            count = self.poll_counts[task_id]
            if task_id == "image-1":
                body = {"status": "failed", "error": "画纸被打湿了"}
            elif task_id in ("image-3", "image-5"):
                body = {"status": "processing", "progress": min(80, 10 + count * 7)}
            elif task_id.startswith("frame-"):
                self.frame_polls += 1
                body = {"status": "processing", "progress": 43} if count == 1 else {"status": "completed", "url": IMAGE_DATA_URL}
            elif task_id.startswith("video-"):
                self.video_polls += 1
                body = {"status": "processing", "progress": 52} if count == 1 else {"status": "completed", "url": "https://media.test/drink.mp4"}
            elif count == 1:
                body = {"status": "processing", "progress": 62}
            else:
                body = {"status": "completed", "url": IMAGE_DATA_URL}
            route.fulfill(status=200, content_type="application/json", body=json.dumps(body))

        def frame_start(route):
            self.generation_headers.append(route.request.headers.get("authorization"))
            route.fulfill(status=200, content_type="application/json", body=json.dumps({"taskId": "frame-1"}))

        def video_start(route):
            payload = json.loads(route.request.post_data or "{}")
            assert payload["duration"] == 5
            assert payload["resolution"] == "720p"
            self.generation_headers.append(route.request.headers.get("authorization"))
            route.fulfill(status=200, content_type="application/json", body=json.dumps({"taskId": "video-1"}))

        def speech(route):
            self.speech_requests.append(json.loads(route.request.post_data or "{}"))
            self.generation_headers.append(route.request.headers.get("authorization"))
            route.fulfill(status=200, content_type="application/json", body=json.dumps({"audio": silent_wav_data_url()}))

        context.route("**/api/create-custom-drink", custom)
        context.route("**/api/generate-drink-image", image_start)
        context.route("**/api/media-task?taskId=*", media_task)
        context.route("**/api/generate-video-frame", frame_start)
        context.route("**/api/generate-drink-video", video_start)
        context.route("**/api/speech", speech)
        context.route("https://media.test/**", lambda route: route.fulfill(status=200, content_type="video/mp4", body=b""))


def open_custom(page):
    page.goto("http://127.0.0.1:4173")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1150)
    page.get_by_role("button", name="自创一杯").click()


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    errors = []

    guest_context = browser.new_context(viewport={"width": 1440, "height": 1000})
    guest = guest_context.new_page()
    collect_errors(guest, errors)
    open_custom(guest)
    assert guest.locator(".custom-lock").is_visible()
    assert guest.locator(".locked-media button:disabled").count() == 3
    guest.screenshot(path="/tmp/heytea-custom-locked.png", full_page=True)
    guest.get_by_role("button", name="登录，开始自创").click()
    assert guest.locator(".auth-panel, .auth-setup").is_visible()
    guest.locator(".sheet__close").click()
    guest_context.close()

    mocks = ApiMocks()
    auth_context = browser.new_context(viewport={"width": 1440, "height": 1000}, device_scale_factor=1)
    auth_context.add_init_script("window.__HEY_TEA_QA_USER__ = { id: 'qa-user', name: '配方测试员', email: 'qa@example.test' }")
    mocks.install(auth_context)
    page = auth_context.new_page()
    collect_errors(page, errors)
    open_custom(page)
    assert page.locator(".custom-studio").is_visible()

    page.get_by_role("button", name="绿妍茶底 清香 · 含咖啡因").click()
    page.get_by_role("button", name="源牧 3.8 牛乳 醇厚").click()
    page.get_by_role("button", name="青提鲜果 脆甜").click()
    page.get_by_role("button", name="芒果果肉 明亮").click()
    page.get_by_role("button", name="水蜜桃汁 柔甜").click()
    page.get_by_role("button", name="草莓果肉 酸甜").click()
    assert "最多选择 3 项" in page.locator(".constraint-notice").inner_text()
    page.get_by_role("button", name="水蜜桃汁 柔甜").click()
    page.get_by_role("button", name="香水柠檬 高酸 · 酸性").click()
    assert "鲜乳容易结絮" in page.locator(".constraint-notice").inner_text()
    page.get_by_role("button", name="桂花露 花香").click()
    page.get_by_role("button", name="弹弹冻 Q 弹").click()

    note = "终于结束忙碌的一周，想把晚风和松弛都装进杯子里。"
    page.locator("#custom-drink-note").fill(note)
    page.get_by_role("button", name="创造我的喜茶").click()
    page.locator(".creation-result").wait_for(timeout=5000)
    page.locator(".media-progress--error").wait_for(timeout=5000)
    assert mocks.custom_requests[0]["note"] == note
    assert mocks.custom_requests[0]["ingredients"]["groups"]["base"][0]["id"] == "green-tea"
    page.locator(".media-progress--error").get_by_role("button", name="重试").click()
    page.locator(".generated-visual img").wait_for(timeout=8000)
    assert page.get_by_role("link", name="保存饮品图").is_visible()

    page.get_by_role("button", name="生成并播放自创祝福").click()
    page.get_by_role("button", name="暂停自创祝福").wait_for(timeout=5000)
    assert mocks.speech_requests[0]["token"] == "speech-ticket-1"
    page.get_by_role("button", name="暂停自创祝福").click()

    page.get_by_role("button", name="制作 5 秒宣传片").click()
    page.locator(".video-result video").wait_for(timeout=10000)
    assert page.get_by_role("link", name="打开视频").is_visible()
    assert page.get_by_role("link", name="下载视频").is_visible()
    assert mocks.frame_polls >= 2 and mocks.video_polls >= 2

    page.get_by_role("button", name="重新创作这杯").click()
    page.get_by_text("晚风青提签2", exact=True).wait_for(timeout=5000)
    page.wait_for_timeout(1000)
    old_polls_before = mocks.poll_counts.get("image-3", 0)
    assert old_polls_before >= 1
    page.get_by_role("button", name="重新创作这杯").click()
    page.get_by_text("晚风青提签3", exact=True).wait_for(timeout=5000)
    page.locator(".generated-visual img").wait_for(timeout=8000)
    page.wait_for_timeout(1400)
    assert mocks.poll_counts.get("image-3", 0) == old_polls_before, "stale image polling should stop"
    assert page.get_by_text("晚风青提签2", exact=True).count() == 0, "old result must not overwrite the new creation"
    assert all(value == "Bearer qa-session-token" for value in mocks.generation_headers), mocks.generation_headers
    page.screenshot(path="/tmp/heytea-custom-desktop.png", full_page=True)
    page.get_by_role("button", name="重新创作这杯").click()
    page.get_by_text("晚风青提签4", exact=True).wait_for(timeout=5000)
    page.wait_for_timeout(1000)
    mode_switch_polls = mocks.poll_counts.get("image-5", 0)
    assert mode_switch_polls >= 1
    page.get_by_role("button", name="随机灵感").click()
    page.wait_for_timeout(1400)
    assert mocks.poll_counts.get("image-5", 0) == mode_switch_polls, "switching mode must cancel media polling"

    mobile_mocks = ApiMocks()
    mobile_context = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=1)
    mobile_context.add_init_script("window.__HEY_TEA_QA_USER__ = { id: 'qa-mobile', name: '移动端测试员', email: 'mobile@example.test' }")
    mobile_mocks.install(mobile_context)
    mobile = mobile_context.new_page()
    collect_errors(mobile, errors)
    open_custom(mobile)
    mobile.get_by_role("button", name="随机配料").click()
    mobile.locator("#custom-drink-note").fill("想为今天的小胜利干杯。")
    mobile.get_by_role("button", name="创造我的喜茶").click()
    mobile.locator(".creation-result").wait_for(timeout=5000)
    mobile.locator(".media-progress--error").get_by_role("button", name="重试").click()
    mobile.locator(".generated-visual img").wait_for(timeout=8000)
    overflow = mobile.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
    assert overflow <= 1, f"390px horizontal overflow: {overflow}px"
    mobile.screenshot(path="/tmp/heytea-custom-mobile.png", full_page=True)

    filtered_errors = [item for item in errors if "Failed to load resource" not in item]
    print(f"custom_requests={len(mocks.custom_requests)}")
    print(f"generation_requests={len(mocks.generation_headers)}")
    print(f"desktop_image=/tmp/heytea-custom-desktop.png")
    print(f"mobile_image=/tmp/heytea-custom-mobile.png")
    print(f"console_errors={len(filtered_errors)}")
    if filtered_errors:
        print("\n".join(filtered_errors))
        raise AssertionError("Browser console contains errors")

    mobile_context.close()
    auth_context.close()
    browser.close()
