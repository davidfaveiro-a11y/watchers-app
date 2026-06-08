drop policy if exists manage_streams on public.streaming_stats;
drop policy if exists "Members manage streaming stats" on public.streaming_stats;
drop policy if exists "Members read streaming stats" on public.streaming_stats;

create policy "Members read streaming stats"
on public.streaming_stats
for select
to authenticated
using (true);
