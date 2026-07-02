import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { BaseMap } from "../map/BaseMap";
import type { ViewState } from "../map/BaseMap";
import { TerritorioPolygon } from "../map/TerritorioPolygon";
import { listTerritorios } from "../lib/territorios";
import type { Territorio } from "../lib/types";

// Centro do polígono (média dos vértices do anel externo) para enquadrar o mapa.
function centro(p: GeoJSON.Polygon): ViewState | null {
  const ring = p.coordinates?.[0];
  if (!ring?.length) return null;
  const [sx, sy] = ring.reduce(
    ([ax, ay], [x, y]) => [ax + x, ay + y],
    [0, 0],
  );
  return { longitude: sx / ring.length, latitude: sy / ring.length, zoom: 15 };
}

export function Campo() {
  const { id } = useParams();
  const [t, setT] = useState<Territorio | null>(null);

  useEffect(() => {
    listTerritorios().then((all) => setT(all.find((x) => x.id === id) ?? null));
  }, [id]);

  if (!t) return <p>Carregando território…</p>;
  const c = t.limites ? centro(t.limites) : null;

  return (
    <div style={{ height: "100dvh" }}>
      <BaseMap showLocation initialViewState={c ?? undefined}>
        {t.limites && <TerritorioPolygon polygon={t.limites} />}
      </BaseMap>
    </div>
  );
}
