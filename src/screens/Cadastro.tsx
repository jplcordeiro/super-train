import { useState, useCallback, useEffect } from "react";
import { Link } from "react-router-dom";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";
import { useControl } from "react-map-gl/mapbox";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { BaseMap } from "../map/BaseMap";
import type { ViewState } from "../map/BaseMap";
import { criarTerritorio } from "../lib/territorios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// Registra o mapbox-gl-draw como controle do mapa e reporta o polígono desenhado.
function DrawControl({ onChange }: { onChange: (p: GeoJSON.Polygon | null) => void }) {
  useControl<MapboxDraw>(
    () =>
      new MapboxDraw({
        displayControlsDefault: false,
        controls: { polygon: true, trash: true },
      }),
    // onAdd
    (evt) => {
      // O tipo do mapa aqui não declara os eventos custom "draw.*".
      const map = evt.map as unknown as {
        on: (ev: string, cb: (e: { features?: GeoJSON.Feature[] }) => void) => void;
      };
      const upd = (e: { features?: GeoJSON.Feature[] }) => {
        const f = e.features?.[0];
        onChange(f ? (f.geometry as GeoJSON.Polygon) : null);
      };
      map.on("draw.create", upd);
      map.on("draw.update", upd);
      map.on("draw.delete", () => onChange(null));
    },
  );
  return null;
}

export function Cadastro() {
  const [numero, setNumero] = useState("");
  const [nome, setNome] = useState("");
  const [polygon, setPolygon] = useState<GeoJSON.Polygon | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [inicial, setInicial] = useState<ViewState | undefined>(undefined);
  const [mapaPronto, setMapaPronto] = useState(false);
  const onChange = useCallback((p: GeoJSON.Polygon | null) => setPolygon(p), []);

  // Centraliza o mapa na localização do usuário ao abrir a tela de cadastro.
  useEffect(() => {
    if (!navigator.geolocation) {
      setMapaPronto(true);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setInicial({
          longitude: pos.coords.longitude,
          latitude: pos.coords.latitude,
          zoom: 16,
        });
        setMapaPronto(true);
      },
      () => setMapaPronto(true), // permissão negada / erro → usa o padrão
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, []);

  async function salvar() {
    if (!numero || !polygon) return;
    setSalvando(true);
    try {
      await criarTerritorio({ numero, nome: nome || undefined, limites: polygon });
      setNumero("");
      setNome("");
      setPolygon(null);
      toast.success(`Território Nº ${numero} salvo.`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      toast.error(
        msg.includes("duplicate")
          ? "Já existe um território com esse número."
          : "Não foi possível salvar o território. Tente novamente.",
      );
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-paper">
      {mapaPronto ? (
        <div className="absolute inset-0">
          <BaseMap showLocation initialViewState={inicial}>
            <DrawControl onChange={onChange} />
          </BaseMap>
        </div>
      ) : (
        <div className="grid h-full place-items-center">
          <div className="flex items-center gap-2.5 text-[0.9rem] text-ink-soft">
            <span className="h-2 w-2 animate-ping rounded-full bg-jwblue" />
            Obtendo sua localização…
          </div>
        </div>
      )}

      {/* Voltar — flutua no topo-esquerdo, oposto aos controles do mapa */}
      <Link
        to="/"
        className="absolute left-3 top-3 z-10 inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-white/90 px-2.5 text-[0.85rem] font-medium text-ink shadow-card backdrop-blur transition-colors hover:text-jwblue"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Territórios
      </Link>

      {/* Painel de cadastro sobreposto ao mapa. O container não captura cliques;
          só o card recebe pointer-events, deixando o mapa livre ao redor. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 p-3">
        <div className="pointer-events-auto mx-auto grid max-w-[520px] gap-3 rounded-2xl border border-line bg-white/95 p-3.5 shadow-card backdrop-blur">
          <div className="flex items-center gap-2 text-[0.74rem] font-medium tracking-[0.01em]">
            <span
              className={cn(
                "size-2 flex-none rounded-full transition-colors",
                polygon ? "bg-sage" : "bg-ink-faint",
              )}
              aria-hidden="true"
            />
            <span className={polygon ? "text-sage-ink" : "text-ink-soft"}>
              {polygon
                ? "Limite desenhado — pronto para salvar"
                : "Desenhe o limite do território no mapa"}
            </span>
          </div>

          <div className="flex gap-2">
            <Input
              className="w-24 flex-none text-center font-mono tabular-nums"
              placeholder="Nº*"
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
              aria-label="Número do território"
            />
            <Input
              className="flex-1"
              placeholder="Nome (opcional)"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              aria-label="Nome do território"
            />
          </div>

          <Button
            className="w-full"
            onClick={salvar}
            disabled={!numero || !polygon || salvando}
          >
            {salvando ? "Salvando…" : "Salvar território"}
          </Button>
        </div>
      </div>
    </div>
  );
}
