import { Source, Layer } from "react-map-gl/mapbox";
import type { Territorio } from "../lib/types";
import { colecaoReferencia } from "../lib/territorios";

export function TerritoriosReferencia({
  territorios,
}: {
  territorios: Territorio[];
}) {
  const data = colecaoReferencia(territorios);
  if (data.features.length === 0) return null;

  return (
    <Source id="referencia" type="geojson" data={data}>
      <Layer
        id="referencia-casing"
        type="line"
        layout={{ "line-join": "round" }}
        paint={{ "line-color": "#ffffff", "line-width": 4, "line-opacity": 0.7 }}
      />
      <Layer
        id="referencia-line"
        type="line"
        layout={{ "line-join": "round" }}
        paint={{ "line-color": "#98a1ae", "line-width": 1.75, "line-opacity": 0.9 }}
      />
      <Layer
        id="referencia-label"
        type="symbol"
        layout={{
          "text-field": ["get", "numero"],
          "text-size": 13,
          "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
          "text-allow-overlap": false,
        }}
        paint={{
          "text-color": "#67707d",
          "text-halo-color": "#ffffff",
          "text-halo-width": 1.5,
        }}
      />
    </Source>
  );
}
