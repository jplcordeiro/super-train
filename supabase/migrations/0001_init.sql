-- super-train — schema inicial (MVP)
-- Rode este arquivo em Supabase → SQL Editor (uma vez).

create table if not exists territorio (
  id         uuid primary key default gen_random_uuid(),
  numero     text not null unique,
  nome       text,
  limites    jsonb,                         -- polígono GeoJSON (geometry)
  ativo      boolean not null default true, -- false = "não designar por enquanto"
  created_at timestamptz not null default now()
);

create table if not exists publicador (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null,
  telefone   text,
  created_at timestamptz not null default now()
);

create table if not exists designacao (
  id             uuid primary key default gen_random_uuid(),
  territorio_id  uuid not null references territorio(id) on delete restrict,
  publicador_id  uuid not null references publicador(id) on delete restrict,
  data_saida     date not null default current_date,
  data_devolucao date,
  created_at     timestamptz not null default now()
);

-- No máximo UMA designação aberta por território.
create unique index if not exists designacao_territorio_aberta_uidx
  on designacao (territorio_id)
  where data_devolucao is null;

-- Índices de apoio às consultas por território/publicador.
create index if not exists designacao_territorio_idx on designacao (territorio_id);
create index if not exists designacao_publicador_idx on designacao (publicador_id);

-- ------- RLS: autenticado = tudo, anônimo = nada -------
alter table territorio enable row level security;
alter table publicador enable row level security;
alter table designacao enable row level security;

create policy "auth_full_territorio" on territorio
  for all to authenticated using (true) with check (true);
create policy "auth_full_publicador" on publicador
  for all to authenticated using (true) with check (true);
create policy "auth_full_designacao" on designacao
  for all to authenticated using (true) with check (true);
