# Mechanics tab — SQL you may want to run

**Nothing here has been run.** The app works without any of it. Run these yourself in the
Supabase SQL Editor, one block at a time, only if you want the benefit described.

## 1. Optional: remember each clip's slow-motion rate (`capture_fps`)

**Plain English.** An iPhone slow-motion clip is filmed at 240 frames per second but plays back at
about 30, so the video's clock runs 8 times slower than real life. The mechanics tool now
converts every phase duration to real time using the "Capture frame rate" you pick. That setting
resets whenever the page is reloaded, so a saved session reopened later would need it picked
again. This adds one empty-by-default number column so each saved mark remembers its own rate and
the tool can restore it automatically when you type the same Session Label.

**What it does.** Adds one new nullable whole-number column to `mechanics_frame_logs`. Existing rows
are untouched (they get `null`, and the tool falls back to the rate currently selected). It does
not change or delete any data, and it does not touch permissions.

```sql
alter table mechanics_frame_logs
  add column if not exists capture_fps integer;

comment on column mechanics_frame_logs.capture_fps is
  'Capture frame rate (e.g. 30, 120, 240) selected when this mark was saved. Real seconds = video seconds / (capture_fps / 30). Null on rows saved before this column existed.';
```

**Safe either way.** If this column is missing, the app saves the row without it (it detects the
database's "column does not exist" reply and re-sends). You can run this before or after deploying.

## 1b. Only if marking "Bottom of Back Leg Loading" fails: check the event-name rule (read-only)

**Plain English.** The new mark is saved as the text `Bottom of Back Leg Loading` in the `key_event`
column, like the other seven events. That works unless the table has a rule limiting that column to a fixed
list of names. Nothing in the repo defines such a rule, so this is most likely fine; run this only if marking
that one event shows a red error mentioning a "check constraint" (code `23514`) while the other events save.

```sql
-- Read-only: lists every rule (constraint) on the table.
select conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.mechanics_frame_logs'::regclass;
```

If a rule on `key_event` lists the old event names, send me its definition and I'll write the one-line change
to add the new name. Do not edit it by hand.

## 2. Only if saving still fails: check what the database is rejecting

The new preview shows the real Supabase error text and code under the Log Frame button. If it is a
permissions error (`42501`, "new row violates row-level security policy"), run these **read-only**
checks first and send me the results. They only read.

```sql
-- Which rules (policies) are on the table right now?
select policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'mechanics_frame_logs';

-- Which columns does the table have, and which are required (NOT NULL)?
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'mechanics_frame_logs'
order by ordinal_position;
```

**How to read them.**
- If there is no `INSERT` policy that lets a signed-in athlete add a row where `pitcher_id` is their own
  id, an athlete cannot save. The repo's `sql/rls_pitcher_isolation.sql` was written to add exactly that
  rule, but its own header says it is "not executed automatically", so it may never have been run.
- If a measurement column such as `front_knee_deg` shows `is_nullable = NO`, a frame with a missing
  joint reading would be refused. (The app now sends `null` instead of `NaN` for those, so the
  fix is to make the column nullable, not to change the app.)

**Only if the `INSERT` policy is missing**, this adds just that one rule for just this table. It lets
an athlete insert rows for themselves and a coach insert for anyone. It does not drop or change any
other policy. (Do not run the whole `sql/rls_pitcher_isolation.sql` just for this; it rewrites rules on
seven tables.)

```sql
alter table mechanics_frame_logs enable row level security;

create policy "mechanics_frame_logs own or coach insert" on mechanics_frame_logs
  for insert to authenticated
  with check (
    pitcher_id = auth.uid()
    or exists (select 1 from profiles where id = auth.uid() and role = 'coach')
  );
```

If a policy with that name already exists, the statement will say so and change nothing; that means
the rule is already there and the cause is something else.
