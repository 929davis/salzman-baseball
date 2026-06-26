# Salzman Baseball - Progress Notes

## Live URLs:
- Coach: https://salzman-baseball.vercel.app/coach
- Pitcher: https://salzman-baseball.vercel.app/pitcher
- Public CMJ: https://salzman-baseball.vercel.app/cmj
- GitHub: https://github.com/929davis/salzman-baseball
- Supabase: https://supabase.com/dashboard/project/bpeiaeivxdqoujbakbrw

## Supabase Tables:
profiles, programs, session_logs, cmj_results, squat_jump_results,
single_leg_cmj_results, triple_hop_results, plyo_pushup_results,
coach_notes, messages, principles, exercise_videos, custom_exercises,
exercise_overrides, recommendation_rules, food_logs, daily_fuel_scores,
public_cmj_submissions

## Still to build:
1. Calendar / week-to-week program history
2. Coach view of all assessment data per pitcher
3. Player development profile on coach side
4. Public CMJ submissions view on coach dashboard
5. Exercise audit (fix wrong categories/CNS on built-in exercises)

## Key decisions made:
- Categories: Pre-Throwing, Throwing, Post-Throwing, Main Exercises, Accessory, Conditioning, Recovery
- Macro split: 40% protein / 30% carbs / 30% fat
- CMJ thresholds based on Salzman database (not generic sports science)
- Food scoring: Macros 30pts, Quality 30pts, Glycemic 20pts, Timing 20pts
- No Anthropic API usage (free approach only)
- VS Code installed for editing
- All number inputs use type=text inputMode=numeric for mobile
