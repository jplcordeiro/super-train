export interface Territorio {
  id: string;
  numero: string;
  nome: string | null;
  limites: GeoJSON.Polygon | null;
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
  data_saida: string; // ISO date (YYYY-MM-DD)
  data_devolucao: string | null;
  created_at: string;
}
