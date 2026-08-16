CREATE TABLE IF NOT EXISTS public.favorite_recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL DEFAULT auth.user_id(),
  recipe_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT favorite_recipes_owner_recipe_unique UNIQUE (owner_id, recipe_id)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS favorite_recipes_owner_id_idx
  ON public.favorite_recipes (owner_id);
--> statement-breakpoint
ALTER TABLE public.favorite_recipes ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
GRANT SELECT, INSERT, DELETE ON public.favorite_recipes TO authenticated;
--> statement-breakpoint
DROP POLICY IF EXISTS "favorite_recipes_select_own" ON public.favorite_recipes;
--> statement-breakpoint
CREATE POLICY "favorite_recipes_select_own"
  ON public.favorite_recipes
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.user_id()) = owner_id);
--> statement-breakpoint
DROP POLICY IF EXISTS "favorite_recipes_insert_own" ON public.favorite_recipes;
--> statement-breakpoint
CREATE POLICY "favorite_recipes_insert_own"
  ON public.favorite_recipes
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.user_id()) = owner_id);
--> statement-breakpoint
DROP POLICY IF EXISTS "favorite_recipes_delete_own" ON public.favorite_recipes;
--> statement-breakpoint
CREATE POLICY "favorite_recipes_delete_own"
  ON public.favorite_recipes
  FOR DELETE
  TO authenticated
  USING ((SELECT auth.user_id()) = owner_id);
