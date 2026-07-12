import { supabase } from "./supabase";
import type { Territorio, Designacao, Limites } from "./types";

export type StatusTerritorio = "disponivel" | "designado" | "inativo";

export function statusTerritorio(
  t: Territorio,
  designacaoAberta: Designacao | undefined,
): StatusTerritorio {
  if (!t.ativo) return "inativo";
  if (designacaoAberta) return "designado";
  return "disponivel";
}

export type Bounds = [[number, number], [number, number]];

export type Quadra = GeoJSON.Position[][];

export function quadrasDe(limites: Limites | null): Quadra[] {
  if (!limites) return [];
  return limites.type === "MultiPolygon" ? limites.coordinates : [limites.coordinates];
}

export function boundsDeTerritorios(territorios: Territorio[]): Bounds | null {
  let minLng = Infinity,
    minLat = Infinity,
    maxLng = -Infinity,
    maxLat = -Infinity;
  for (const t of territorios) {
    for (const quadra of quadrasDe(t.limites)) {
      for (const anel of quadra) {
        for (const [lng, lat] of anel) {
          if (lng < minLng) minLng = lng;
          if (lat < minLat) minLat = lat;
          if (lng > maxLng) maxLng = lng;
          if (lat > maxLat) maxLat = lat;
        }
      }
    }
  }
  if (minLng === Infinity) return null;
  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ];
}

export async function listTerritorios(): Promise<Territorio[]> {
  const { data, error } = await supabase
    .from("territorio")
    .select("*")
    .order("numero");
  if (error) throw error;
  return data as Territorio[];
}

export async function criarTerritorio(input: {
  numero: string;
  nome?: string;
  limites: GeoJSON.Polygon;
}): Promise<Territorio> {
  const { data, error } = await supabase
    .from("territorio")
    .insert({ numero: input.numero, nome: input.nome ?? null, limites: input.limites })
    .select()
    .single();
  if (error) throw error;
  return data as Territorio;
}

export async function setAtivo(id: string, ativo: boolean): Promise<void> {
  const { error } = await supabase.from("territorio").update({ ativo }).eq("id", id);
  if (error) throw error;
}

export async function excluirTerritorio(id: string): Promise<void> {
  const { error } = await supabase.from("territorio").delete().eq("id", id);
  if (error) throw error;
}
