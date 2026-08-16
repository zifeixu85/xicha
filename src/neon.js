import { createClient } from "@neondatabase/neon-js";
import { BetterAuthReactAdapter } from "@neondatabase/neon-js/auth/react/adapters";

const authUrl = import.meta.env.VITE_NEON_AUTH_URL?.trim();
const dataApiUrl = import.meta.env.VITE_NEON_DATA_API_URL?.trim();

export const neonConfigured = Boolean(authUrl && dataApiUrl);

export const neonClient = neonConfigured
  ? createClient({
      auth: {
        adapter: BetterAuthReactAdapter(),
        url: authUrl,
      },
      dataApi: {
        url: dataApiUrl,
      },
    })
  : null;

export async function fetchFavoriteIds() {
  const { data, error } = await neonClient
    .from("favorite_recipes")
    .select("recipe_id")
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data || []).map((row) => row.recipe_id);
}

export async function addFavorite(recipeId) {
  const { error } = await neonClient
    .from("favorite_recipes")
    .insert({ recipe_id: recipeId });

  if (error && error.code !== "23505") throw error;
}

export async function deleteFavorite(recipeId) {
  const { error } = await neonClient
    .from("favorite_recipes")
    .delete()
    .eq("recipe_id", recipeId);

  if (error) throw error;
}

export async function mergeGuestFavorites(recipeIds) {
  for (const recipeId of recipeIds) {
    await addFavorite(recipeId);
  }
  return fetchFavoriteIds();
}
