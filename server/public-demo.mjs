const enabledValues = new Set(["1", "true", "yes", "on"]);
const disabledValues = new Set(["0", "false", "no", "off"]);

const configuredValue = (environment) => (
  environment.PUBLIC_DEMO_MODE ?? environment.VITE_PUBLIC_DEMO_MODE
);

export const isPublicDemoMode = (environment = process.env) => {
  const configured = configuredValue(environment);
  if (configured !== undefined && String(configured).trim() !== "") {
    const normalized = String(configured).trim().toLowerCase();
    if (enabledValues.has(normalized)) return true;
    if (disabledValues.has(normalized)) return false;
  }

  return environment.VERCEL === "1" || environment.NODE_ENV === "production";
};

export const sendPublicDemoMediaDisabled = (response) => response.status(403).json({
  error: "线上课堂演示版暂不开放音频、图片和视频生成。请在本地配置自己的 API 后体验完整能力。",
  code: "PUBLIC_DEMO_MEDIA_DISABLED",
});
