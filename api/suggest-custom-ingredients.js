import { createCustomIngredientSuggestionHandler } from "../server/custom-drink-suggestion-api.mjs";

export const config = { maxDuration: 30 };
export const createHandler = (options) => createCustomIngredientSuggestionHandler(options);
export default createHandler();
