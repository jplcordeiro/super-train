import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listTerritorios, excluirTerritorio } from "../lib/territorios";
import {
  iniciarNovaRodada,
  listMarcas,
  progressoDe,
  quadrasFeitasDe,
  type Marca,
} from "../lib/quadras";
import { listPublicadores } from "../lib/publicadores";
import { designacoesAbertas, devolver } from "../lib/designacoes";
import type { Territorio, Publicador, Designacao } from "../lib/types";
import { MapPin } from "lucide-react";
import { TerritorioGlyph } from "./TerritorioGlyph";
import { Button } from "@/components/ui/button";
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

function formatData(iso: string) {
  const [y, m, d] = iso.split("-");
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

export function Gestao() {
  const [territorios, setTerritorios] = useState<Territorio[]>([]);
  const [publicadores, setPublicadores] = useState<Publicador[]>([]);
  const [abertas, setAbertas] = useState<Designacao[]>([]);
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [ofertaRodada, setOfertaRodada] = useState<Territorio | null>(null);
  const [carregando, setCarregando] = useState(true);

  async function carregar() {
    const [t, p, d, m] = await Promise.all([
      listTerritorios(),
      listPublicadores(),
      designacoesAbertas(),
      listMarcas(),
    ]);
    setTerritorios(t);
    setPublicadores(p);
    setAbertas(d);
    setMarcas(m);
  }
  useEffect(() => {
    carregar().finally(() => setCarregando(false));
  }, []);

  const abertaDe = (tid: string) => abertas.find((d) => d.territorio_id === tid);
  const nomePub = (pid: string) =>
    publicadores.find((p) => p.id === pid)?.nome ?? "?";

  async function novaRodada(t: Territorio) {
    setOfertaRodada(null);
    try {
      await iniciarNovaRodada(t.id);
      toast.success(`Território Nº ${t.numero}: nova rodada começada.`);
      carregar();
    } catch {
      toast.error("Não foi possível começar a nova rodada. Tente novamente.");
    }
  }

  async function excluir(t: Territorio) {
    try {
      await excluirTerritorio(t.id);
      toast.success(`Território Nº ${t.numero} excluído.`);
      carregar();
    } catch (err) {
      if ((err as { code?: string }).code === "23503") {
        toast.error(
          "Não é possível excluir: este território tem histórico de designações ou está no calendário de saídas.",
        );
      } else {
        toast.error("Não foi possível excluir o território. Tente novamente.");
      }
    }
  }

  return (
    <div className="mx-auto grid max-w-220 gap-[clamp(20px,4vw,32px)] px-[clamp(14px,4vw,32px)] pt-[clamp(16px,4vw,40px)] pb-16">
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
              const progresso = progressoDe(t, marcas);
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
                    <TerritorioGlyph
                      limites={t.limites}
                      feitas={quadrasFeitasDe(t, marcas)}
                    />
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

                  <div className="grid justify-items-end gap-0.75 text-right">
                    {d && (
                      <span className="text-[0.76rem] text-ink-soft">
                        <b className="font-medium text-ink">
                          {nomePub(d.publicador_id)}
                        </b>{" "}
                        · desde {formatData(d.data_saida)}
                      </span>
                    )}
                    {progresso.total > 0 &&
                      (progresso.concluido ? (
                        <span className="rounded-full bg-sage-wash px-2 py-0.5 text-[0.72rem] font-medium text-sage-ink">
                          Concluído · {progresso.total}/{progresso.total} quadras
                        </span>
                      ) : (
                        <span className="text-[0.76rem] tabular-nums text-ink-soft">
                          {progresso.feitas}/{progresso.total} quadras
                        </span>
                      ))}
                  </div>

                  <div className="col-span-full flex flex-wrap items-center gap-2 border-t border-line pt-3">
                    {d && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          await devolver(d.id);
                          toast.success(`Território Nº ${t.numero} devolvido.`);
                          await carregar();
                          if (progresso.concluido) setOfertaRodada(t);
                        }}
                      >
                        Devolver
                      </Button>
                    )}

                    {progresso.concluido && (
                      <Button size="sm" onClick={() => novaRodada(t)}>
                        Começar nova rodada
                      </Button>
                    )}

                    <Button variant="outline" size="sm" asChild>
                      <Link to={`/cadastro/${t.id}`}>Editar</Link>
                    </Button>

                    <span className="flex-1" />

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

      <AlertDialog
        open={ofertaRodada !== null}
        onOpenChange={(aberto) => !aberto && setOfertaRodada(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Território Nº {ofertaRodada?.numero} concluído. Começar nova rodada?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Todas as quadras foram feitas. Começar uma rodada nova zera a contagem
              a partir de hoje — as marcas antigas continuam guardadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Agora não</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => ofertaRodada && novaRodada(ofertaRodada)}
            >
              Começar nova rodada
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
