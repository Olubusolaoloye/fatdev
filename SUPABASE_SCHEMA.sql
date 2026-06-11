-- Run this in your Supabase SQL editor to set up the FatDeploy backend

-- Users table (wallet-auth, one row per wallet)
create table if not exists public.users (
  id              uuid primary key default gen_random_uuid(),
  wallet_address  text unique not null,
  tier            text not null default 'starter' check (tier in ('starter','pro','elite')),
  deploys_used    int not null default 0,
  deploys_limit   int not null default 1,
  payment_tx      text,
  payment_token   text,
  payment_amount  text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- Deploys table (one row per token deployed)
create table if not exists public.deploys (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references public.users(id) on delete cascade,
  token_name       text not null,
  token_symbol     text not null,
  contract_address text,
  chain_id         int not null default 56,
  tx_hash          text,
  config_json      jsonb,
  deployed_at      timestamptz,
  created_at       timestamptz default now()
);

-- Row-level security
alter table public.users enable row level security;
alter table public.deploys enable row level security;

-- Policies: users can only see/modify their own rows
-- (in production scope to wallet_address via JWT claim or server-side auth)
create policy "users_select_own" on public.users for select using (true);
create policy "users_insert_own" on public.users for insert with check (true);
create policy "users_update_own" on public.users for update using (true);

create policy "deploys_select_own" on public.deploys for select using (true);
create policy "deploys_insert_own" on public.deploys for insert with check (true);

-- Trigger: auto-update updated_at on users
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger users_updated_at before update on public.users
  for each row execute function update_updated_at();
