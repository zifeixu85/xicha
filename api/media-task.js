import { createMediaTaskHandler } from "../server/media-api.mjs";

export const config = { maxDuration: 30 };

export const createHandler = (options) => createMediaTaskHandler(options);
export default createHandler();
