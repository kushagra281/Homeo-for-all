-- DB cleanup for the main project (rtfjnfepikhahzospnqq). Safe to run more than once.
-- Run it in the Supabase SQL editor of that project. It only drops two copies of indexes
-- that already exist and rewrites five RLS policies so they run faster; no data changes.
-- Found by the Supabase performance advisor on 2026-11-05.

begin;

-- 1) Duplicate indexes on remedy_symptoms: each pair below is identical, keep one of each.
--    kept: idx_remedy_symptoms_heading  (btree on heading)
--    kept: idx_remedy_symptoms_symptom  (gin full-text on symptom)
drop index if exists public.idx_sym_heading;
drop index if exists public.idx_sym_fts;

-- 2) RLS policies: call auth.uid() once per query instead of once per row.
--    Same rules as before, only wrapped in (select ...).
alter policy "Users see own profile" on public.patients
  using ((select auth.uid()) = id);

alter policy "Users see own history" on public.search_history
  using ((select auth.uid()) = patient_id);

alter policy "Users own cases" on public.cases
  using ((select auth.uid()) = patient_id);

alter policy "Users own analysis" on public.analysis_results
  using ((select auth.uid()) = patient_id);

alter policy "Users own case_symptoms" on public.case_symptoms
  using (case_id in (select c.id from public.cases c where c.patient_id = (select auth.uid())));

commit;

-- Check afterwards (both should return what is described):
--   select indexname from pg_indexes where tablename = 'remedy_symptoms' order by 1;
--     -> idx_remedy_symptoms_heading, idx_remedy_symptoms_name, idx_remedy_symptoms_symptom,
--        idx_sym_remedy_id, remedy_symptoms_pkey   (no idx_sym_heading / idx_sym_fts)
--   select tablename, policyname, qual from pg_policies where schemaname = 'public'
--     and policyname in ('Users see own profile','Users see own history','Users own cases','Users own analysis','Users own case_symptoms');
--     -> every qual contains "( SELECT auth.uid() ...)"
--
-- Left alone on purpose: the other "unused index" and "unindexed foreign key" notices. Those tables
-- are empty or barely used today, so the indexes cost little and will matter as data grows.
