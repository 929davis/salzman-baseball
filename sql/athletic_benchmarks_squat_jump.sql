-- Adds Squat Jump Height as a loggable benchmark (Tier 2). Measured the same way as CMJ --
-- flight time from a phone timer -- just from a static squat pause instead of a
-- countermovement. No new equipment needed.
alter table athletic_benchmarks add column if not exists squat_jump_in numeric;
