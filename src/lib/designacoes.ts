import { supabase } from "./supabase";
import type { Designacao } from "./types";

export async function designacoesAbertas(): Promise<Designacao[]> {
  const { data, error } = await supabase
    .from("designacao")
    .select("*")
    .is("data_devolucao", null);
  if (error) throw error;
  return data as Designacao[];
}

export async function designar(
  territorio_id: string,
  publicador_id: string,
): Promise<Designacao> {
  const { data, error } = await supabase
    .from("designacao")
    .insert({ territorio_id, publicador_id })
    .select()
    .single();
  if (error) throw error;
  return data as Designacao;
}

export async function devolver(designacao_id: string): Promise<void> {
  const { error } = await supabase
    .from("designacao")
    .update({ data_devolucao: new Date().toISOString().slice(0, 10) })
    .eq("id", designacao_id);
  if (error) throw error;
}
