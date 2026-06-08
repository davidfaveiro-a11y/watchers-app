alter table public.concerts
  add column if not exists booking_status text not null default 'mail_sent';

alter table public.concerts drop constraint if exists concerts_booking_status_check;

alter table public.concerts
  add constraint concerts_booking_status_check
  check (booking_status in ('mail_sent', 'rejected', 'negotiating', 'confirmed'));
