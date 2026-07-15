import { useEffect, useRef, useState } from "react";
import { Source, Layer, Popup, Marker, useMap } from "react-map-gl/mapbox";
import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { featureCollectionDe } from "../lib/territorios";
import { HistoricoQuadra } from "./HistoricoQuadra";
import type { PassagemQuadra } from "../lib/quadras";
import type { Limites } from "../lib/types";

export type EstadoQuadra = "feita" | "outra" | "falta" | "andamento";

const CORES: Record<EstadoQuadra, { fill: string; opacidade: number }> = {
  feita: { fill: "#5c8a76", opacidade: 0.42 },
  outra: { fill: "#5c8a76", opacidade: 0.16 },
  andamento: { fill: "#8a6636", opacidade: 0.3 },
  falta: { fill: "#486492", opacidade: 0.12 },
};

const porEstado = (
  chave: "fill" | "opacidade",
): mapboxgl.ExpressionSpecification => [
  "match",
  ["get", "estado"],
  "feita",
  CORES.feita[chave],
  "outra",
  CORES.outra[chave],
  "andamento",
  CORES.andamento[chave],
  CORES.falta[chave],
];

const FILL_ID = "territorio-fill";

const TEMPO_TOQUE_LONGO = 450;

interface Aberto {
  quadraId: string;
  longitude: number;
  latitude: number;
}

export function TerritorioPolygon({
  limites,
  estados,
  paradas,
  onQuadraClick,
  onParadaClick,
  historicoDe,
}: {
  limites: Limites;
  estados?: Record<string, EstadoQuadra>;
  paradas?: { quadraId: string; lng: number; lat: number }[];
  onQuadraClick?: (quadraId: string, lngLat: { lng: number; lat: number }) => void;
  onParadaClick?: (quadraId: string) => void;
  historicoDe?: (quadraId: string) => PassagemQuadra[];
}) {
  const { current: map } = useMap();
  const [aberto, setAberto] = useState<Aberto | null>(null);
  const toqueLongo = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abriuNoToque = useRef(false);
  const base = featureCollectionDe(limites);
  const data: GeoJSON.FeatureCollection = {
    ...base,
    features: base.features.map((f) => ({
      ...f,
      properties: {
        ...f.properties,
        estado: estados?.[String(f.properties?.id)] ?? "falta",
      },
    })),
  };

  useEffect(() => {
    if (!map) return;

    const quadraDe = (e: { features?: GeoJSON.Feature[] }) => {
      const id = e.features?.[0]?.properties?.id;
      return typeof id === "string" ? id : null;
    };
    const abrir = (quadraId: string, lngLat: mapboxgl.LngLat) => {
      if (!historicoDe || historicoDe(quadraId).length === 0) return false;
      setAberto({ quadraId, longitude: lngLat.lng, latitude: lngLat.lat });
      return true;
    };

    const clique = (e: mapboxgl.MapLayerMouseEvent) => {
      if (abriuNoToque.current) {
        abriuNoToque.current = false;
        return;
      }
      setAberto(null);
      const id = quadraDe(e);
      if (id && onQuadraClick)
        onQuadraClick(id, { lng: e.lngLat.lng, lat: e.lngLat.lat });
    };

    const mover = (e: mapboxgl.MapLayerMouseEvent) => {
      map.getCanvas().style.cursor = onQuadraClick ? "pointer" : "";
      const id = quadraDe(e);
      if (id) abrir(id, e.lngLat);
    };
    const sair = () => {
      map.getCanvas().style.cursor = "";
      setAberto(null);
    };

    const cancelarToque = () => {
      if (toqueLongo.current) clearTimeout(toqueLongo.current);
      toqueLongo.current = null;
    };
    const tocar = (e: mapboxgl.MapLayerTouchEvent) => {
      const id = quadraDe(e);
      if (!id) return;
      cancelarToque();
      toqueLongo.current = setTimeout(() => {
        abriuNoToque.current = abrir(id, e.lngLat);
      }, TEMPO_TOQUE_LONGO);
    };

    const comHover = window.matchMedia?.("(hover: hover)").matches ?? true;

    map.on("click", FILL_ID, clique);
    if (comHover) {
      map.on("mousemove", FILL_ID, mover);
      map.on("mouseleave", FILL_ID, sair);
    }
    map.on("touchstart", FILL_ID, tocar);
    map.on("touchend", cancelarToque);
    map.on("touchmove", cancelarToque);
    return () => {
      cancelarToque();
      map.off("click", FILL_ID, clique);
      map.off("mousemove", FILL_ID, mover);
      map.off("mouseleave", FILL_ID, sair);
      map.off("touchstart", FILL_ID, tocar);
      map.off("touchend", cancelarToque);
      map.off("touchmove", cancelarToque);
    };
  }, [map, onQuadraClick, historicoDe]);

  return (
    <Source id="territorio" type="geojson" data={data}>
      <Layer
        id={FILL_ID}
        type="fill"
        paint={{ "fill-color": porEstado("fill"), "fill-opacity": porEstado("opacidade") }}
      />
      {/* casing branco por baixo: faz o limite "saltar" sobre qualquer fundo de
          mapa sob luz forte, e o separa do azul do ponto "você está aqui". */}
      <Layer
        id="territorio-casing"
        type="line"
        layout={{ "line-join": "round" }}
        paint={{ "line-color": "#ffffff", "line-width": 7, "line-opacity": 0.9 }}
      />
      <Layer
        id="territorio-line"
        type="line"
        layout={{ "line-join": "round" }}
        paint={{ "line-color": "#33507d", "line-width": 3 }}
      />

      {paradas?.map((p) => (
        <Marker
          key={p.quadraId}
          longitude={p.lng}
          latitude={p.lat}
          anchor="bottom"
          onClick={
            onParadaClick
              ? (e) => {
                  e.originalEvent.stopPropagation();
                  onParadaClick(p.quadraId);
                }
              : undefined
          }
        >
          <div
            className={cn(
              "grid size-6 place-items-center rounded-full border-2 border-white bg-ocre text-white shadow-card",
              onParadaClick && "cursor-pointer",
            )}
          >
            <MapPin className="size-3.5" aria-hidden="true" />
          </div>
        </Marker>
      ))}

      {aberto && historicoDe && (
        <Popup
          longitude={aberto.longitude}
          latitude={aberto.latitude}
          closeButton={false}
          closeOnClick={false}
          offset={12}
          maxWidth="none"
          onClose={() => setAberto(null)}
        >
          <HistoricoQuadra passagens={historicoDe(aberto.quadraId)} />
        </Popup>
      )}
    </Source>
  );
}
