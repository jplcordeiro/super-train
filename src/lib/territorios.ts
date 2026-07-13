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

export interface Quadra {
  id: string;
  coordinates: GeoJSON.Position[][];
}

export function quadrasDe(limites: Limites | null): Quadra[] {
  if (!limites) return [];
  if (limites.type === "FeatureCollection") {
    return limites.features.map((f, i) => ({
      id: String(f.properties?.id ?? f.id ?? i),
      coordinates: f.geometry.coordinates,
    }));
  }
  const quadras =
    limites.type === "MultiPolygon" ? limites.coordinates : [limites.coordinates];
  return quadras.map((coordinates, i) => ({ id: String(i), coordinates }));
}

export function limitesDe(
  features: GeoJSON.Feature[],
): GeoJSON.FeatureCollection<GeoJSON.Polygon> | null {
  const poligonos = features.filter((f) => f.geometry?.type === "Polygon");
  if (poligonos.length === 0) return null;
  return {
    type: "FeatureCollection",
    features: poligonos.map((f) => ({
      type: "Feature",
      properties: { id: String(f.properties?.id ?? f.id ?? crypto.randomUUID()) },
      geometry: f.geometry as GeoJSON.Polygon,
    })),
  };
}

export function geometriaDe(limites: Limites | null): GeoJSON.MultiPolygon | null {
  const quadras = quadrasDe(limites);
  if (quadras.length === 0) return null;
  return { type: "MultiPolygon", coordinates: quadras.map((q) => q.coordinates) };
}

export function featureCollectionDe(limites: Limites | null): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: quadrasDe(limites).map((q) => ({
      type: "Feature",
      id: q.id,
      properties: { id: q.id },
      geometry: { type: "Polygon", coordinates: q.coordinates },
    })),
  };
}

export function boundsDeTerritorios(territorios: Territorio[]): Bounds | null {
  let minLng = Infinity,
    minLat = Infinity,
    maxLng = -Infinity,
    maxLat = -Infinity;
  for (const t of territorios) {
    for (const quadra of quadrasDe(t.limites)) {
      for (const anel of quadra.coordinates) {
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
  limites: GeoJSON.FeatureCollection<GeoJSON.Polygon>;
}): Promise<Territorio> {
  const { data, error } = await supabase
    .from("territorio")
    .insert({ numero: input.numero, nome: input.nome ?? null, limites: input.limites })
    .select()
    .single();
  if (error) throw error;
  return data as Territorio;
}

export async function atualizarTerritorio(
  id: string,
  input: {
    numero: string;
    nome?: string;
    limites: GeoJSON.FeatureCollection<GeoJSON.Polygon>;
  },
): Promise<void> {
  const { error } = await supabase
    .from("territorio")
    .update({
      numero: input.numero,
      nome: input.nome ?? null,
      limites: input.limites,
    })
    .eq("id", id);
  if (error) throw error;
}

export async function setAtivo(id: string, ativo: boolean): Promise<void> {
  const { error } = await supabase.from("territorio").update({ ativo }).eq("id", id);
  if (error) throw error;
}

export async function excluirTerritorio(id: string): Promise<void> {
  const { error } = await supabase.from("territorio").delete().eq("id", id);
  if (error) throw error;
}
