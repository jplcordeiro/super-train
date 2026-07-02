import type { ReactNode } from "react";
import Map, { GeolocateControl, NavigationControl } from "react-map-gl/mapbox";

const token = import.meta.env.VITE_MAPBOX_TOKEN;

export interface ViewState {
  longitude: number;
  latitude: number;
  zoom: number;
}

export function BaseMap({
  showLocation = false,
  initialViewState,
  children,
}: {
  showLocation?: boolean;
  initialViewState?: ViewState;
  children?: ReactNode;
}) {
  return (
    <Map
      mapboxAccessToken={token}
      mapStyle="mapbox://styles/mapbox/streets-v12"
      style={{ width: "100%", height: "100%" }}
      initialViewState={
        initialViewState ?? { longitude: -46.63, latitude: -23.55, zoom: 13 }
      }
    >
      <NavigationControl position="top-right" />
      {showLocation && (
        <GeolocateControl
          position="top-right"
          trackUserLocation
          showUserHeading
          positionOptions={{ enableHighAccuracy: true }}
        />
      )}
      {children}
    </Map>
  );
}
