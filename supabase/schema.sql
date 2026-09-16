-- Execute uma vez no SQL Editor do Supabase.
create table public.portal_users(id uuid primary key default gen_random_uuid(), username text unique not null check(username ~ '^[a-z0-9_]{2,40}$'), name text not null, password_hash text not null, is_admin boolean not null default false, avatar text, created_at timestamptz default now());
create table public.portal_sessions(token_hash text primary key,user_id uuid references public.portal_users on delete cascade,expires_at timestamptz not null);
create table public.portal_items(id uuid primary key default gen_random_uuid(),kind text not null check(kind in ('notes','faq','versions','tax','files','drive')),owner_id uuid references public.portal_users on delete cascade,title text not null,content text not null default '',url text not null default '',file_path text not null default '',color text not null default 'lime',created_at timestamptz default now(),check((kind='notes' and owner_id is not null) or (kind<>'notes' and owner_id is null)));
create table public.portal_settings(id int primary key default 1 check(id=1), current_tax uuid references public.portal_items on delete set null);
insert into public.portal_settings(id) values(1);
create table public.portal_login_limits(key text primary key,attempts int not null,window_at timestamptz not null);
create or replace function public.portal_allow_login(p_key text) returns boolean language plpgsql security definer set search_path=public as $$
declare n int;
begin
 insert into portal_login_limits(key,attempts,window_at) values(p_key,1,now()) on conflict(key) do update set attempts=case when portal_login_limits.window_at<now()-interval '15 minutes' then 1 else portal_login_limits.attempts+1 end,window_at=case when portal_login_limits.window_at<now()-interval '15 minutes' then now() else portal_login_limits.window_at end returning attempts into n;
 return n<=12;
end $$;
revoke all on function public.portal_allow_login(text) from public,anon,authenticated;
grant execute on function public.portal_allow_login(text) to service_role;
alter table public.portal_users enable row level security;
alter table public.portal_sessions enable row level security;
alter table public.portal_items enable row level security;
alter table public.portal_settings enable row level security;
alter table public.portal_login_limits enable row level security;
revoke all on public.portal_users,public.portal_sessions,public.portal_items,public.portal_settings,public.portal_login_limits from anon,authenticated;
grant all on public.portal_users,public.portal_sessions,public.portal_items,public.portal_settings,public.portal_login_limits to service_role;
create index on public.portal_items(owner_id,kind);
create index on public.portal_sessions(expires_at);
insert into storage.buckets(id,name,public,file_size_limit) values('portal','portal',false,2097152) on conflict(id) do nothing;
