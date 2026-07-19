import { useEffect, useState } from "react";
import { Printer, ChevronLeft, ChevronRight } from "lucide-react";
import { listTerritorios } from "../lib/territorios";
import {
  listMarcas,
  quadrasFeitasDe,
  relatorioDoMes,
  type Marca,
} from "../lib/quadras";
import { dataBR, MES_NOME, mesVizinho, type Mes } from "../lib/saidas";
import { campanhas, listRodadas } from "../lib/rodadas";
import type { Rodada } from "../lib/types";
import type { Territorio } from "../lib/types";
import { TerritorioGlyph } from "./TerritorioGlyph";
import { Button } from "@/components/ui/button";

export function Relatorio() {
  const [territorios, setTerritorios] = useState<Territorio[]>([]);
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [rodadas, setRodadas] = useState<Rodada[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [mes, setMes] = useState<Mes>(() => {
    const d = new Date();
    return { ano: d.getFullYear(), mes: d.getMonth() + 1 };
  });

  useEffect(() => {
    Promise.all([listTerritorios(), listMarcas(), listRodadas()])
      .then(([t, m, r]) => {
        setTerritorios(t);
        setMarcas(m);
        setRodadas(r);
      })
      .finally(() => setCarregando(false));
  }, []);

  const relatorio = relatorioDoMes(mes, territorios, marcas, rodadas);
  const periodos = campanhas(rodadas);

  return (
    <div className="folha mx-auto grid max-w-220 gap-[clamp(16px,3vw,26px)] px-[clamp(14px,4vw,32px)] pt-[clamp(16px,4vw,40px)] pb-16">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-4">
        <div className="nao-imprime flex flex-wrap items-center gap-2">
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
            Relatório de campo
          </p>
          <h1 className="mt-1 font-escala text-[clamp(1.6rem,4vw,2.2rem)] font-bold leading-none tracking-[-0.02em] text-jwblue-deep">
            {MES_NOME[mes.mes - 1]}{" "}
            <span className="font-escala-mono tabular-nums text-ink-faint">
              {mes.ano}
            </span>
          </h1>
        </div>
      </header>

      {carregando ? (
        <div
          role="status"
          aria-label="Carregando relatório"
          className="grid h-64 animate-pulse rounded-xl bg-mist"
        />
      ) : relatorio.linhas.length === 0 ? (
        <p className="py-6 text-[0.9rem] text-ink-soft">
          Nenhum trabalho registrado neste mês.
        </p>
      ) : (
        <>
          <dl className="grid grid-cols-3 gap-3">
            {[
              { rotulo: "Quadras feitas", valor: relatorio.totalQuadrasNoMes },
              { rotulo: "Territórios", valor: relatorio.linhas.length },
              { rotulo: "Concluídos", valor: relatorio.totalConcluidos },
            ].map(({ rotulo, valor }) => (
              <div
                key={rotulo}
                className="rounded-xl border border-line bg-white px-4 py-3 text-center shadow-card"
              >
                <dd className="font-mono text-[1.6rem] font-medium tabular-nums text-jwblue-deep">
                  {valor}
                </dd>
                <dt className="text-[0.72rem] font-semibold uppercase tracking-[0.1em] text-ink-soft">
                  {rotulo}
                </dt>
              </div>
            ))}
          </dl>

          <ul className="grid gap-2.5">
            {relatorio.linhas.map((l) => (
              <li
                key={l.territorio.id}
                className="grid grid-cols-[auto_1fr_auto] items-center gap-3.5 rounded-xl border border-line bg-white px-4 py-3 shadow-card"
              >
                <div className="h-10 w-10 flex-none text-jwblue">
                  <TerritorioGlyph
                    limites={l.territorio.limites}
                    feitas={quadrasFeitasDe(l.territorio, marcas)}
                  />
                </div>
                <div className="grid min-w-0 gap-0.5">
                  <span className="font-mono text-[1.1rem] font-medium tabular-nums text-ink">
                    {l.territorio.numero}
                  </span>
                  <span className="truncate text-[0.9rem] text-ink-soft">
                    {l.territorio.nome ?? "Sem nome"}
                  </span>
                </div>
                <div className="grid justify-items-end gap-0.75 text-right">
                  <span className="text-[0.8rem] tabular-nums text-ink-soft">
                    <b className="font-medium text-ink">{l.feitasNoMes}</b>
                    {l.total > 0 && ` de ${l.total}`} quadras
                  </span>
                  {l.concluidoNoMes && (
                    <span className="rounded-full bg-sage-wash px-2 py-0.5 text-[0.72rem] font-medium text-sage-ink">
                      Concluído
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>

          {periodos.length > 0 && (
            <section className="nao-imprime grid gap-2.5 border-t border-line pt-5">
              <h2 className="text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-ink-soft">
                Rodadas
              </h2>
              <ul className="grid gap-1.5">
                {periodos.map((p) => (
                  <li
                    key={`${p.inicio}-${p.nome ?? ""}`}
                    className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 rounded-lg border border-line bg-white px-3.5 py-2.5"
                  >
                    <span className="text-[0.9rem] font-medium text-ink">
                      {p.nome ?? "Rodada"}
                    </span>
                    <span className="text-[0.8rem] tabular-nums text-ink-soft">
                      desde {dataBR(p.inicio)} ·{" "}
                      {p.territorio_ids.length === 1
                        ? "1 território"
                        : `${p.territorio_ids.length} territórios`}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
