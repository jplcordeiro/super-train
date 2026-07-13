import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { BaseMap } from "../map/BaseMap";
import { TerritorioPolygon, type EstadoQuadra } from "../map/TerritorioPolygon";
import { listTerritorios, boundsDeTerritorios } from "../lib/territorios";
import { listMarcas, quadrasFeitasDe } from "../lib/quadras";
import type { Marca } from "../lib/quadras";
import type { Territorio } from "../lib/types";
import { Button } from "@/components/ui/button";
import { RadarLoader } from "../components/RadarLoader";

export function Campo() {
  const { id } = useParams();
  const [t, setT] = useState<Territorio | null>(null);
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    setCarregando(true);
    Promise.all([listTerritorios(), listMarcas()])
      .then(([todos, marcadas]) => {
        setT(todos.find((x) => x.id === id) ?? null);
        setMarcas(marcadas);
      })
      .finally(() => setCarregando(false));
  }, [id]);

  if (carregando) return <RadarLoader texto="Abrindo o território…" />;
  if (!t)
    return (
      <div className="grid h-dvh place-items-center bg-paper px-6">
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

  const bounds = boundsDeTerritorios([t]);
  const estados: Record<string, EstadoQuadra> = {};
  for (const quadraId of quadrasFeitasDe(t, marcas)) estados[quadraId] = "feita";

  return (
    <div className="relative h-dvh w-full overflow-hidden">
      <BaseMap showLocation bounds={bounds ?? undefined}>
        {t.limites && <TerritorioPolygon limites={t.limites} estados={estados} />}
      </BaseMap>

      <Link
        to="/"
        className="absolute left-3 top-3 z-10 inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-white/90 px-2.5 text-[0.85rem] font-medium text-ink shadow-card backdrop-blur transition-colors hover:text-jwblue"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Territórios
      </Link>
    </div>
  );
}
