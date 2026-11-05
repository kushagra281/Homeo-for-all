-- Profile photo.
-- The photo is a small (256 px) picture kept as a data URL in the user's own profile row.
-- It is private: the row is covered by the same row level security as the rest of the profile.
-- Run this once in the Supabase SQL editor of the main project. Until it is run, the app shows a
-- clear "Photo storage is not set up yet" message when someone tries to add a photo; nothing else changes.

alter table public.patients add column if not exists avatar_url text;

-- Make the API see the new column right away.
notify pgrst, 'reload schema';
