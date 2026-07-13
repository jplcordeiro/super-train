import { supabase } from "./supabase";
import { quadrasDe } from "./territorios";
import type { Territorio } from "./types";

export interface Marca {
  saida_id: string;
  territorio_id: string;
  quadra_id: string;
  data: string;
}

export interface Progresso {
  feitas: number;
  total: number;
  concluido: boolean;
}

export function marcasDaRodada(t: Territorio, marcas: Marca[]): Marca[] {
  return marcas.filter(
    (m) =>
      m.territorio_id === t.id && (!t.progresso_desde || m.data >= t.progresso_desde),
  );
}

export function quadrasFeitasDe(t: Territorio, marcas: Marca[]): Set<string> {
  const existentes = new Set(quadrasDe(t.limites).map((q) => q.id));
  return new Set(
    marcasDaRodada(t, marcas)
      .map((m) => m.quadra_id)
      .filter((id) => existentes.has(id)),
  );
}

export function progressoDe(t: Territorio, marcas: Marca[]): Progresso {
  const total = quadrasDe(t.limites).length;
  const feitas = quadrasFeitasDe(t, marcas).size;
  return { feitas, total, concluido: total > 0 && feitas === total };
}

interface MarcaRow {
  saida_id: string;
  territorio_id: string;
  quadra_id: string;
  saida: { data: string } | null;
}

export async function listMarcas(): Promise<Marca[]> {
  const { data, error } = await supabase
    .from("quadra_feita")
    .select("saida_id, territorio_id, quadra_id, saida(data)");
  if (error) throw error;
  return (data as unknown as MarcaRow[])
    .filter((m) => m.saida)
    .map(({ saida, ...m }) => ({ ...m, data: saida!.data }));
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

export async function iniciarNovaRodada(territorio_id: string): Promise<void> {
  const hoje = new Date();
  const data = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(
    hoje.getDate(),
  ).padStart(2, "0")}`;
  const { error } = await supabase
    .from("territorio")
    .update({ progresso_desde: data })
    .eq("id", territorio_id);
  if (error) throw error;
}
