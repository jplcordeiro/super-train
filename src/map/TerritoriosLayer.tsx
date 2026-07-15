import { useEffect } from "react";
import { Source, Layer, useMap } from "react-map-gl/mapbox";
import type { Territorio } from "../lib/types";
import { geometriaDe } from "../lib/territorios";

const COR_FILL = "#486492";
const COR_LINE = "#33507d";

const FILL_ID = "territorios-fill";
export function TerritoriosLayer({
  territorios,
  onSelect,
}: {
  territorios: Territorio[];
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
        properties: { id: t.id, numero: t.numero },
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
        paint={{ "fill-color": COR_FILL, "fill-opacity": 0.18 }}
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
        paint={{ "line-color": COR_LINE, "line-width": 2.5 }}
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
