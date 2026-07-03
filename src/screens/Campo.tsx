import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { BaseMap } from "../map/BaseMap";
import type { ViewState } from "../map/BaseMap";
import { TerritorioPolygon } from "../map/TerritorioPolygon";
import { listTerritorios } from "../lib/territorios";
import type { Territorio } from "../lib/types";
import { Button } from "@/components/ui/button";

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

// Selo do território com pulso "você está aqui" — o mesmo vocabulário visual
// do Login (.locator-ping) e do header da Gestão, agora como estado de carga.
function CampoLoader() {
  return (
    <div className="grid h-[100dvh] place-items-center bg-paper">
      <div className="flex flex-col items-center gap-5" role="status">
        <svg
          className="h-16 w-16 text-jwblue"
          viewBox="0 0 100 100"
          fill="none"
          aria-hidden="true"
        >
          {/* anéis de radar emanando do centro do plot */}
          <circle cx="50" cy="51" r="20" className="locator-ping fill-jwblue/25" />
          <circle
            cx="50"
            cy="51"
            r="20"
            className="locator-ping locator-ping--lag fill-jwblue/25"
          />
          {/* contorno do território (o "selo" do plot) */}
          <path
            d="M20 34 L50 20 L80 34 L80 68 L50 82 L20 68 Z"
            stroke="currentColor"
            strokeWidth="6"
            strokeLinejoin="round"
          />
          {/* você está aqui */}
          <circle cx="50" cy="51" r="5.5" fill="currentColor" />
        </svg>
        <p className="text-[0.9rem] tracking-[0.01em] text-ink-soft">
          Abrindo o território…
        </p>
      </div>
    </div>
  );
}

export function Campo() {
  const { id } = useParams();
  const [t, setT] = useState<Territorio | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    setCarregando(true);
    listTerritorios()
      .then((all) => setT(all.find((x) => x.id === id) ?? null))
      .finally(() => setCarregando(false));
  }, [id]);

  if (carregando) return <CampoLoader />;
  if (!t)
    return (
      <div className="grid h-[100dvh] place-items-center bg-paper px-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <svg
            className="h-14 w-14 text-ink-faint"
            viewBox="0 0 100 100"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M20 34 L50 20 L80 34 L80 68 L50 82 L20 68 Z"
              stroke="currentColor"
              strokeWidth="6"
              strokeLinejoin="round"
              strokeDasharray="7 8"
            />
          </svg>
          <div className="grid gap-1">
            <h1 className="text-lg font-semibold text-ink">
              Território não encontrado
            </h1>
            <p className="text-[0.9rem] text-ink-soft">
              Ele pode ter sido excluído ou o link está incorreto.
            </p>
          </div>
          <Button asChild>
            <Link to="/">Voltar aos territórios</Link>
          </Button>
        </div>
      </div>
    );

  const c = t.limites ? centro(t.limites) : null;

  return (
    <div style={{ height: "100dvh" }}>
      <BaseMap showLocation initialViewState={c ?? undefined}>
        {t.limites && <TerritorioPolygon polygon={t.limites} />}
      </BaseMap>
    </div>
  );
}
