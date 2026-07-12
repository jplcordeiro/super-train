import { quadrasDe } from "../lib/territorios";
import type { Limites } from "../lib/types";

export function TerritorioGlyph({ limites }: { limites: Limites | null }) {
  const aneis = quadrasDe(limites)
    .map((quadra) => quadra[0])
    .filter((anel): anel is GeoJSON.Position[] => !!anel && anel.length >= 3);

  if (aneis.length === 0) {
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

  const pontos = aneis.flat();
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

  const d = aneis
    .map(
      (anel) =>
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
        "Z",
    )
    .join(" ");

  return (
    <svg className="h-full w-full" viewBox="0 0 100 100" aria-hidden="true">
      <path
        d={d}
        className="fill-jwblue/12 stroke-current"
        strokeWidth="4"
        strokeLinejoin="round"
      />
    </svg>
  );
}
