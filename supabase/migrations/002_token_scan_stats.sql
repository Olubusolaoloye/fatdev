-- ============================================================
-- FatDev — scan tracking for the "Most scanned" spotlight
-- Run in the Supabase SQL editor after 001_initial.sql.
-- ============================================================

-- One row per token (address + chain). Counts are public data: they feed the
-- spotlight on the homepage and scanner, so anyone may read them.
create table if not exists token_scan_stats (
  address          text        not null,   -- lowercase for EVM, as-is for Solana/Sui
  chain_id         int         not null,
  scan_count       bigint      not null default 0,
  name             text,
  symbol           text,
  logo_url         text,
  last_score       int,
  last_verdict     text,
  first_scanned_at timestamptz not null default now(),
  last_scanned_at  timestamptz not null default now(),
  primary key (address, chain_id)
);

create index if not exists token_scan_stats_count_idx on token_scan_stats (scan_count desc);
create index if not exists token_scan_stats_last_idx  on token_scan_stats (last_scanned_at desc);

alter table token_scan_stats enable row level security;

drop policy if exists "token_scan_stats_read" on token_scan_stats;
create policy "token_scan_stats_read" on token_scan_stats for select using (true);
-- No insert/update policy: the browser can only write through record_scan(),
-- which validates and bounds every field. Admin edits go through the service role.

-- Increment a token's count and refresh its latest metadata.
create or replace function public.record_scan(
  p_address  text,
  p_chain_id int,
  p_name     text default null,
  p_symbol   text default null,
  p_logo_url text default null,
  p_score    int  default null,
  p_verdict  text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_addr text := trim(p_address);
  v_logo text := nullif(trim(coalesce(p_logo_url, '')), '');
begin
  if v_addr is null or length(v_addr) < 20 or length(v_addr) > 200 then
    return;
  end if;
  if p_chain_id is null or p_chain_id <= 0 then
    return;
  end if;
  if v_addr ~* '^0x[0-9a-f]{40}$' then
    v_addr := lower(v_addr);
  end if;
  if v_logo is not null and v_logo !~* '^https://' then
    v_logo := null;
  end if;

  insert into token_scan_stats as s
    (address, chain_id, scan_count, name, symbol, logo_url, last_score, last_verdict)
  values (
    v_addr, p_chain_id, 1,
    left(p_name, 80), left(p_symbol, 24), left(v_logo, 500),
    case when p_score between 0 and 100 then p_score end,
    left(p_verdict, 24)
  )
  on conflict (address, chain_id) do update set
    scan_count      = s.scan_count + 1,
    name            = coalesce(excluded.name,     s.name),
    symbol          = coalesce(excluded.symbol,   s.symbol),
    logo_url        = coalesce(excluded.logo_url, s.logo_url),
    last_score      = coalesce(excluded.last_score,   s.last_score),
    last_verdict    = coalesce(excluded.last_verdict, s.last_verdict),
    last_scanned_at = now();
end;
$$;

revoke all on function public.record_scan(text, int, text, text, text, int, text) from public;
grant execute on function public.record_scan(text, int, text, text, text, int, text) to anon, authenticated;
