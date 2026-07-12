import { useState, useCallback, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";
import { useControl } from "react-map-gl/mapbox";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { BaseMap } from "../map/BaseMap";
import type { ViewState } from "../map/BaseMap";
import { criarTerritorio, multiPolygonDe } from "../lib/territorios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function DrawControl({
  onChange,
}: {
  onChange: (quadras: GeoJSON.MultiPolygon | null) => void;
}) {
  const draw = useRef<MapboxDraw | null>(null);

  useControl<MapboxDraw>(
    () => {
      draw.current = new MapboxDraw({
        displayControlsDefault: false,
        controls: { polygon: true, trash: true },
      });
      return draw.current;
    },
    (evt) => {
      const map = evt.map as unknown as {
        on: (ev: string, cb: () => void) => void;
      };
      const atualizar = () =>
        onChange(multiPolygonDe(draw.current?.getAll().features ?? []));
      map.on("draw.create", atualizar);
      map.on("draw.update", atualizar);
      map.on("draw.delete", atualizar);
    },
  );

  return null;
}

export function Cadastro() {
  const [numero, setNumero] = useState("");
  const [nome, setNome] = useState("");
  const [quadras, setQuadras] = useState<GeoJSON.MultiPolygon | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [inicial, setInicial] = useState<ViewState | undefined>(undefined);
  const [mapaPronto, setMapaPronto] = useState(false);
  const onChange = useCallback((q: GeoJSON.MultiPolygon | null) => setQuadras(q), []);

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
      () => setMapaPronto(true),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, []);

  async function salvar() {
    if (!numero || !quadras) return;
    setSalvando(true);
    try {
      await criarTerritorio({ numero, nome: nome || undefined, limites: quadras });
      setNumero("");
      setNome("");
      setQuadras(null);
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

  const total = quadras?.coordinates.length ?? 0;
  const rotuloQuadras =
    total === 0
      ? "Desenhe as quadras do território no mapa"
      : total === 1
        ? "1 quadra desenhada — pronto para salvar"
        : `${total} quadras desenhadas — pronto para salvar`;

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-paper">
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

      <Link
        to="/"
        className="absolute left-3 top-3 z-10 inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-white/90 px-2.5 text-[0.85rem] font-medium text-ink shadow-card backdrop-blur transition-colors hover:text-jwblue"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Territórios
      </Link>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 p-3">
        <div className="pointer-events-auto mx-auto grid max-w-130 gap-3 rounded-2xl border border-line bg-white/95 p-3.5 shadow-card backdrop-blur">
          <div className="flex items-center gap-2 text-[0.74rem] font-medium tracking-[0.01em]">
            <span
              className={cn(
                "size-2 flex-none rounded-full transition-colors",
                total > 0 ? "bg-sage" : "bg-ink-faint",
              )}
              aria-hidden="true"
            />
            <span className={total > 0 ? "text-sage-ink" : "text-ink-soft"}>
              {rotuloQuadras}
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
            disabled={!numero || !quadras || salvando}
          >
            {salvando ? "Salvando…" : "Salvar território"}
          </Button>
        </div>
      </div>
    </div>
  );
}
