/**
 * Renders a território's real boundary polygon as a small normalized SVG glyph —
 * a "seal" of the plot that lets the servant recognize a território by its shape.
 * Territórios without a drawn boundary get a dashed placeholder (a nudge to draw one).
 */
export function TerritorioGlyph({ poligono }: { poligono: GeoJSON.Polygon | null }) {
  const ring = poligono?.coordinates?.[0];
  if (!ring || ring.length < 3) {
    return (
      <svg
        className="h-full w-full"
        viewBox="0 0 100 100"
        aria-hidden="true"
      >
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

  const xs = ring.map((p) => p[0]);
  const ys = ring.map((p) => p[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const span = Math.max(maxX - minX, maxY - minY) || 1;
  const scale = 72 / span;
  const offX = (100 - (maxX - minX) * scale) / 2;
  const offY = (100 - (maxY - minY) * scale) / 2;

  const d =
    "M" +
    ring
      // flip Y: latitude grows upward, SVG y grows downward
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
      <path
        d={d}
        className="fill-jwblue/12 stroke-current"
        strokeWidth="4"
        strokeLinejoin="round"
      />
    </svg>
  );
}
