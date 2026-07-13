import { useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { listPublicadores, criarPublicador, excluirPublicador } from "../lib/publicadores";
import { listTerritorios } from "../lib/territorios";
import { listSaidas, iso, diaDaSemana, DIA_SEMANA, MES_NOME } from "../lib/saidas";
import type { Publicador, Saida, Territorio } from "../lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

export function saidasPorDirigente(saidas: Saida[]): Map<string, Saida[]> {
  const grupos = new Map<string, Saida[]>();
  const ordenadas = [...saidas].sort((a, b) =>
    a.data === b.data
      ? Number(a.periodo === "tarde") - Number(b.periodo === "tarde")
      : a.data.localeCompare(b.data),
  );
  for (const s of ordenadas) {
    if (!s.publicador_id) continue;
    const grupo = grupos.get(s.publicador_id);
    if (grupo) grupo.push(s);
    else grupos.set(s.publicador_id, [s]);
  }
  return grupos;
}

function formatTelefone(tel: string) {
  const d = tel.replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return tel;
}

function semAcento(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function diaCurto(data: string) {
  const [, mes, dia] = data.split("-");
  return `${DIA_SEMANA[diaDaSemana(data)]}, ${dia}/${mes}`;
}

export function Publicadores() {
  const [publicadores, setPublicadores] = useState<Publicador[]>([]);
  const [territorios, setTerritorios] = useState<Territorio[]>([]);
  const [saidas, setSaidas] = useState<Saida[]>([]);
  const [novoNome, setNovoNome] = useState("");
  const [novoTel, setNovoTel] = useState("");
  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(true);

  const hoje = new Date();
  const mes = { ano: hoje.getFullYear(), mes: hoje.getMonth() + 1 };

  async function carregar() {
    const [p, t, s] = await Promise.all([
      listPublicadores(),
      listTerritorios(),
      listSaidas(iso(mes, 1), iso({ ...mes, mes: mes.mes + 1 }, 0)),
    ]);
    setPublicadores(p);
    setTerritorios(t);
    setSaidas(s);
  }
  useEffect(() => {
    carregar().finally(() => setCarregando(false));
  }, []);

  const grupos = useMemo(() => saidasPorDirigente(saidas), [saidas]);
  const numeroDe = useMemo(
    () => new Map(territorios.map((t) => [t.id, t.numero])),
    [territorios],
  );
  const encontrados = useMemo(() => {
    const alvo = semAcento(busca.trim());
    if (!alvo) return publicadores;
    return publicadores.filter((p) => semAcento(p.nome).includes(alvo));
  }, [publicadores, busca]);

  async function adicionar() {
    if (!novoNome) return;
    await criarPublicador({ nome: novoNome, telefone: novoTel || undefined });
    setNovoNome("");
    setNovoTel("");
    carregar();
  }

  async function excluir(p: Publicador) {
    try {
      await excluirPublicador(p.id);
      toast.success(`Publicador ${p.nome} excluído.`);
      carregar();
    } catch (err) {
      if ((err as { code?: string }).code === "23503") {
        toast.error(
          "Não é possível excluir: este publicador tem histórico de designações ou saídas no calendário.",
        );
      } else {
        toast.error("Não foi possível excluir o publicador. Tente novamente.");
      }
    }
  }

  return (
    <div className="mx-auto grid max-w-220 gap-[clamp(20px,4vw,32px)] px-[clamp(14px,4vw,32px)] pt-[clamp(16px,4vw,40px)] pb-16">
      <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-line pb-4">
        <h2 className="text-[0.78rem] font-semibold uppercase tracking-[0.12em] text-ink-soft">
          Publicadores
        </h2>
        <p className="text-[0.9rem] text-ink-soft">
          {MES_NOME[mes.mes - 1]}{" "}
          <span className="tabular-nums text-ink-faint">{mes.ano}</span>
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Input
          className="flex-1 basis-40"
          placeholder="Nome*"
          value={novoNome}
          onChange={(e) => setNovoNome(e.target.value)}
        />
        <Input
          className="flex-1 basis-40"
          placeholder="Telefone"
          value={novoTel}
          onChange={(e) => setNovoTel(e.target.value)}
        />
        <Button onClick={adicionar} disabled={!novoNome}>
          Adicionar
        </Button>
      </div>

      {!carregando && publicadores.length > 0 && (
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint"
            aria-hidden="true"
          />
          <Input
            className="pl-9"
            type="search"
            placeholder="Buscar por nome"
            aria-label="Buscar publicador por nome"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
      )}

      {carregando ? (
        <ul role="status" aria-label="Carregando publicadores" className="grid gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <li
              key={i}
              className="grid gap-2 rounded-xl border border-line bg-white px-4 py-3.5 shadow-card"
            >
              <div className="h-4 w-40 animate-pulse rounded bg-mist" />
              <div className="h-3 w-56 animate-pulse rounded bg-mist" />
            </li>
          ))}
        </ul>
      ) : publicadores.length === 0 ? (
        <p className="py-1 text-[0.88rem] text-ink-soft">
          Nenhum publicador cadastrado. Comece adicionando o primeiro.
        </p>
      ) : encontrados.length === 0 ? (
        <p className="py-1 text-[0.88rem] text-ink-soft">
          Nenhum publicador com esse nome.
        </p>
      ) : (
        <ul className="grid gap-3">
          {encontrados.map((p) => {
            const dele = grupos.get(p.id) ?? [];
            return (
              <li
                key={p.id}
                className="grid gap-3 rounded-xl border border-line bg-white px-4 py-3.5 shadow-card"
              >
                <div className="flex items-center gap-3">
                  <span className="font-medium text-ink">{p.nome}</span>
                  {p.telefone && (
                    <span className="font-mono text-[0.8rem] tabular-nums text-ink-soft">
                      {formatTelefone(p.telefone)}
                    </span>
                  )}
                  <span className="flex-1" />
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button
                        type="button"
                        aria-label={`Excluir ${p.nome}`}
                        className="grid size-6 flex-none place-items-center rounded-full text-ink-faint transition-colors hover:bg-danger/10 hover:text-destructive focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-destructive"
                      >
                        <X className="size-4" aria-hidden="true" />
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir o publicador {p.nome}?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta ação não pode ser desfeita.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          variant="destructive"
                          onClick={() => excluir(p)}
                        >
                          Excluir
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>

                {dele.length === 0 ? (
                  <p className="border-t border-line pt-3 text-[0.82rem] text-ink-faint">
                    Sem saídas neste mês
                  </p>
                ) : (
                  <ul className="grid gap-1.5 border-t border-line pt-3">
                    {dele.map((s) => (
                      <li
                        key={s.id}
                        className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.85rem]"
                      >
                        <span className="text-ink">{diaCurto(s.data)}</span>
                        <span className="text-ink-faint">·</span>
                        <span className="text-ink-soft">
                          {s.periodo === "manha" ? "manhã" : "tarde"}
                        </span>
                        <span className="flex flex-wrap gap-1">
                          {s.territorio_ids.map((tid) => (
                            <span
                              key={tid}
                              className="rounded-full bg-jwblue-wash px-2 py-0.5 font-mono text-[0.76rem] tabular-nums text-jwblue-deep"
                            >
                              {numeroDe.get(tid) ?? "?"}
                            </span>
                          ))}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
