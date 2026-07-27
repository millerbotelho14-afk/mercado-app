-- Estrutura do banco na nuvem para a sincronia entre celular e computador.
-- Rode este arquivo uma vez no SQL Editor do Supabase.
-- Pode rodar de novo sem medo: tudo é "if not exists" / "or replace".

-- ── Compras ──────────────────────────────────────────────────────────────
create table if not exists public.purchases (
  id          uuid primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  store       text not null,
  date        date not null,
  total_gross numeric(12, 2) not null default 0,
  discount    numeric(12, 2) not null default 0,
  total_paid  numeric(12, 2) not null default 0,
  items       jsonb not null default '[]'::jsonb,
  source      text,
  deleted     boolean not null default false,
  -- milissegundos do relógio do aparelho: resolve quem venceu numa edição concorrente
  created_at  bigint not null,
  updated_at  bigint not null,
  -- carimbo do servidor: é por ele que cada aparelho pede "o que mudou desde então"
  server_ts   timestamptz not null default now()
);

-- ── Correções manuais (categoria, marca, agrupamento) ────────────────────
create table if not exists public.overrides (
  user_id     uuid not null references auth.users (id) on delete cascade,
  key         text not null,
  category    text,
  brand       text,
  product_key text,
  updated_at  bigint not null,
  server_ts   timestamptz not null default now(),
  primary key (user_id, key)
);

-- ── Carimbo do servidor sempre que a linha muda ──────────────────────────
create or replace function public.touch_server_ts()
returns trigger
language plpgsql
as $$
begin
  new.server_ts := now();
  return new;
end;
$$;

drop trigger if exists purchases_touch on public.purchases;
create trigger purchases_touch
  before insert or update on public.purchases
  for each row execute function public.touch_server_ts();

drop trigger if exists overrides_touch on public.overrides;
create trigger overrides_touch
  before insert or update on public.overrides
  for each row execute function public.touch_server_ts();

-- Buscar "o que mudou desde X" precisa ser rápido.
create index if not exists purchases_sync_idx on public.purchases (user_id, server_ts);
create index if not exists overrides_sync_idx on public.overrides (user_id, server_ts);

-- ── Segurança: cada conta só enxerga os próprios dados ───────────────────
alter table public.purchases enable row level security;
alter table public.overrides enable row level security;

drop policy if exists purchases_own on public.purchases;
create policy purchases_own on public.purchases
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists overrides_own on public.overrides;
create policy overrides_own on public.overrides
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
