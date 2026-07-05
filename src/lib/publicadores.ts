import { supabase } from "./supabase";
import type { Publicador } from "./types";

export async function listPublicadores(): Promise<Publicador[]> {
  const { data, error } = await supabase
    .from("publicador")
    .select("*")
    .order("nome");
  if (error) throw error;
  return data as Publicador[];
}

export async function criarPublicador(input: {
  nome: string;
  telefone?: string;
}): Promise<Publicador> {
  const { data, error } = await supabase
    .from("publicador")
    .insert({ nome: input.nome, telefone: input.telefone ?? null })
    .select()
    .single();
  if (error) throw error;
  return data as Publicador;
}

export async function excluirPublicador(id: string): Promise<void> {
  const { error } = await supabase.from("publicador").delete().eq("id", id);
  if (error) throw error; // 23503 = publicador tem designação; tratado na UI
}
