import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ChevronLeft, ChevronRight, Plus, Printer, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  diaDaSemana,
  diaDe,
  DIA_SEMANA,
  excluirSaida,
  gradeDoMes,
  listSaidas,
  locaisUsados,
  mesVizinho,
  mesmoMes,
  notaDoMes,
  saidasDoDia,
  salvarNota,
  type Mes,
} from "../lib/saidas";
import { listTerritorios } from "../lib/territorios";
import { listPublicadores } from "../lib/publicadores";
import type { Publicador, Saida, Territorio } from "../lib/types";
import { TerritorioGlyph } from "./TerritorioGlyph";
import { SaidaForm } from "./SaidaForm";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import { cn } from "@/lib/utils";

const MES_NOME = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const ABREV_DIA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

const WASH = [
  "bg-dia-0",
  "bg-dia-1",
  "bg-dia-2",
  "bg-dia-3",
  "bg-dia-4",
  "bg-dia-5",
  "bg-dia-6",
];

function hojeISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export function Calendario() {
  const hoje = hojeISO();
  const [mes, setMes] = useState<Mes>(() => {
    const d = new Date();
    return { ano: d.getFullYear(), mes: d.getMonth() + 1 };
  });
  const [saidas, setSaidas] = useState<Saida[]>([]);
  const [territorios, setTerritorios] = useState<Territorio[]>([]);
  const [publicadores, setPublicadores] = useState<Publicador[]>([]);
  const [nota, setNota] = useState("");
  const [notaSalva, setNotaSalva] = useState("");
  const [diaAberto, setDiaAberto] = useState<string | null>(null);
  const [editando, setEditando] = useState<Saida | "nova" | null>(null);
  const [carregando, setCarregando] = useState(true);

  const grade = gradeDoMes(mes);

  async function carregar() {
    const [s, t, p, n] = await Promise.all([
      listSaidas(grade[0], grade[grade.length - 1]),
      listTerritorios(),
      listPublicadores(),
      notaDoMes(mes),
    ]);
    setSaidas(s);
    setTerritorios(t);
    setPublicadores(p);
    setNota(n);
    setNotaSalva(n);
  }

  useEffect(() => {
    setCarregando(true);
    carregar().finally(() => setCarregando(false));
  }, [mes]);

  const territorioDe = (id: string) => territorios.find((t) => t.id === id);
  const nomePub = (id: string | null) =>
    id ? (publicadores.find((p) => p.id === id)?.nome ?? "?") : null;
  const locais = locaisUsados(saidas);

  async function gravarNota() {
    if (nota.trim() === notaSalva.trim()) return;
    try {
      await salvarNota(mes, nota);
      setNotaSalva(nota.trim());
      toast.success("Aviso do mês salvo.");
    } catch {
      toast.error("Não foi possível salvar o aviso. Tente novamente.");
    }
  }

  async function excluir(s: Saida) {
    try {
      await excluirSaida(s.id);
      toast.success("Saída excluída.");
      await carregar();
    } catch {
      toast.error("Não foi possível excluir a saída. Tente novamente.");
    }
  }

  function fecharDia() {
    setDiaAberto(null);
    setEditando(null);
  }

  const diasComSaida = grade.filter(
    (d) => mesmoMes(d, mes) && saidasDoDia(saidas, d).length > 0,
  );

  function Territorios({ s, tamanho }: { s: Saida; tamanho: "selo" | "texto" }) {
    if (s.territorio_ids.length === 0) return null;
    if (tamanho === "texto") {
      return (
        <span className="pointer-events-auto flex flex-wrap gap-x-1.5 font-mono text-[0.7rem] tabular-nums text-jwblue-deep">
          {s.territorio_ids.map((id) => {
            const t = territorioDe(id);
            if (!t) return null;
            return (
              <Link
                key={id}
                to={`/campo/${t.id}`}
                className="underline-offset-2 hover:underline"
                title={`Abrir o mapa do território ${t.numero}`}
              >
                {t.numero}
              </Link>
            );
          })}
        </span>
      );
    }
    return (
      <span className="flex gap-1.5">
        {s.territorio_ids.map((id) => {
          const t = territorioDe(id);
          if (!t) return null;
          return (
            <Link
              key={id}
              to={`/campo/${t.id}`}
              aria-label={`Abrir o mapa do território ${t.numero}`}
              className="grid w-9 justify-items-center gap-0.5 text-jwblue"
            >
              <span className="h-9 w-9 rounded-md bg-white/70 p-0.5">
                <TerritorioGlyph limites={t.limites} />
              </span>
              <span className="font-mono text-[0.66rem] tabular-nums text-ink-soft">
                {t.numero}
              </span>
            </Link>
          );
        })}
      </span>
    );
  }

  function Eyebrow({ s }: { s: Saida }) {
    if (s.periodo === "manha" && !s.hora) return null;
    return (
      <span className="font-mono text-[0.64rem] uppercase tracking-[0.06em] text-ink-faint">
        {s.periodo === "manha" ? "manhã" : "tarde"}
        {s.hora ? ` · ${s.hora.slice(0, 5)}` : ""}
      </span>
    );
  }

  return (
    <div className="folha mx-auto grid max-w-300 gap-[clamp(16px,3vw,26px)] px-[clamp(12px,3vw,32px)] pt-[clamp(16px,4vw,36px)] pb-24">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-4">
        <div className="nao-imprime flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/">
              <ArrowLeft aria-hidden="true" />
              Voltar
            </Link>
          </Button>
          <Button size="sm" onClick={() => window.print()}>
            <Printer aria-hidden="true" />
            Imprimir
          </Button>
          <div className="flex items-center rounded-lg border border-line bg-white">
            <Button
              variant="ghost"
              size="sm"
              aria-label="Mês anterior"
              onClick={() => setMes(mesVizinho(mes, -1))}
            >
              <ChevronLeft aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="border-x border-line text-ink-soft"
              onClick={() => {
                const d = new Date();
                setMes({ ano: d.getFullYear(), mes: d.getMonth() + 1 });
              }}
            >
              Hoje
            </Button>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Próximo mês"
              onClick={() => setMes(mesVizinho(mes, 1))}
            >
              <ChevronRight aria-hidden="true" />
            </Button>
          </div>
        </div>

        <div className="ml-auto text-right">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-ink-soft">
            Saídas de campo
          </p>
          <h1 className="mt-1 text-[clamp(1.6rem,4vw,2.2rem)] font-semibold leading-none tracking-[-0.02em] text-jwblue-deep">
            {MES_NOME[mes.mes - 1]}{" "}
            <span className="font-mono tabular-nums text-ink-faint">{mes.ano}</span>
          </h1>
        </div>
      </header>

      {carregando ? (
        <div
          role="status"
          aria-label="Carregando calendário"
          className="grid h-96 animate-pulse rounded-xl bg-mist"
        />
      ) : (
        <>
          <div className="folha-grade hidden grid-cols-7 gap-px overflow-hidden rounded-xl border border-line bg-line shadow-card sm:grid">
            {ABREV_DIA.map((d, i) => (
              <div
                key={d}
                className={cn(
                  "bg-white px-2 py-1.5 text-center text-[0.68rem] font-semibold uppercase tracking-[0.12em]",
                  i === 0 ? "text-ocre" : "text-ink-soft",
                )}
              >
                {d}
              </div>
            ))}

            {grade.map((data) => {
              const dow = diaDaSemana(data);
              const doMes = mesmoMes(data, mes);
              const doDia = saidasDoDia(saidas, data);
              const ehHoje = data === hoje;
              return (
                <div
                  key={data}
                  className={cn(
                    "relative flex min-h-30 flex-col",
                    WASH[dow],
                    !doMes && "opacity-45",
                    ehHoje && "ring-2 ring-inset ring-jwblue",
                  )}
                >
                  <button
                    type="button"
                    className="nao-imprime absolute inset-0 cursor-pointer"
                    aria-label={`Saídas de ${diaDe(data)} de ${MES_NOME[Number(data.split("-")[1]) - 1]}`}
                    onClick={() => {
                      if (!doMes) setMes({ ano: Number(data.split("-")[0]), mes: Number(data.split("-")[1]) });
                      setDiaAberto(data);
                    }}
                  />
                  <span
                    className={cn(
                      "pointer-events-none relative px-1.5 pt-1 text-right font-mono text-[0.72rem] tabular-nums",
                      ehHoje ? "font-semibold text-jwblue-deep" : "text-ink-soft",
                    )}
                  >
                    {diaDe(data)}
                  </span>

                  <div className="pointer-events-none relative grid gap-1 px-1.5 pb-1.5">
                    {doDia.map((s) => (
                      <div
                        key={s.id}
                        className="grid gap-0.5 border-t border-white/70 pt-1 leading-tight first:border-0 first:pt-0"
                      >
                        <Eyebrow s={s} />
                        {s.local && (
                          <span className="text-[0.68rem] font-semibold uppercase tracking-[0.04em] text-jwblue-deep">
                            {s.local}
                          </span>
                        )}
                        <span
                          className={cn(
                            "text-[0.74rem]",
                            s.publicador_id ? "text-ink" : "italic text-ocre",
                          )}
                        >
                          {nomePub(s.publicador_id) ?? "a definir"}
                        </span>
                        <Territorios s={s} tamanho="texto" />
                        {s.observacao && (
                          <span className="text-[0.66rem] italic text-ink-soft">
                            {s.observacao}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <ol className="folha-agenda grid gap-2.5 sm:hidden">
            {diasComSaida.length === 0 ? (
              <p className="py-6 text-center text-[0.9rem] text-ink-soft">
                Nenhuma saída neste mês. Toque em “Adicionar saída” para começar.
              </p>
            ) : (
              diasComSaida.map((data) => {
                const dow = diaDaSemana(data);
                const ehHoje = data === hoje;
                return (
                  <li
                    key={data}
                    className={cn(
                      "overflow-hidden rounded-xl border bg-white shadow-card",
                      ehHoje ? "border-jwblue" : "border-line",
                    )}
                  >
                    <div
                      className={cn("flex items-baseline gap-2 px-3.5 py-2", WASH[dow])}
                    >
                      <span className="font-mono text-lg font-medium leading-none tabular-nums text-ink">
                        {diaDe(data)}
                      </span>
                      <span className="text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-ink-soft">
                        {DIA_SEMANA[dow]}
                      </span>
                      {ehHoje && (
                        <span className="ml-auto text-[0.68rem] font-semibold uppercase tracking-widest text-jwblue-deep">
                          hoje
                        </span>
                      )}
                    </div>
                    <ul>
                      {saidasDoDia(saidas, data).map((s) => (
                        <li
                          key={s.id}
                          className="flex items-center gap-3 border-t border-line px-3.5 py-3 first:border-0"
                        >
                          <div className="grid min-w-0 flex-1 gap-0.5">
                            <Eyebrow s={s} />
                            {s.local && (
                              <span className="text-[0.92rem] font-semibold text-jwblue-deep">
                                {s.local}
                              </span>
                            )}
                            <span
                              className={cn(
                                "text-[0.85rem]",
                                s.publicador_id ? "text-ink" : "italic text-ocre",
                              )}
                            >
                              {nomePub(s.publicador_id) ?? "dirigente a definir"}
                            </span>
                            {s.observacao && (
                              <span className="text-[0.78rem] italic text-ink-soft">
                                {s.observacao}
                              </span>
                            )}
                          </div>
                          <Territorios s={s} tamanho="selo" />
                          <button
                            type="button"
                            aria-label={`Editar saída de ${diaDe(data)}`}
                            onClick={() => {
                              setDiaAberto(data);
                              setEditando(s);
                            }}
                            className="nao-imprime -mr-1 grid size-9 flex-none place-items-center rounded-lg text-ink-faint hover:bg-mist hover:text-jwblue"
                          >
                            <ChevronRight className="size-4" aria-hidden="true" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </li>
                );
              })
            )}
          </ol>

          <section className="grid gap-2">
            <h2 className="text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-ink-soft">
              Avisos do mês
            </h2>
            <Textarea
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              onBlur={gravarNota}
              rows={2}
              placeholder="Todos os domingos temos duas saídas, em locais diferentes."
              className="resize-y border-line bg-white text-[0.88rem] print:border-0 print:bg-transparent print:p-0"
            />
          </section>
        </>
      )}

      <Button
        size="lg"
        className="nao-imprime fixed bottom-5 left-1/2 z-20 -translate-x-1/2 shadow-card sm:hidden"
        onClick={() => {
          setDiaAberto(hoje);
          setEditando("nova");
        }}
      >
        <Plus aria-hidden="true" />
        Adicionar saída
      </Button>

      <Sheet open={diaAberto !== null} onOpenChange={(v) => !v && fecharDia()}>
        <SheetContent
          side="right"
          className="w-full gap-0 overflow-y-auto sm:max-w-lg"
          aria-describedby={undefined}
        >
          {diaAberto && (
            <>
              <SheetHeader className="border-b border-line">
                <SheetTitle className="text-jwblue-deep">
                  {DIA_SEMANA[diaDaSemana(diaAberto)]}, {diaDe(diaAberto)} de{" "}
                  {MES_NOME[Number(diaAberto.split("-")[1]) - 1]}
                </SheetTitle>
                <SheetDescription>
                  {editando === "nova"
                    ? "Nova saída"
                    : editando
                      ? "Editando uma saída"
                      : `${saidasDoDia(saidas, diaAberto).length} saída(s) neste dia`}
                </SheetDescription>
              </SheetHeader>

              <div className="p-4">
                {editando ? (
                  <SaidaForm
                    data={diaAberto}
                    saida={editando === "nova" ? undefined : editando}
                    territorios={territorios}
                    publicadores={publicadores}
                    locais={locais}
                    onPronto={async () => {
                      setEditando(null);
                      await carregar();
                    }}
                    onCancelar={() => setEditando(null)}
                  />
                ) : (
                  <div className="grid gap-3">
                    {saidasDoDia(saidas, diaAberto).map((s) => (
                      <div
                        key={s.id}
                        className="grid gap-2 rounded-xl border border-line bg-white p-3.5 shadow-card"
                      >
                        <div className="flex items-start gap-3">
                          <div className="grid min-w-0 flex-1 gap-0.5">
                            <span className="font-mono text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">
                              {s.periodo === "manha" ? "manhã" : "tarde"}
                              {s.hora ? ` · ${s.hora.slice(0, 5)}` : ""}
                            </span>
                            <span className="text-[0.95rem] font-semibold text-jwblue-deep">
                              {s.local ?? "Sem ponto de encontro"}
                            </span>
                            <span
                              className={cn(
                                "text-[0.88rem]",
                                s.publicador_id ? "text-ink" : "italic text-ocre",
                              )}
                            >
                              {nomePub(s.publicador_id) ?? "dirigente a definir"}
                            </span>
                            {s.observacao && (
                              <span className="text-[0.8rem] italic text-ink-soft">
                                {s.observacao}
                              </span>
                            )}
                          </div>
                          <Territorios s={s} tamanho="selo" />
                        </div>
                        <div className="flex gap-2 border-t border-line pt-2.5">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditando(s)}
                          >
                            Editar
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-ink-soft hover:text-destructive"
                              >
                                <Trash2 aria-hidden="true" />
                                Excluir
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir esta saída?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta ação não pode ser desfeita. As outras saídas do
                                  mês não são afetadas.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  variant="destructive"
                                  onClick={() => excluir(s)}
                                >
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    ))}

                    <Button variant="outline" onClick={() => setEditando("nova")}>
                      <Plus aria-hidden="true" />
                      Adicionar saída
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
