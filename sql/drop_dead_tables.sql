-- Drops tables confirmed to have zero readers or writers in live code (grepped across app/,
-- lib/, scripts/ -- the only hits were in the *.backup/*.backup2/*.bak clutter files removed
-- in the same pass as this migration, plus one write-path in
-- scripts/aggregate-base-scenario.mjs that this migration's companion code change removes).
-- Not executed automatically -- run manually after reviewing.
--
-- messages: no reader or writer anywhere in app/coach/page.tsx or app/pitcher/page.tsx (the
-- live files) -- only referenced in the now-deleted backup files, which were themselves stale
-- copies of an older version of this app that had a coach/athlete chat feature.
drop table if exists messages;

-- public_cmj_submissions: fed the public no-login CMJ demo page, which was removed in commit
-- 456a387 ("Remove public no-login CMJ demo tool"). Orphaned since that removal.
drop table if exists public_cmj_submissions;

-- bs_re_marginal, bs_re24_split, bs_re24_base: written by scripts/aggregate-base-scenario.mjs
-- but never read by any app component. Comment in lib/effectiveVelocity.ts mentioning
-- bs_re_marginal has been reworded in the same pass as this migration to stop citing a table
-- that no longer exists.
drop table if exists bs_re_marginal;
drop table if exists bs_re24_split;
drop table if exists bs_re24_base;

-- NOT dropped (kept on purpose, per instruction): squat_jump_results, single_leg_cmj_results,
-- plyo_pushup_results, triple_hop_results -- these get wired up to real UI in a later step.
