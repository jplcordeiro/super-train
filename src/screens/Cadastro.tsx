import { useState, useCallback, useEffect, useRef } from "react";
import { Link, useParams, useNavigate, useBlocker } from "react-router-dom";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";
import { useControl, useMap } from "react-map-gl/mapbox";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { BaseMap } from "../map/BaseMap";
import type { ViewState, Bounds } from "../map/BaseMap";
import {
  criarTerritorio,
  atualizarTerritorio,
  listTerritorios,
  limitesDe,
  featureCollectionDe,
  boundsDeTerritorios,
} from "../lib/territorios";
import { listMarcas, progressoDe } from "../lib/quadras";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

export function DrawControl({
  desenhoInicial,
  onChange,
}: {
  desenhoInicial: GeoJSON.FeatureCollection | null;
  onChange: (quadras: Quadras | null) => void;
}) {
  const draw = useRef<MapboxDraw | null>(null);
  const { current: map } = useMap();
  const atualizar = () =>
    onChange(limitesDe(draw.current?.getAll().features ?? []));

  draw.current = useControl<MapboxDraw>(
    () =>
      new MapboxDraw({
        displayControlsDefault: false,
        controls: { polygon: true, trash: true },
      }),
    (evt) => {
      const m = evt.map as unknown as {
        on: (ev: string, cb: () => void) => void;
      };
      m.on("draw.create", atualizar);
      m.on("draw.update", atualizar);
      m.on("draw.delete", atualizar);
    },
    (evt) => {
      const m = evt.map as unknown as {
        off: (ev: string, cb: () => void) => void;
      };
      m.off("draw.create", atualizar);
      m.off("draw.update", atualizar);
      m.off("draw.delete", atualizar);
    },
  );

  useEffect(() => {
    if (!map || !desenhoInicial?.features.length) return;
    const aplicar = () => draw.current?.set(desenhoInicial);
    if (map.isStyleLoaded()) aplicar();
    else map.once("load", aplicar);
  }, [map, desenhoInicial]);

  return null;
}

type Quadras = GeoJSON.FeatureCollection<GeoJSON.Polygon>;

const estadoDe = (numero: string, nome: string, quadras: Quadras | null) =>
  JSON.stringify([
    numero.trim(),
    nome.trim(),
    quadras?.features.map((f) => f.geometry.coordinates) ?? null,
  ]);

const VAZIO = estadoDe("", "", null);

export function Cadastro() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [numero, setNumero] = useState("");
  const [nome, setNome] = useState("");
  const [quadras, setQuadras] = useState<Quadras | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [inicial, setInicial] = useState<ViewState | undefined>(undefined);
  const [enquadramento, setEnquadramento] = useState<Bounds | undefined>(undefined);
  const [desenhoInicial, setDesenhoInicial] =
    useState<GeoJSON.FeatureCollection | null>(null);
  const [mapaPronto, setMapaPronto] = useState(false);
  const [salvo, setSalvo] = useState(VAZIO);
  const [marcadas, setMarcadas] = useState(0);
  const [confirmandoEdicao, setConfirmandoEdicao] = useState(false);
  const saindoAposSalvar = useRef(false);
  const onChange = useCallback((q: Quadras | null) => setQuadras(q), []);

  const alterado = estadoDe(numero, nome, quadras) !== salvo;
  const bloqueio = useBlocker(
    ({ currentLocation, nextLocation }) =>
      alterado &&
      !saindoAposSalvar.current &&
      currentLocation.pathname !== nextLocation.pathname,
  );

  useEffect(() => {
    if (id) {
      Promise.all([listTerritorios(), listMarcas()])
        .then(([todos, marcas]) => {
          const t = todos.find((x) => x.id === id);
          if (!t) {
            toast.error("Território não encontrado.");
            navigate("/");
            return;
          }
          const desenho = featureCollectionDe(t.limites);
          const limites = limitesDe(desenho.features);
          setNumero(t.numero);
          setNome(t.nome ?? "");
          setQuadras(limites);
          setSalvo(estadoDe(t.numero, t.nome ?? "", limites));
          setDesenhoInicial(desenho);
          setEnquadramento(boundsDeTerritorios([t]) ?? undefined);
          setMarcadas(progressoDe(t, marcas).feitas);
          setMapaPronto(true);
        })
        .catch(() => {
          toast.error("Não foi possível abrir o território.");
          navigate("/");
        });
      return;
    }

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
  }, [id, navigate]);

  async function salvar() {
    if (!numero || !quadras) return;
    setSalvando(true);
    try {
      if (id) {
        await atualizarTerritorio(id, {
          numero,
          nome: nome || undefined,
          limites: quadras,
        });
        toast.success(`Território Nº ${numero} atualizado.`);
        saindoAposSalvar.current = true;
        navigate("/");
      } else {
        await criarTerritorio({ numero, nome: nome || undefined, limites: quadras });
        setNumero("");
        setNome("");
        setQuadras(null);
        setSalvo(VAZIO);
        toast.success(`Território Nº ${numero} salvo.`);
      }
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

  const total = quadras?.features.length ?? 0;
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
          <BaseMap
            showLocation={!id}
            initialViewState={inicial}
            bounds={enquadramento}
          >
            <DrawControl desenhoInicial={desenhoInicial} onChange={onChange} />
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
            onClick={() => (marcadas > 0 ? setConfirmandoEdicao(true) : salvar())}
            disabled={!numero || !quadras || salvando}
          >
            {salvando
              ? "Salvando…"
              : id
                ? "Salvar alterações"
                : "Salvar território"}
          </Button>
        </div>
      </div>

      <AlertDialog
        open={bloqueio.state === "blocked"}
        onOpenChange={(aberto) => {
          if (!aberto) bloqueio.reset?.();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sair sem salvar?</AlertDialogTitle>
            <AlertDialogDescription>
              As alterações neste território ainda não foram salvas. Se você sair
              agora, elas serão perdidas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => bloqueio.reset?.()}>
              Continuar editando
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => bloqueio.proceed?.()}
            >
              Sair sem salvar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmandoEdicao} onOpenChange={setConfirmandoEdicao}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Salvar mesmo com a rodada em andamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Este território tem {marcadas}{" "}
              {marcadas === 1 ? "quadra marcada" : "quadras marcadas"} nesta rodada. Se
              você apagar uma quadra marcada, ela deixa de contar; se acrescentar uma
              nova, ela entra como a fazer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar editando</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmandoEdicao(false);
                salvar();
              }}
            >
              Salvar alterações
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
