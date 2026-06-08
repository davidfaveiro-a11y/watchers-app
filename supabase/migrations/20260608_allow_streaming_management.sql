drop policy if exists "Members read streaming stats" on public.streaming_stats;
drop policy if exists "Members manage streaming stats" on public.streaming_stats;

create policy "Members manage streaming stats"
on public.streaming_stats
for all
to authenticated
using (true)
with check (true);
