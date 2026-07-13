-- super-train — quadras feitas (progresso do território)
-- Rode este arquivo em Supabase → SQL Editor (uma vez).

-- 1) Linha de corte da rodada. Nula = conta tudo.
alter table territorio add column if not exists progresso_desde date;

-- 2) A marca. Sem data (é a da saída) e sem flag: a linha existir É a quadra feita.
--    A FK composta para saida_territorio garante que só se marca quadra de um
--    território que está naquela saída, e limpa as marcas sozinha quando a saída
--    é apagada ou o território sai dela.
create table if not exists quadra_feita (
  saida_id      uuid not null,
  territorio_id uuid not null,
  quadra_id     text not null,
  created_at    timestamptz not null default now(),
  primary key (saida_id, territorio_id, quadra_id),
  foreign key (saida_id, territorio_id)
    references saida_territorio (saida_id, territorio_id) on delete cascade
);

create index if not exists quadra_feita_territorio_idx on quadra_feita (territorio_id);

alter table quadra_feita enable row level security;

drop policy if exists "auth_full_quadra_feita" on quadra_feita;
create policy "auth_full_quadra_feita" on quadra_feita
  for all to authenticated using (true) with check (true);

-- 3) limites: MultiPolygon/Polygon -> FeatureCollection com um id por quadra.
--    Sem isso, uma quadra é só a posição N num array: apagar uma quadra do meio
--    no Cadastro deslocaria todas as seguintes e as marcas passariam a apontar
--    para a quadra errada, em silêncio.
update territorio t
set limites = jsonb_build_object('type', 'FeatureCollection', 'features', f.features)
from (
  select t2.id,
         jsonb_agg(jsonb_build_object(
           'type', 'Feature',
           'properties', jsonb_build_object('id', gen_random_uuid()::text),
           'geometry', jsonb_build_object('type', 'Polygon', 'coordinates', c.coords)
         )) as features
  from territorio t2,
       lateral jsonb_array_elements(t2.limites->'coordinates') as c(coords)
  where t2.limites->>'type' = 'MultiPolygon'
  group by t2.id
) f
where t.id = f.id;

update territorio
set limites = jsonb_build_object(
  'type', 'FeatureCollection',
  'features', jsonb_build_array(jsonb_build_object(
    'type', 'Feature',
    'properties', jsonb_build_object('id', gen_random_uuid()::text),
    'geometry', jsonb_build_object('type', 'Polygon', 'coordinates', limites->'coordinates')
  ))
)
where limites->>'type' = 'Polygon';
