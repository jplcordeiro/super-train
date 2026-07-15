import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BaseMap } from "../map/BaseMap";
import { TerritoriosLayer } from "../map/TerritoriosLayer";
import { listTerritorios, boundsDeTerritorios } from "../lib/territorios";
import type { Territorio } from "../lib/types";
import { RadarLoader } from "../components/RadarLoader";
import { Button } from "@/components/ui/button";

export function Mapa() {
  const [territorios, setTerritorios] = useState<Territorio[]>([]);
  const [carregando, setCarregando] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    listTerritorios()
      .then(setTerritorios)
      .finally(() => setCarregando(false));
  }, []);

  const bounds = useMemo(() => boundsDeTerritorios(territorios), [territorios]);

  if (carregando) return <RadarLoader texto="Abrindo o mapa…" className="h-full" />;

  if (!bounds)
    return (
      <div className="grid h-full place-items-center bg-paper px-6">
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
              Nenhum território mapeado ainda
            </h1>
            <p className="text-[0.9rem] text-ink-soft">
              Desenhe o limite de um território para vê-lo aqui no mapa.
            </p>
          </div>
          <Button asChild>
            <Link to="/cadastro">Cadastrar território</Link>
          </Button>
        </div>
      </div>
    );

  return (
    <div className="relative h-full w-full overflow-hidden">
      <BaseMap bounds={bounds}>
        <TerritoriosLayer
          territorios={territorios}
          onSelect={(id) => navigate(`/campo/${id}`)}
        />
      </BaseMap>
    </div>
  );
}
