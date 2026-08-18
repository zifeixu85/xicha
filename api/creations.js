import { createListCreationsHandler } from "../server/creation-api.mjs";

export const config = { maxDuration: 30 };
export default createListCreationsHandler();
