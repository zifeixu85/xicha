import { createCustomDrinkHandler } from "../server/creation-api.mjs";

export const config = { maxDuration: 30 };

export const createHandler = (options) => createCustomDrinkHandler(options);
export default createHandler();
