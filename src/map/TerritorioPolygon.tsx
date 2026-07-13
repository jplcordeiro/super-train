import { useEffect } from "react";
import { Source, Layer, useMap } from "react-map-gl/mapbox";
import { featureCollectionDe } from "../lib/territorios";
import type { Limites } from "../lib/types";

export type EstadoQuadra = "feita" | "outra" | "falta";

const CORES: Record<EstadoQuadra, { fill: string; opacidade: number }> = {
  feita: { fill: "#5c8a76", opacidade: 0.42 },
  outra: { fill: "#5c8a76", opacidade: 0.16 },
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
  CORES.falta[chave],
];

const FILL_ID = "territorio-fill";

export function TerritorioPolygon({
  limites,
  estados,
  onQuadraClick,
}: {
  limites: Limites;
  estados?: Record<string, EstadoQuadra>;
  onQuadraClick?: (quadraId: string) => void;
}) {
  const { current: map } = useMap();
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
    if (!map || !onQuadraClick) return;
    const clique = (e: mapboxgl.MapLayerMouseEvent) => {
      const id = e.features?.[0]?.properties?.id;
      if (typeof id === "string") onQuadraClick(id);
    };
    const entrar = () => (map.getCanvas().style.cursor = "pointer");
    const sair = () => (map.getCanvas().style.cursor = "");
    map.on("click", FILL_ID, clique);
    map.on("mouseenter", FILL_ID, entrar);
    map.on("mouseleave", FILL_ID, sair);
    return () => {
      map.off("click", FILL_ID, clique);
      map.off("mouseenter", FILL_ID, entrar);
      map.off("mouseleave", FILL_ID, sair);
    };
  }, [map, onQuadraClick]);

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
    </Source>
  );
}
