const enabledValues = new Set(["1", "true", "yes", "on"]);
const disabledValues = new Set(["0", "false", "no", "off"]);
const configured = import.meta.env.VITE_PUBLIC_DEMO_MODE;

const fromConfiguration = () => {
  if (configured === undefined || String(configured).trim() === "") return null;
  const normalized = String(configured).trim().toLowerCase();
  if (enabledValues.has(normalized)) return true;
  if (disabledValues.has(normalized)) return false;
  return null;
};

export const publicDemoMode = fromConfiguration() ?? import.meta.env.PROD;
