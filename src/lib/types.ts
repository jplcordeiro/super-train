export type Limites = GeoJSON.Polygon | GeoJSON.MultiPolygon;

export interface Territorio {
  id: string;
  numero: string;
  nome: string | null;
  limites: Limites | null;
  ativo: boolean;
  created_at: string;
}

export interface Publicador {
  id: string;
  nome: string;
  telefone: string | null;
  created_at: string;
}

export interface Designacao {
  id: string;
  territorio_id: string;
  publicador_id: string;
  data_saida: string;
  data_devolucao: string | null;
  created_at: string;
}

export type Periodo = "manha" | "tarde";

export interface Saida {
  id: string;
  data: string;
  periodo: Periodo;
  local: string | null;
  publicador_id: string | null;
  observacao: string | null;
  created_at: string;
  territorio_ids: string[];
}

export interface CalendarioNota {
  mes: string;
  texto: string;
}
