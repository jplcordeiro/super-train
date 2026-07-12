import { supabase } from "./supabase";
import type { Periodo, Saida, CalendarioNota } from "./types";

export interface Mes {
  ano: number;
  mes: number;
}

export const DIA_SEMANA = [
  "domingo",
  "segunda",
  "terça",
  "quarta",
  "quinta",
  "sexta",
  "sábado",
] as const;

export function iso({ ano, mes }: Mes, dia: number): string {
  const d = new Date(ano, mes - 1, dia);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export function mesDe(data: string): Mes {
  const [ano, mes] = data.split("-").map(Number);
  return { ano, mes };
}

export function diaDe(data: string): number {
  return Number(data.split("-")[2]);
}

export function diaDaSemana(data: string): number {
  const [ano, mes, dia] = data.split("-").map(Number);
  return new Date(ano, mes - 1, dia).getDay();
}

export function mesVizinho({ ano, mes }: Mes, passos: number): Mes {
  const d = new Date(ano, mes - 1 + passos, 1);
  return { ano: d.getFullYear(), mes: d.getMonth() + 1 };
}

export function mesmoMes(data: string, m: Mes): boolean {
  const d = mesDe(data);
  return d.ano === m.ano && d.mes === m.mes;
}

export function gradeDoMes(m: Mes): string[] {
  const primeiro = new Date(m.ano, m.mes - 1, 1);
  const ultimo = new Date(m.ano, m.mes, 0);
  const inicio = 1 - primeiro.getDay();
  const fim = ultimo.getDate() + (6 - ultimo.getDay());
  const dias: string[] = [];
  for (let dia = inicio; dia <= fim; dia++) dias.push(iso(m, dia));
  return dias;
}

export function dataBR(data: string): string {
  const [ano, mes, dia] = data.split("-");
  return `${dia}/${mes}/${ano}`;
}

export function dataISO(texto: string): string | null {
  const partes = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto);
  if (!partes) return null;
  const [, dia, mes, ano] = partes;
  const d = new Date(Number(ano), Number(mes) - 1, Number(dia));
  if (
    d.getFullYear() !== Number(ano) ||
    d.getMonth() !== Number(mes) - 1 ||
    d.getDate() !== Number(dia)
  ) {
    return null;
  }
  return `${ano}-${mes}-${dia}`;
}

export function mascaraData(texto: string): string {
  const digitos = texto.replace(/\D/g, "").slice(0, 8);
  const partes = [digitos.slice(0, 2), digitos.slice(2, 4), digitos.slice(4)];
  return partes.filter((p) => p).join("/");
}

export function datasSemanaisAteFimDoMes(data: string): string[] {
  const m = mesDe(data);
  const ultimoDia = new Date(m.ano, m.mes, 0).getDate();
  const datas: string[] = [];
  for (let dia = diaDe(data); dia <= ultimoDia; dia += 7) datas.push(iso(m, dia));
  return datas;
}

const ORDEM_PERIODO: Record<Periodo, number> = { manha: 0, tarde: 1 };

export function saidasDoDia(saidas: Saida[], data: string): Saida[] {
  return saidas
    .filter((s) => s.data === data)
    .sort(
      (a, b) =>
        ORDEM_PERIODO[a.periodo] - ORDEM_PERIODO[b.periodo] ||
        a.created_at.localeCompare(b.created_at),
    );
}

export function locaisUsados(saidas: Saida[]): string[] {
  const locais = new Set<string>();
  for (const s of saidas) if (s.local) locais.add(s.local);
  return [...locais].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export interface EntradaSaida {
  data: string;
  periodo: Periodo;
  local: string | null;
  publicador_id: string | null;
  observacao: string | null;
  territorio_ids: string[];
}

interface SaidaRow extends Omit<Saida, "territorio_ids"> {
  saida_territorio: { territorio_id: string }[];
}

const SELECT_SAIDA = "*, saida_territorio(territorio_id)";

function comTerritorios(row: SaidaRow): Saida {
  const { saida_territorio, ...saida } = row;
  return { ...saida, territorio_ids: saida_territorio.map((v) => v.territorio_id) };
}

export async function listSaidas(de: string, ate: string): Promise<Saida[]> {
  const { data, error } = await supabase
    .from("saida")
    .select(SELECT_SAIDA)
    .gte("data", de)
    .lte("data", ate);
  if (error) throw error;
  return (data as SaidaRow[]).map(comTerritorios);
}

async function vincularTerritorios(saida_id: string, territorio_ids: string[]) {
  if (territorio_ids.length === 0) return;
  const { error } = await supabase
    .from("saida_territorio")
    .insert(territorio_ids.map((territorio_id) => ({ saida_id, territorio_id })));
  if (error) throw error;
}

export async function criarSaidas(
  entrada: EntradaSaida,
  datas: string[] = [entrada.data],
): Promise<void> {
  const { territorio_ids, ...campos } = entrada;
  const { data, error } = await supabase
    .from("saida")
    .insert(datas.map((d) => ({ ...campos, data: d })))
    .select("id");
  if (error) throw error;
  for (const { id } of data as { id: string }[]) {
    await vincularTerritorios(id, territorio_ids);
  }
}

export async function atualizarSaida(id: string, entrada: EntradaSaida): Promise<void> {
  const { territorio_ids, ...campos } = entrada;
  const { error } = await supabase.from("saida").update(campos).eq("id", id);
  if (error) throw error;

  const { error: erroLimpeza } = await supabase
    .from("saida_territorio")
    .delete()
    .eq("saida_id", id);
  if (erroLimpeza) throw erroLimpeza;

  await vincularTerritorios(id, territorio_ids);
}

export async function excluirSaida(id: string): Promise<void> {
  const { error } = await supabase.from("saida").delete().eq("id", id);
  if (error) throw error;
}

export async function notaDoMes(m: Mes): Promise<string> {
  const { data, error } = await supabase
    .from("calendario_nota")
    .select("*")
    .eq("mes", iso(m, 1))
    .maybeSingle();
  if (error) throw error;
  return (data as CalendarioNota | null)?.texto ?? "";
}

export async function salvarNota(m: Mes, texto: string): Promise<void> {
  const mes = iso(m, 1);
  if (!texto.trim()) {
    const { error } = await supabase.from("calendario_nota").delete().eq("mes", mes);
    if (error) throw error;
    return;
  }
  const { error } = await supabase
    .from("calendario_nota")
    .upsert({ mes, texto: texto.trim() });
  if (error) throw error;
}
