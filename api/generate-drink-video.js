import { createVercelVideoHandler } from "../server/video-api.mjs";

export const config = { maxDuration: 30 };
export const createHandler = (dependencies) => createVercelVideoHandler("createVideo", dependencies);

export default createHandler();
