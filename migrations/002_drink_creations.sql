CREATE TABLE IF NOT EXISTS public.drink_creations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL DEFAULT auth.user_id(),
  name text NOT NULL,
  summary text NOT NULL DEFAULT '',
  blessing text NOT NULL DEFAULT '',
  mood_note text NOT NULL DEFAULT '',
  recipe jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS drink_creations_owner_created_idx
  ON public.drink_creations (owner_id, created_at DESC);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS public.creation_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creation_id uuid NOT NULL REFERENCES public.drink_creations(id) ON DELETE CASCADE,
  owner_id text NOT NULL DEFAULT auth.user_id(),
  kind text NOT NULL CHECK (kind IN ('image', 'audio', 'video')),
  object_key text NOT NULL,
  mime_type text NOT NULL,
  byte_size bigint NOT NULL DEFAULT 0,
  source_provider text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT creation_media_creation_kind_unique UNIQUE (creation_id, kind)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS creation_media_owner_idx
  ON public.creation_media (owner_id, creation_id);
--> statement-breakpoint
ALTER TABLE public.drink_creations ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.creation_media ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON public.drink_creations TO authenticated;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON public.creation_media TO authenticated;
--> statement-breakpoint
DROP POLICY IF EXISTS "drink_creations_select_own" ON public.drink_creations;
--> statement-breakpoint
CREATE POLICY "drink_creations_select_own" ON public.drink_creations
  FOR SELECT TO authenticated USING ((SELECT auth.user_id()) = owner_id);
--> statement-breakpoint
DROP POLICY IF EXISTS "drink_creations_insert_own" ON public.drink_creations;
--> statement-breakpoint
CREATE POLICY "drink_creations_insert_own" ON public.drink_creations
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.user_id()) = owner_id);
--> statement-breakpoint
DROP POLICY IF EXISTS "drink_creations_update_own" ON public.drink_creations;
--> statement-breakpoint
CREATE POLICY "drink_creations_update_own" ON public.drink_creations
  FOR UPDATE TO authenticated USING ((SELECT auth.user_id()) = owner_id)
  WITH CHECK ((SELECT auth.user_id()) = owner_id);
--> statement-breakpoint
DROP POLICY IF EXISTS "drink_creations_delete_own" ON public.drink_creations;
--> statement-breakpoint
CREATE POLICY "drink_creations_delete_own" ON public.drink_creations
  FOR DELETE TO authenticated USING ((SELECT auth.user_id()) = owner_id);
--> statement-breakpoint
DROP POLICY IF EXISTS "creation_media_select_own" ON public.creation_media;
--> statement-breakpoint
CREATE POLICY "creation_media_select_own" ON public.creation_media
  FOR SELECT TO authenticated USING ((SELECT auth.user_id()) = owner_id);
--> statement-breakpoint
DROP POLICY IF EXISTS "creation_media_insert_own" ON public.creation_media;
--> statement-breakpoint
CREATE POLICY "creation_media_insert_own" ON public.creation_media
  FOR INSERT TO authenticated WITH CHECK (
    (SELECT auth.user_id()) = owner_id
    AND EXISTS (
      SELECT 1 FROM public.drink_creations c
      WHERE c.id = creation_id AND c.owner_id = (SELECT auth.user_id())
    )
  );
--> statement-breakpoint
DROP POLICY IF EXISTS "creation_media_update_own" ON public.creation_media;
--> statement-breakpoint
CREATE POLICY "creation_media_update_own" ON public.creation_media
  FOR UPDATE TO authenticated USING ((SELECT auth.user_id()) = owner_id)
  WITH CHECK ((SELECT auth.user_id()) = owner_id);
--> statement-breakpoint
DROP POLICY IF EXISTS "creation_media_delete_own" ON public.creation_media;
--> statement-breakpoint
CREATE POLICY "creation_media_delete_own" ON public.creation_media
  FOR DELETE TO authenticated USING ((SELECT auth.user_id()) = owner_id);
