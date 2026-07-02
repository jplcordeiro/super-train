import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listTerritorios, setAtivo, statusTerritorio, excluirTerritorio } from "../lib/territorios";
import { listPublicadores, criarPublicador } from "../lib/publicadores";
import { designacoesAbertas, designar, devolver } from "../lib/designacoes";
import type { Territorio, Publicador, Designacao } from "../lib/types";
import { TerritorioGlyph } from "./TerritorioGlyph";

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

export function Gestao() {
  const [territorios, setTerritorios] = useState<Territorio[]>([]);
  const [publicadores, setPublicadores] = useState<Publicador[]>([]);
  const [abertas, setAbertas] = useState<Designacao[]>([]);
  const [novoNome, setNovoNome] = useState("");
  const [novoTel, setNovoTel] = useState("");

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
    carregar();
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
    if (!window.confirm(`Excluir o território Nº ${t.numero}? Esta ação não pode ser desfeita.`))
      return;
    try {
      await excluirTerritorio(t.id);
      carregar();
    } catch (err) {
      if ((err as { code?: string }).code === "23503") {
        alert("Não é possível excluir: este território tem histórico de designações.");
      } else {
        alert("Não foi possível excluir o território. Tente novamente.");
      }
    }
  }

  const disponiveis = territorios.filter(
    (t) => statusTerritorio(t, abertaDe(t.id)) === "disponivel",
  ).length;
  const designados = abertas.length;

  const dt = "order-2 text-[0.68rem] uppercase tracking-[0.08em] text-ink-faint";
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
              super-train
            </h1>
            <p className="mt-0.5 text-[0.82rem] tracking-[0.01em] text-ink-soft">
              Gestão de territórios
            </p>
          </div>
        </div>
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
      </header>

      <section className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[0.78rem] font-semibold uppercase tracking-[0.12em] text-ink-soft">
            Territórios
          </h2>
          <Link className="btn btn-primary" to="/cadastro">
            Cadastrar território
          </Link>
        </div>

        {territorios.length === 0 ? (
          <p className="py-1 text-[0.88rem] text-ink-faint">
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
                  <div className="h-11 w-11 flex-none text-jwblue">
                    <TerritorioGlyph poligono={t.limites} />
                  </div>

                  <div className="grid min-w-0 gap-0.5">
                    <Link
                      className="w-fit font-mono text-[1.15rem] font-medium tracking-[-0.01em] tabular-nums text-ink no-underline hover:text-jwblue hover:underline hover:underline-offset-[3px]"
                      to={`/campo/${t.id}`}
                    >
                      {t.numero}
                    </Link>
                    <span className="truncate text-[0.9rem] text-ink-soft">
                      {t.nome ?? "Sem nome"}
                    </span>
                  </div>

                  <div className="grid justify-items-end gap-[3px] text-right">
                    <span className={`pill pill-${status}`}>
                      {STATUS_LABEL[status]}
                    </span>
                    {d && (
                      <span className="text-[0.76rem] text-ink-faint">
                        <b className="font-medium text-ink-soft">
                          {nomePub(d.publicador_id)}
                        </b>{" "}
                        · desde {formatData(d.data_saida)}
                      </span>
                    )}
                  </div>

                  <div className="col-span-full flex flex-wrap items-center gap-2 border-t border-line pt-3">
                    {d ? (
                      <button
                        className="btn btn-ghost"
                        onClick={async () => {
                          await devolver(d.id);
                          carregar();
                        }}
                      >
                        Devolver
                      </button>
                    ) : (
                      <select
                        className="field"
                        defaultValue=""
                        onChange={async (e) => {
                          if (e.target.value) {
                            await designar(t.id, e.target.value);
                            carregar();
                          }
                        }}
                      >
                        <option value="" disabled>
                          Designar a…
                        </option>
                        {publicadores.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.nome}
                          </option>
                        ))}
                      </select>
                    )}

                    <span className="flex-1" />

                    <label className="inline-flex cursor-pointer select-none items-center gap-1.5 text-[0.82rem] text-ink-soft">
                      <input
                        type="checkbox"
                        className="h-[15px] w-[15px] accent-jwblue"
                        checked={t.ativo}
                        onChange={async (e) => {
                          await setAtivo(t.id, e.target.checked);
                          carregar();
                        }}
                      />
                      ativo
                    </label>
                    <button className="btn btn-link" onClick={() => excluir(t)}>
                      Excluir
                    </button>
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
          <input
            className="field flex-1 basis-40"
            placeholder="Nome*"
            value={novoNome}
            onChange={(e) => setNovoNome(e.target.value)}
          />
          <input
            className="field flex-1 basis-40"
            placeholder="Telefone"
            value={novoTel}
            onChange={(e) => setNovoTel(e.target.value)}
          />
          <button
            className="btn btn-primary"
            onClick={addPublicador}
            disabled={!novoNome}
          >
            Adicionar
          </button>
        </div>
        {publicadores.length === 0 ? (
          <p className="py-1 text-[0.88rem] text-ink-faint">
            Nenhum publicador cadastrado.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {publicadores.map((p) => (
              <li
                key={p.id}
                className="inline-flex items-baseline gap-2 rounded-full border border-line bg-white px-[13px] py-[7px] text-[0.88rem]"
              >
                {p.nome}
                {p.telefone && (
                  <span className="font-mono text-[0.78rem] tabular-nums text-ink-faint">
                    {p.telefone}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
