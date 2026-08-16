const DEEPSEEK_ENDPOINT = "https://api.deepseek.com/chat/completions";
const DEEPSEEK_MODEL = "deepseek-v4-pro";

const cleanText = (value, maxLength) => String(value || "").trim().slice(0, maxLength);

const normalizeBlessing = (value) => cleanText(value, 120)
  .replace(/^```[\s\S]*?\n|```$/g, "")
  .replace(/^([“\"']|祝福[:：]|签语[:：])+|([”\"'])+$/g, "")
  .replace(/\s+/g, " ")
  .trim();

const requestDeepSeek = async ({ apiKey, messages }) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);

  try {
    const response = await fetch(DEEPSEEK_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages,
        thinking: { type: "disabled" },
        temperature: 1.25,
        max_tokens: 80,
        stream: false,
      }),
      signal: controller.signal,
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = payload?.error?.message || `DeepSeek returned ${response.status}`;
      throw new Error(detail);
    }

    const blessing = normalizeBlessing(payload?.choices?.[0]?.message?.content);
    if (!blessing) throw new Error("DeepSeek returned an empty blessing");
    return blessing;
  } finally {
    clearTimeout(timeout);
  }
};

export const generateBlessing = async (body, apiKey) => {
  if (!apiKey) {
    const error = new Error("服务端尚未配置 DEEPSEEK_API_KEY");
    error.statusCode = 503;
    throw error;
  }

  const recipe = body?.recipe || {};
  const name = cleanText(recipe.name, 40);
  const category = cleanText(recipe.category, 30);
  const summary = cleanText(recipe.summary, 100);
  const layers = Array.isArray(recipe.layers)
    ? recipe.layers.slice(0, 8).map((item) => cleanText(item, 30)).filter(Boolean)
    : [];
  const localTime = cleanText(body?.localTime, 60);
  const timeZone = cleanText(body?.timeZone, 60);
  const requestId = cleanText(body?.requestId, 80);
  const recent = Array.isArray(body?.recent)
    ? body.recent.slice(-80).map((item) => normalizeBlessing(item)).filter(Boolean)
    : [];

  if (!name || !localTime) {
    const error = new Error("缺少饮品或当地时间");
    error.statusCode = 400;
    throw error;
  }

  const system = [
    "你是饮品店里很会写签语的中文文案师。",
    "请根据饮品风味和用户当地时间，写一句温暖、轻巧、有画面感的祝福或原创金句。",
    "只输出一句正文，18到38个中文字符；不要标题、引号、Markdown、表情、话题标签或署名。",
    "不要说教，不要使用网络烂梗，不要声称引用名人。",
    "必须避开用户列出的历史句子，措辞和意象也尽量不同。",
  ].join("");

  const user = [
    `当地时间：${localTime}（时区：${timeZone || "未知"}）`,
    `饮品：${name}；类型：${category || "特调"}`,
    `风味：${summary || layers.join("、") || "清爽饮品"}`,
    `配料：${layers.join("、") || "未提供"}`,
    `本次随机标识：${requestId || Date.now()}`,
    recent.length ? `最近已经写过，严禁重复：${recent.join("｜")}` : "最近没有历史签语。",
  ].join("\n");

  const messages = [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
  let blessing = "";
  for (let attempt = 0; attempt < 3; attempt += 1) {
    blessing = await requestDeepSeek({
      apiKey,
      messages: attempt === 0
        ? messages
        : [...messages, { role: "user", content: `上一次仍然撞句。第 ${attempt + 1} 次请彻底更换意象、句式和用词。` }],
    });
    if (!recent.includes(blessing)) break;
  }

  if (recent.includes(blessing)) {
    throw new Error("DeepSeek repeated a recent blessing after retries");
  }

  return { blessing, model: DEEPSEEK_MODEL };
};
