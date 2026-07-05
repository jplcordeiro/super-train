import { Source, Layer } from "react-map-gl/mapbox";

export function TerritorioPolygon({ polygon }: { polygon: GeoJSON.Polygon }) {
  const feature: GeoJSON.Feature = {
    type: "Feature",
    geometry: polygon,
    properties: {},
  };
  return (
    <Source id="territorio" type="geojson" data={feature}>
      <Layer
        id="territorio-fill"
        type="fill"
        paint={{ "fill-color": "#486492", "fill-opacity": 0.12 }}
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
