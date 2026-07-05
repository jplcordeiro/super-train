import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listTerritorios, setAtivo, statusTerritorio, excluirTerritorio } from "../lib/territorios";
import { listPublicadores, criarPublicador, excluirPublicador } from "../lib/publicadores";
import { designacoesAbertas, designar, devolver } from "../lib/designacoes";
import type { Territorio, Publicador, Designacao } from "../lib/types";
import { LogOut, MapPin, X } from "lucide-react";
import { supabase } from "../lib/supabase";
import { TerritorioGlyph } from "./TerritorioGlyph";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { cn } from "@/lib/utils";

const STATUS_BADGE = {
  disponivel: "bg-sage-wash text-sage-ink",
  designado: "bg-jwblue-wash text-jwblue-deep",
  inativo: "bg-mist text-ink-soft",
} as const;

const STATUS_LABEL = {
  disponivel: "Disponível",
  designado: "Designado",
  inativo: "Inativo",
} as const;

// "2026-07-02" -> "02/07/2026" (avoids Date() timezone shifts on date-only strings)
function formatData(iso: string) {
  const [y, m, d] = iso.split("-");
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

// "11912345678" -> "(11) 91234-5678"; "1132145678" -> "(11) 3214-5678"
function formatTelefone(tel: string) {
  const d = tel.replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return tel; // formato inesperado: mostra como está
}

export function Gestao() {
  const [territorios, setTerritorios] = useState<Territorio[]>([]);
  const [publicadores, setPublicadores] = useState<Publicador[]>([]);
  const [abertas, setAbertas] = useState<Designacao[]>([]);
  const [novoNome, setNovoNome] = useState("");
  const [novoTel, setNovoTel] = useState("");
  const [carregando, setCarregando] = useState(true);

  async function carregar() {
    const [t, p, d] = await Promise.all([
      listTerritorios(),
      listPublicadores(),
      designacoesAbertas(),
    ]);
    setTerritorios(t);
    setPublicadores(p);
    setAbertas(d);
  }
  useEffect(() => {
    // só o carregamento inicial mostra o skeleton; recargas após ações não
    carregar().finally(() => setCarregando(false));
  }, []);

  const abertaDe = (tid: string) => abertas.find((d) => d.territorio_id === tid);
  const nomePub = (pid: string) =>
    publicadores.find((p) => p.id === pid)?.nome ?? "?";

  async function addPublicador() {
    if (!novoNome) return;
    await criarPublicador({ nome: novoNome, telefone: novoTel || undefined });
    setNovoNome("");
    setNovoTel("");
    carregar();
  }

  async function excluir(t: Territorio) {
    try {
      await excluirTerritorio(t.id);
      toast.success(`Território Nº ${t.numero} excluído.`);
      carregar();
    } catch (err) {
      if ((err as { code?: string }).code === "23503") {
        toast.error(
          "Não é possível excluir: este território tem histórico de designações.",
        );
      } else {
        toast.error("Não foi possível excluir o território. Tente novamente.");
      }
    }
  }

  async function excluirPub(p: Publicador) {
    try {
      await excluirPublicador(p.id);
      toast.success(`Publicador ${p.nome} excluído.`);
      carregar();
    } catch (err) {
      if ((err as { code?: string }).code === "23503") {
        toast.error(
          "Não é possível excluir: este publicador tem histórico de designações.",
        );
      } else {
        toast.error("Não foi possível excluir o publicador. Tente novamente.");
      }
    }
  }

  const disponiveis = territorios.filter(
    (t) => statusTerritorio(t, abertaDe(t.id)) === "disponivel",
  ).length;
  const designados = abertas.length;

  const dt = "order-2 text-[0.68rem] uppercase tracking-[0.08em] text-ink-soft";
  const ddBase =
    "order-1 m-0 font-mono text-2xl font-medium leading-none tabular-nums";

  return (
    <div className="mx-auto grid max-w-[880px] gap-[clamp(20px,4vw,32px)] px-[clamp(14px,4vw,32px)] pt-[clamp(16px,4vw,40px)] pb-16">
      <header className="flex flex-wrap items-end justify-between gap-5 border-b border-line pb-[clamp(16px,3vw,24px)]">
        <div className="flex items-center gap-3.5">
          <svg
            className="h-10 w-10 flex-none text-jwblue"
            viewBox="0 0 100 100"
            aria-hidden="true"
            fill="none"
          >
            <path
              d="M20 34 L50 20 L80 34 L80 68 L50 82 L20 68 Z"
              stroke="currentColor"
              strokeWidth="6"
              strokeLinejoin="round"
            />
            <circle cx="50" cy="51" r="7" fill="currentColor" />
          </svg>
          <div>
            <h1 className="text-2xl font-semibold tracking-[-0.02em] text-ink">
              polygon
            </h1>
            <p className="mt-0.5 text-[0.82rem] tracking-[0.01em] text-ink-soft">
              Gestão de territórios
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => supabase.auth.signOut()}
            className="text-ink-soft hover:text-jwblue"
          >
            <LogOut aria-hidden="true" />
            Sair
          </Button>
          <dl className="flex gap-[22px]">
            <div className="grid gap-px text-right">
              <dt className={dt}>Territórios</dt>
              <dd className={`${ddBase} text-ink`}>{territorios.length}</dd>
            </div>
            <div className="grid gap-px text-right">
              <dt className={dt}>Disponíveis</dt>
              <dd className={`${ddBase} text-sage`}>{disponiveis}</dd>
            </div>
            <div className="grid gap-px text-right">
              <dt className={dt}>Designados</dt>
              <dd className={`${ddBase} text-jwblue`}>{designados}</dd>
            </div>
          </dl>
        </div>
      </header>

      <section className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[0.78rem] font-semibold uppercase tracking-[0.12em] text-ink-soft">
            Territórios
          </h2>
          <Button asChild>
            <Link to="/cadastro">Cadastrar território</Link>
          </Button>
        </div>

        {carregando ? (
          <ul
            role="status"
            aria-label="Carregando territórios"
            className="grid grid-cols-1 gap-3 min-[620px]:grid-cols-2"
          >
            {Array.from({ length: 4 }).map((_, i) => (
              <li
                key={i}
                className="flex items-center gap-3.5 rounded-xl border border-line bg-white px-4 py-3.5 shadow-card"
              >
                <div className="h-11 w-11 flex-none animate-pulse rounded-lg bg-mist" />
                <div className="grid flex-1 gap-2">
                  <div className="h-4 w-12 animate-pulse rounded bg-mist" />
                  <div className="h-3 w-24 animate-pulse rounded bg-mist" />
                </div>
                <div className="h-6 w-20 flex-none animate-pulse rounded-full bg-mist" />
              </li>
            ))}
          </ul>
        ) : territorios.length === 0 ? (
          <p className="py-1 text-[0.88rem] text-ink-soft">
            Nenhum território ainda. Comece cadastrando o primeiro.
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-3 min-[620px]:grid-cols-2">
            {territorios.map((t) => {
              const d = abertaDe(t.id);
              const status = statusTerritorio(t, d);
              return (
                <li
                  key={t.id}
                  className="grid grid-cols-[auto_1fr_auto] items-center gap-3.5 rounded-xl border border-line bg-white px-4 py-3.5 shadow-card"
                >
                  {/* O selo é a "cara" do território e o alvo natural do mapa:
                      tocá-lo abre a navegação de campo. */}
                  <Link
                    to={`/campo/${t.id}`}
                    aria-label={`Abrir mapa do território Nº ${t.numero}`}
                    className="h-11 w-11 flex-none rounded-lg text-jwblue transition-shadow hover:ring-2 hover:ring-jwblue/25"
                  >
                    <TerritorioGlyph poligono={t.limites} />
                  </Link>

                  <div className="grid min-w-0 gap-0.5">
                    <Link
                      className="flex w-fit items-center gap-1 font-mono text-[1.15rem] font-medium tracking-[-0.01em] tabular-nums text-ink no-underline hover:text-jwblue"
                      to={`/campo/${t.id}`}
                    >
                      {t.numero}
                      <MapPin
                        className="size-3.5 flex-none text-jwblue"
                        aria-hidden="true"
                      />
                    </Link>
                    <span className="truncate text-[0.9rem] text-ink-soft">
                      {t.nome ?? "Sem nome"}
                    </span>
                  </div>

                  <div className="grid justify-items-end gap-[3px] text-right">
                    <Badge
                      className={cn(
                        "gap-1.5 pl-2 pr-2.5 before:size-1.5 before:rounded-full before:bg-current before:content-['']",
                        STATUS_BADGE[status],
                      )}
                    >
                      {STATUS_LABEL[status]}
                    </Badge>
                    {d && (
                      <span className="text-[0.76rem] text-ink-soft">
                        <b className="font-medium text-ink">
                          {nomePub(d.publicador_id)}
                        </b>{" "}
                        · desde {formatData(d.data_saida)}
                      </span>
                    )}
                  </div>

                  <div className="col-span-full flex flex-wrap items-center gap-2 border-t border-line pt-3">
                    {d ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          await devolver(d.id);
                          toast.success(`Território Nº ${t.numero} devolvido.`);
                          carregar();
                        }}
                      >
                        Devolver
                      </Button>
                    ) : (
                      <Select
                        disabled={publicadores.length === 0}
                        onValueChange={async (v) => {
                          await designar(t.id, v);
                          toast.success(
                            `Território Nº ${t.numero} designado a ${nomePub(v)}.`,
                          );
                          carregar();
                        }}
                      >
                        <SelectTrigger size="sm">
                          <SelectValue placeholder="Designar a…" />
                        </SelectTrigger>
                        <SelectContent>
                          {publicadores.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}

                    <span className="flex-1" />

                    <label className="inline-flex cursor-pointer select-none items-center gap-2 text-[0.82rem] text-ink-soft">
                      <Checkbox
                        checked={t.ativo}
                        onCheckedChange={async (v) => {
                          await setAtivo(t.id, v === true);
                          carregar();
                        }}
                      />
                      Ativo
                    </label>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="min-h-9 px-2 text-xs text-ink-soft hover:bg-transparent hover:text-destructive"
                        >
                          Excluir
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            Excluir o território Nº {t.numero}?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta ação não pode ser desfeita.
                            {t.nome ? ` (${t.nome})` : ""}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            variant="destructive"
                            onClick={() => excluir(t)}
                          >
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="grid gap-4">
        <h2 className="text-[0.78rem] font-semibold uppercase tracking-[0.12em] text-ink-soft">
          Publicadores
        </h2>
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
          <Button onClick={addPublicador} disabled={!novoNome}>
            Adicionar
          </Button>
        </div>
        {publicadores.length === 0 ? (
          <p className="py-1 text-[0.88rem] text-ink-soft">
            Nenhum publicador cadastrado.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {publicadores.map((p) => (
              <li
                key={p.id}
                className="inline-flex items-center gap-2 rounded-full border border-line bg-white py-[6px] pl-[13px] pr-[7px] text-[0.88rem]"
              >
                <span className="inline-flex items-baseline gap-2">
                  {p.nome}
                  {p.telefone && (
                    <span className="font-mono text-[0.78rem] tabular-nums text-ink-soft">
                      {formatTelefone(p.telefone)}
                    </span>
                  )}
                </span>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button
                      type="button"
                      aria-label={`Excluir ${p.nome}`}
                      className="grid size-5 flex-none place-items-center rounded-full text-ink-faint transition-colors hover:bg-danger/10 hover:text-destructive focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-destructive"
                    >
                      <X className="size-3.5" aria-hidden="true" />
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        Excluir o publicador {p.nome}?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta ação não pode ser desfeita.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        variant="destructive"
                        onClick={() => excluirPub(p)}
                      >
                        Excluir
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
