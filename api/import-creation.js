import { createImportCreationHandler } from "../server/creation-api.mjs";

export const config = { maxDuration: 120 };
export default createImportCreationHandler();
