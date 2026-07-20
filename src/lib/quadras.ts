import { supabase } from "./supabase";
import { quadrasDe } from "./territorios";
import { mesmoMes, type Mes } from "./saidas";
import { comRodada, rodadasDe, type EmRodada } from "./rodadas";
import type { Publicador, Rodada, Territorio } from "./types";

export interface Marca {
  saida_id: string;
  territorio_id: string;
  quadra_id: string;
  data: string;
  local: string | null;
  publicador_id: string | null;
}

export interface PassagemQuadra {
  data: string;
  local: string | null;
  dirigente: string | null;
}

export interface Parada {
  territorio_id: string;
  quadra_id: string;
  saida_id: string;
  lng: number;
  lat: number;
  data: string;
  local: string | null;
  publicador_id: string | null;
}

export interface Progresso {
  feitas: number;
  total: number;
  emAndamento: number;
  concluido: boolean;
}

export function marcasDaRodada(t: EmRodada, marcas: Marca[]): Marca[] {
  return marcas.filter(
    (m) => m.territorio_id === t.id && (!t.inicio || m.data >= t.inicio),
  );
}

export function quadrasFeitasDe(t: EmRodada, marcas: Marca[]): Set<string> {
  const existentes = new Set(quadrasDe(t.limites).map((q) => q.id));
  return new Set(
    marcasDaRodada(t, marcas)
      .map((m) => m.quadra_id)
      .filter((id) => existentes.has(id)),
  );
}

export function paradasDaRodada(t: EmRodada, paradas: Parada[]): Parada[] {
  return paradas.filter(
    (p) => p.territorio_id === t.id && (!t.inicio || p.data >= t.inicio),
  );
}

export function paradaAtualDe(
  t: EmRodada,
  marcas: Marca[],
  paradas: Parada[],
): Map<string, Parada> {
  const existentes = new Set(quadrasDe(t.limites).map((q) => q.id));
  const feitas = quadrasFeitasDe(t, marcas);
  const atual = new Map<string, Parada>();
  for (const p of paradasDaRodada(t, paradas)) {
    if (!existentes.has(p.quadra_id) || feitas.has(p.quadra_id)) continue;
    atual.set(p.quadra_id, p);
  }
  return atual;
}

export function historicoDaQuadra(
  territorio_id: string,
  quadra_id: string,
  marcas: Marca[],
  publicadores: Publicador[],
): PassagemQuadra[] {
  const nome = (id: string | null) =>
    id ? (publicadores.find((p) => p.id === id)?.nome ?? null) : null;
  return marcas
    .filter((m) => m.territorio_id === territorio_id && m.quadra_id === quadra_id)
    .map((m) => ({ data: m.data, local: m.local, dirigente: nome(m.publicador_id) }))
    .sort((a, b) => b.data.localeCompare(a.data));
}

export function progressoDe(
  t: EmRodada,
  marcas: Marca[],
  paradas: Parada[] = [],
): Progresso {
  const total = quadrasDe(t.limites).length;
  const feitas = quadrasFeitasDe(t, marcas).size;
  const emAndamento = paradaAtualDe(t, marcas, paradas).size;
  return { feitas, total, emAndamento, concluido: total > 0 && feitas === total };
}

export interface LinhaRelatorio {
  territorio: EmRodada;
  feitasNoMes: number;
  total: number;
  concluidoNoMes: boolean;
}

export interface PassagemMes {
  saida_id: string;
  data: string;
  local: string | null;
  quadras: number;
}

export function passagensDoMes(
  t: Territorio,
  m: Mes,
  marcas: Marca[],
): PassagemMes[] {
  const existentes = new Set(quadrasDe(t.limites).map((q) => q.id));
  const porSaida = new Map<string, PassagemMes & { vistas: Set<string> }>();

  for (const mk of marcas) {
    if (mk.territorio_id !== t.id) continue;
    if (!existentes.has(mk.quadra_id)) continue;
    if (!mesmoMes(mk.data, m)) continue;

    const atual = porSaida.get(mk.saida_id) ?? {
      saida_id: mk.saida_id,
      data: mk.data,
      local: mk.local,
      quadras: 0,
      vistas: new Set<string>(),
    };
    atual.vistas.add(mk.quadra_id);
    atual.quadras = atual.vistas.size;
    porSaida.set(mk.saida_id, atual);
  }

  return [...porSaida.values()]
    .map(({ vistas: _vistas, ...passagem }) => passagem)
    .sort((a, b) => a.data.localeCompare(b.data) || a.saida_id.localeCompare(b.saida_id));
}

