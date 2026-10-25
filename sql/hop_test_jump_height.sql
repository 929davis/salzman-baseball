-- Adds jump-height summary columns to hop_test_results. The table already stored avg/best RSI
-- but never the jump-height-from-flight-time value, even though lib/hopTest.ts's per-hop
-- metrics always computed it (HopMetrics.flightTimeJumpHeightIn) -- it just wasn't aggregated
-- or persisted. Needed to let the Hop Test Jump Height benchmark in lib/benchmarks.ts read a
-- real stored value, the same way cmj_results.jump_height_in already works for CMJ.
alter table hop_test_results add column if not exists avg_jump_height_in numeric;
alter table hop_test_results add column if not exists best_jump_height_in numeric;
