-- super-train — ponto de parada ("paramos aqui")
-- Rode este arquivo em Supabase → SQL Editor (uma vez).

-- Um pino por quadra: onde o grupo parou, pra próxima saída continuar dali.
-- saida_id registra qual saída deixou o pino (data/local/dirigente saem dela).
-- FK composta para saida_territorio, como quadra_feita: só se marca de um
-- território que está naquela saída, e o cascade limpa o pino quando a saída
-- é apagada ou o território sai dela.
create table if not exists ponto_parada (
  territorio_id uuid not null,
  quadra_id     text not null,
  saida_id      uuid not null,
  lng           double precision not null,
  lat           double precision not null,
  created_at    timestamptz not null default now(),
  primary key (territorio_id, quadra_id),
  foreign key (saida_id, territorio_id)
    references saida_territorio (saida_id, territorio_id) on delete cascade
);

alter table ponto_parada enable row level security;

drop policy if exists "auth_full_ponto_parada" on ponto_parada;
create policy "auth_full_ponto_parada" on ponto_parada
  for all to authenticated using (true) with check (true);
