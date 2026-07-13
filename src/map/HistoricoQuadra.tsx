import { dataBR } from "../lib/saidas";
import type { PassagemQuadra } from "../lib/quadras";

export function HistoricoQuadra({ passagens }: { passagens: PassagemQuadra[] }) {
  return (
    <div className="grid min-w-52 gap-2">
      <span className="text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-ink-soft">
        {passagens.length === 1
          ? "Feita 1 vez"
          : `Feita ${passagens.length} vezes`}
      </span>
      <ul className="grid gap-1.5">
        {passagens.map((p, i) => (
          <li key={`${p.data}-${i}`} className="grid gap-0.5 text-[0.82rem] leading-snug">
            <span className="font-medium tabular-nums text-ink">{dataBR(p.data)}</span>
            <span className="text-ink-soft">
              {p.local ?? "sem ponto de encontro"}
              {" · "}
              {p.dirigente ?? "dirigente a definir"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
