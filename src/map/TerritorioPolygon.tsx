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
        paint={{ "fill-color": "#0b3d91", "fill-opacity": 0.15 }}
      />
      <Layer
        id="territorio-line"
        type="line"
        paint={{ "line-color": "#0b3d91", "line-width": 3 }}
      />
    </Source>
  );
}
