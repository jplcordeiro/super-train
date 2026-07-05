import { useRef, type ComponentRef, type ReactNode } from "react";
import Map, { GeolocateControl, NavigationControl } from "react-map-gl/mapbox";
import { toast } from "sonner";

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
  const geolocate = useRef<ComponentRef<typeof GeolocateControl>>(null);

  return (
    <Map
      mapboxAccessToken={token}
      mapStyle="mapbox://styles/mapbox/streets-v12"
      style={{ width: "100%", height: "100%" }}
      initialViewState={
        initialViewState ?? { longitude: -46.63, latitude: -23.55, zoom: 13 }
      }
      onLoad={() => {
        // Aciona o "você está aqui" assim que o mapa carrega: a tela existe para
        // localizar, então não esperamos o usuário achar o botão no canto.
        if (showLocation) geolocate.current?.trigger();
      }}
    >
      {/* No celular o zoom é por pinça; os botões só disputam o canto com o
          geolocate. Só mostramos a bússola/zoom quando não há localização. */}
      {!showLocation && <NavigationControl position="top-right" />}
      {showLocation && (
        <GeolocateControl
          ref={geolocate}
          position="top-right"
          trackUserLocation
          showUserHeading
          positionOptions={{ enableHighAccuracy: true }}
          onError={() =>
            toast.error(
              "Ative a localização do navegador para se orientar no território.",
            )
          }
        />
      )}
      {children}
    </Map>
  );
}