export function fechamentosDe(
  t: Territorio,
  marcas: Marca[],
  rodadas: Rodada[],
): string[] {
  const existentes = new Set(quadrasDe(t.limites).map((q) => q.id));
  const total = existentes.size;
  if (total === 0) return [];

  const doTerritorio = marcas
    .filter((m) => m.territorio_id === t.id && existentes.has(m.quadra_id))
    .sort((a, b) => a.data.localeCompare(b.data));

  const cortes = rodadasDe(t.id, rodadas).map((r) => r.inicio);
  const fechamentos: string[] = [];
  for (const [k, inicio] of [null, ...cortes].entries()) {
    const fim = cortes[k] ?? null;
    const vistas = new Set<string>();
    for (const m of doTerritorio) {
      if (inicio && m.data < inicio) continue;
      if (fim && m.data >= fim) continue;
      vistas.add(m.quadra_id);
      if (vistas.size === total) {
        fechamentos.push(m.data);
        break;
      }
    }
  }
  return fechamentos;
}

export interface RelatorioMes {
  linhas: LinhaRelatorio[];
  totalQuadrasNoMes: number;
  totalConcluidos: number;
}

export function relatorioDoMes(
  m: Mes,
  territorios: Territorio[],
  marcas: Marca[],
  rodadas: Rodada[] = [],
): RelatorioMes {
  const linhas: LinhaRelatorio[] = [];
  for (const t of territorios) {
    const existentes = new Set(quadrasDe(t.limites).map((q) => q.id));
    const total = existentes.size;

    const feitasNoMes = new Set(
      marcas
        .filter(
          (mk) =>
            mk.territorio_id === t.id &&
            existentes.has(mk.quadra_id) &&
            mesmoMes(mk.data, m),
        )
        .map((mk) => mk.quadra_id),
    ).size;

    const concluidoNoMes = fechamentosDe(t, marcas, rodadas).some((d) =>
      mesmoMes(d, m),
    );

    if (feitasNoMes > 0 || concluidoNoMes) {
      linhas.push({
        territorio: comRodada(t, rodadas),
        feitasNoMes,
        total,
        concluidoNoMes,
      });
    }
  }
  return {
    linhas,
    totalQuadrasNoMes: linhas.reduce((soma, l) => soma + l.feitasNoMes, 0),
    totalConcluidos: linhas.filter((l) => l.concluidoNoMes).length,
  };
}

type MarcaRow = Omit<Marca, "data" | "local" | "publicador_id">;
type SaidaRow = { id: string; data: string; local: string | null; publicador_id: string | null };
type ParadaRow = {
  territorio_id: string;
  quadra_id: string;
  saida_id: string;
  lng: number;
  lat: number;
};

export async function listMarcas(): Promise<Marca[]> {
  const [marcadas, saidas] = await Promise.all([
    supabase.from("quadra_feita").select("saida_id, territorio_id, quadra_id"),
    supabase.from("saida").select("id, data, local, publicador_id"),
  ]);
  if (marcadas.error) throw marcadas.error;
  if (saidas.error) throw saidas.error;

  const saidaDe = new Map((saidas.data as SaidaRow[]).map((s) => [s.id, s]));
  return (marcadas.data as MarcaRow[]).flatMap((m) => {
    const s = saidaDe.get(m.saida_id);
    return s
      ? [{ ...m, data: s.data, local: s.local, publicador_id: s.publicador_id }]
      : [];
  });
}

export async function listParadas(): Promise<Parada[]> {
  const [paradas, saidas] = await Promise.all([
    supabase.from("ponto_parada").select("territorio_id, quadra_id, saida_id, lng, lat"),
    supabase.from("saida").select("id, data, local, publicador_id"),
  ]);
  if (paradas.error) throw paradas.error;
  if (saidas.error) throw saidas.error;

  const saidaDe = new Map((saidas.data as SaidaRow[]).map((s) => [s.id, s]));
  return (paradas.data as ParadaRow[]).flatMap((p) => {
    const s = saidaDe.get(p.saida_id);
    return s
      ? [{ ...p, data: s.data, local: s.local, publicador_id: s.publicador_id }]
      : [];
  });
}

export async function pararEm(
  saida_id: string,
  territorio_id: string,
  quadra_id: string,
  lng: number,
  lat: number,
): Promise<void> {
  const { error } = await supabase
    .from("ponto_parada")
    .upsert(
      { saida_id, territorio_id, quadra_id, lng, lat },
      { onConflict: "territorio_id,quadra_id" },
    );
  if (error) throw error;
}

export async function limparParada(
  territorio_id: string,
  quadra_id: string,
): Promise<void> {
  const { error } = await supabase
    .from("ponto_parada")
    .delete()
    .eq("territorio_id", territorio_id)
    .eq("quadra_id", quadra_id);
  if (error) throw error;
}

export async function marcarQuadra(
  saida_id: string,
  territorio_id: string,
  quadra_id: string,
): Promise<void> {
  const { error } = await supabase
    .from("quadra_feita")
    .insert({ saida_id, territorio_id, quadra_id });
  if (error) throw error;
}

export async function desmarcarQuadra(
  saida_id: string,
  territorio_id: string,
  quadra_id: string,
): Promise<void> {
  const { error } = await supabase
    .from("quadra_feita")
    .delete()
    .eq("saida_id", saida_id)
    .eq("territorio_id", territorio_id)
    .eq("quadra_id", quadra_id);
  if (error) throw error;
}

