import { useEffect } from "react";
import { Source, Layer, useMap } from "react-map-gl/mapbox";
import type { Territorio } from "../lib/types";
import { geometriaDe, type StatusTerritorio } from "../lib/territorios";

const CORES: Record<StatusTerritorio, { fill: string; line: string }> = {
  disponivel: { fill: "#5c8a76", line: "#3f6b58" },
  designado: { fill: "#486492", line: "#33507d" },
  inativo: { fill: "#98a1ae", line: "#67707d" },
};

const corPorStatus = (chave: "fill" | "line"): mapboxgl.ExpressionSpecification => [
  "match",
  ["get", "status"],
  "disponivel",
  CORES.disponivel[chave],
  "designado",
  CORES.designado[chave],
  "inativo",
  CORES.inativo[chave],
  CORES.disponivel[chave],
];

const FILL_ID = "territorios-fill";
export function TerritoriosLayer({
  territorios,
  statusDe,
  onSelect,
}: {
  territorios: Territorio[];
  statusDe: (t: Territorio) => StatusTerritorio;
  onSelect: (id: string) => void;
}) {
  const { current: map } = useMap();

  const data: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features: territorios
      .map((t) => ({ t, geometry: geometriaDe(t.limites) }))
      .filter((x): x is { t: Territorio; geometry: GeoJSON.MultiPolygon } => !!x.geometry)
      .map(({ t, geometry }) => ({
        type: "Feature",
        geometry,
        properties: { id: t.id, numero: t.numero, status: statusDe(t) },
      })),
  };

  useEffect(() => {
    if (!map) return;
    const onClick = (e: mapboxgl.MapLayerMouseEvent) => {
      const id = e.features?.[0]?.properties?.id;
      if (typeof id === "string") onSelect(id);
    };
    const enter = () => (map.getCanvas().style.cursor = "pointer");
    const leave = () => (map.getCanvas().style.cursor = "");
    map.on("click", FILL_ID, onClick);
    map.on("mouseenter", FILL_ID, enter);
    map.on("mouseleave", FILL_ID, leave);
    return () => {
      map.off("click", FILL_ID, onClick);
      map.off("mouseenter", FILL_ID, enter);
      map.off("mouseleave", FILL_ID, leave);
    };
  }, [map, onSelect]);

  return (
    <Source id="territorios" type="geojson" data={data}>
      <Layer
        id={FILL_ID}
        type="fill"
        paint={{ "fill-color": corPorStatus("fill"), "fill-opacity": 0.18 }}
      />
      <Layer
        id="territorios-casing"
        type="line"
        layout={{ "line-join": "round" }}
        paint={{ "line-color": "#ffffff", "line-width": 5, "line-opacity": 0.85 }}
      />
      <Layer
        id="territorios-line"
        type="line"
        layout={{ "line-join": "round" }}
        paint={{ "line-color": corPorStatus("line"), "line-width": 2.5 }}
      />
      <Layer
        id="territorios-label"
        type="symbol"
        layout={{
          "text-field": ["get", "numero"],
          "text-size": 14,
          "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
          "text-allow-overlap": false,
        }}
        paint={{
          "text-color": "#29323c",
          "text-halo-color": "#ffffff",
          "text-halo-width": 1.5,
        }}
      />
    </Source>
  );
}
