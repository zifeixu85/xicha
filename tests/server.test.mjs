import assert from "node:assert/strict";
import test from "node:test";
import { generateBlessing } from "../server/blessing.mjs";
import { createSpeechToken, generateSpeech } from "../server/speech.mjs";

test("mood note is included in the personalized blessing prompt", async () => {
  let requestBody;
  const result = await generateBlessing({
    recipe: { name: "多肉葡萄", category: "果茶", summary: "清爽", layers: ["葡萄"] },
    localTime: "2026年8月17日 14:20",
    timeZone: "Asia/Shanghai",
    moodNote: "刚刚失业了，心情很糟。",
  }, "deepseek-test-key", {
    fetchImpl: async (_url, options) => {
      requestBody = JSON.parse(options.body);
      return new Response(JSON.stringify({
        choices: [{ message: { content: "先把今天轻轻放下，这杯陪你喘口气。" } }],
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    },
  });

  assert.equal(result.blessing, "先把今天轻轻放下，这杯陪你喘口气。");
  assert.match(requestBody.messages[0].content, /先准确共情/);
  assert.match(requestBody.messages[0].content, /自伤、自杀或即时危险/);
  assert.match(requestBody.messages[1].content, /用户主动写下的近况：刚刚失业了，心情很糟。/);
});

test("speech request uses the fixed MiniMax configuration and signed blessing", async () => {
  const apiKey = "minimax-test-key";
  const text = "风会替你翻过这一页，下一口有新的甜。";
  const now = 1_800_000_000_000;
  const token = createSpeechToken(text, apiKey, now);
  let url;
  let request;

  const result = await generateSpeech({ text, token }, apiKey, {
    now,
    fetchImpl: async (nextUrl, options) => {
      url = nextUrl;
      request = { ...options, body: JSON.parse(options.body) };
      return new Response(JSON.stringify({
        data: { audio: "https://audio.example.test/blessing.mp3" },
        base_resp: { status_code: 0 },
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    },
  });

  assert.equal(url, "https://api.minimaxi.com/v1/t2a_v2");
  assert.equal(request.headers.Authorization, `Bearer ${apiKey}`);
  assert.deepEqual(request.body, {
    model: "speech-2.8-hd",
    text,
    stream: false,
    voice_setting: {
      voice_id: "Chinese_wenrounvxing",
      speed: 1,
      vol: 1,
      pitch: 0,
      emotion: "calm",
    },
    audio_setting: {
      sample_rate: 32000,
      bitrate: 128000,
      format: "mp3",
      channel: 1,
    },
    output_format: "url",
    subtitle_enable: false,
  });
  assert.equal(result.audio, "https://audio.example.test/blessing.mp3");
});

test("speech rejects unsigned and overlong text before calling MiniMax", async () => {
  const fetchImpl = async () => assert.fail("MiniMax should not be called");
  await assert.rejects(
    generateSpeech({ text: "普通文字", token: "invalid" }, "test-key", { fetchImpl }),
    (error) => error.statusCode === 403,
  );
  await assert.rejects(
    generateSpeech({ text: "心".repeat(121), token: "invalid" }, "test-key", { fetchImpl }),
    (error) => error.statusCode === 400,
  );
});
