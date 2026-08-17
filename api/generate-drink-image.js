import { createGenerateDrinkImageHandler } from "../server/media-api.mjs";

export const config = { maxDuration: 30 };

// The factory supports injecting the project's verified session adapter. Until
// that adapter lands, the secure default requires request.auth from middleware.
export const createHandler = (options) => createGenerateDrinkImageHandler(options);
export default createHandler();
