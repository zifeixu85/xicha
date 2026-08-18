import { createVercelVideoHandler } from "../server/video-api.mjs";

export const config = { maxDuration: 120 };
export const createHandler = (dependencies) => createVercelVideoHandler("getTask", dependencies);

export default createHandler();
