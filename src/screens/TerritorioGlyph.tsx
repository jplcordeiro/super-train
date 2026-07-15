import { quadrasDe } from "../lib/territorios";
import type { Limites } from "../lib/types";
import { cn } from "@/lib/utils";

export function TerritorioGlyph({
  limites,
  feitas,
  andamento,
}: {
  limites: Limites | null;
  feitas?: Set<string>;
  andamento?: Set<string>;
}) {
  const quadras = quadrasDe(limites)
    .map((q) => ({ id: q.id, anel: q.coordinates[0] }))
    .filter(
      (q): q is { id: string; anel: GeoJSON.Position[] } =>
        !!q.anel && q.anel.length >= 3,
    );

  if (quadras.length === 0) {
    return (
      <svg className="h-full w-full" viewBox="0 0 100 100" aria-hidden="true">
        <rect
          x="14"
          y="14"
          width="72"
          height="72"
          rx="10"
          className="fill-none stroke-line-strong"
          strokeWidth="4"
          strokeDasharray="7 8"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  const pontos = quadras.flatMap((q) => q.anel);
  const xs = pontos.map((p) => p[0]);
  const ys = pontos.map((p) => p[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const span = Math.max(maxX - minX, maxY - minY) || 1;
  const scale = 72 / span;
  const offX = (100 - (maxX - minX) * scale) / 2;
  const offY = (100 - (maxY - minY) * scale) / 2;

  const caminho = (anel: GeoJSON.Position[]) =>
    "M" +
    anel
      .map(
        (p) =>
          `${(offX + (p[0] - minX) * scale).toFixed(1)},${(
            offY +
            (maxY - p[1]) * scale
          ).toFixed(1)}`,
      )
      .join("L") +
    "Z";

  return (
    <svg className="h-full w-full" viewBox="0 0 100 100" aria-hidden="true">
      {quadras.map((q) => (
        <path
          key={q.id}
          d={caminho(q.anel)}
          className={cn(
            "stroke-current",
            feitas?.has(q.id)
              ? "fill-sage/60"
              : andamento?.has(q.id)
                ? "fill-ocre/60"
                : "fill-jwblue/12",
          )}
          strokeWidth="4"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}
