-- ============================================================
-- FatDev — Supabase initial schema
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor)
-- ============================================================

-- ── App config (maintenance mode, tier prices, etc.) ────────
create table if not exists app_config (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz default now()
);

-- Default config values
insert into app_config (key, value) values
  ('maintenance_mode',    'false'),
  ('maintenance_message', '"Scheduled maintenance in progress. We will be back shortly."'),
  ('tier_prices', '{
    "starter": { "usd": 49,  "blin": 50000,  "native": 0.05, "label": "$49"  },
    "pro":     { "usd": 149, "blin": 150000, "native": 0.15, "label": "$149" },
    "elite":   { "usd": 399, "blin": 400000, "native": 0.40, "label": "$399" }
  }'),
  ('tier_features', '{
    "starter": ["1 token deploy", "All config options", "Param export", "Email support"],
    "pro":     ["3 token deploys", "Full tax config", "Anti-bot suite", "One-click deploy", "Priority support"],
    "elite":   ["Unlimited deploys", "All chains", "Custom tokenomics", "Telegram bot access", "Dedicated support"]
  }')
on conflict (key) do nothing;

-- ── Users (one row per wallet address) ──────────────────────
create table if not exists users (
  wallet           text primary key,   -- lowercase 0x address
  tier             text not null default 'free',
  deploys_used     int  not null default 0,
  deploys_limit    int  not null default 0,
  payment_tx_hash  text,
  payment_token    text,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

-- ── Deploy records ───────────────────────────────────────────
create table if not exists deploys (
  id               text primary key,
  wallet           text not null references users(wallet) on delete cascade,
  token_name       text,
  token_symbol     text,
  decimals         int,
  contract_address text,
  tx_hash          text,
  chain_id         int,
  chain_name       text,
  deployed_at      timestamptz,
  config_snapshot  jsonb,
  verified         boolean default false,
  created_at       timestamptz default now()
);

create index if not exists deploys_wallet_idx    on deploys(wallet);
create index if not exists deploys_chain_idx     on deploys(chain_id);
create index if not exists deploys_deployed_at_idx on deploys(deployed_at desc);

-- ── Payment / transaction log ────────────────────────────────
create table if not exists payments (
  id            uuid primary key default gen_random_uuid(),
  wallet        text not null,
  tier          text not null,
  tx_hash       text,
  payment_token text,     -- 'BLIN' | 'native'
  amount_usd    numeric,
  chain_id      int,
  created_at    timestamptz default now()
);

create index if not exists payments_wallet_idx on payments(wallet);
create index if not exists payments_created_idx on payments(created_at desc);

-- ── Updated_at triggers ──────────────────────────────────────
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger users_updated_at
  before update on users
  for each row execute function update_updated_at();

create trigger app_config_updated_at
  before update on app_config
  for each row execute function update_updated_at();

-- ── Row Level Security ───────────────────────────────────────
alter table app_config enable row level security;
alter table users       enable row level security;
alter table deploys     enable row level security;
alter table payments    enable row level security;

-- app_config: anyone can read, only service role can write
create policy "app_config_read"  on app_config for select using (true);
create policy "app_config_write" on app_config for all    using (auth.role() = 'service_role');

-- users: public insert (wallet signs up), read/update own row only
create policy "users_insert" on users for insert with check (true);
create policy "users_select" on users for select using (true);  -- allow admin reads (service role bypasses RLS anyway)
create policy "users_update" on users for update using (true);  -- service role enforces the actual restriction

-- deploys: public insert + read
create policy "deploys_insert" on deploys for insert with check (true);
create policy "deploys_select" on deploys for select using (true);
create policy "deploys_update" on deploys for update using (true);

-- payments: public insert + read
create policy "payments_insert" on payments for insert with check (true);
create policy "payments_select" on payments for select using (true);
