import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Check, MapPin } from "lucide-react";
import { toast } from "sonner";
import { BaseMap } from "../map/BaseMap";
import { TerritorioPolygon, type EstadoQuadra } from "../map/TerritorioPolygon";
import { boundsDeTerritorios, listTerritorios, quadrasDe } from "../lib/territorios";
import {
  desmarcarQuadra,
  historicoDaQuadra,
  limparParada,
  listMarcas,
  listParadas,
  marcarQuadra,
  paradaAtualDe,
  pararEm,
  type Marca,
  type Parada,
} from "../lib/quadras";
import { comecarRodada, listRodadas, rodadaEm } from "../lib/rodadas";
import { listPublicadores } from "../lib/publicadores";
import { buscarSaida, dataBR, diaDaSemana, DIA_SEMANA } from "../lib/saidas";
import type { Publicador, Rodada, Saida, Territorio } from "../lib/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { RadarLoader } from "../components/RadarLoader";
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

type Modo = "feita" | "parada";

export function MarcarQuadras() {
  const { saidaId, territorioId } = useParams();
  const [saida, setSaida] = useState<Saida | null>(null);
  const [territorio, setTerritorio] = useState<Territorio | null>(null);
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [paradas, setParadas] = useState<Parada[]>([]);
  const [publicadores, setPublicadores] = useState<Publicador[]>([]);
  const [rodadas, setRodadas] = useState<Rodada[]>([]);
  const [modo, setModo] = useState<Modo>("feita");
  const [confirmarRodada, setConfirmarRodada] = useState(false);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!saidaId) return;
    setCarregando(true);
    Promise.all([
      buscarSaida(saidaId),
      listTerritorios(),
      listMarcas(),
      listParadas(),
      listPublicadores(),
      listRodadas(),
    ])
      .then(([s, todos, marcadas, paradasList, pubs, rods]) => {
        setSaida(s);
        setTerritorio(todos.find((t) => t.id === territorioId) ?? null);
        setMarcas(marcadas);
        setParadas(paradasList);
        setPublicadores(pubs);
        setRodadas(rods);
      })
      .catch(() => toast.error("Não foi possível abrir a saída. Tente novamente."))
      .finally(() => setCarregando(false));
  }, [saidaId, territorioId]);

  if (carregando) return <RadarLoader texto="Abrindo o território…" />;

  if (!saida || !territorio || !territorio.limites) {
    return (
      <div className="grid h-dvh place-items-center bg-paper px-6">
        <div className="grid justify-items-center gap-4 text-center">
          <h1 className="text-lg font-semibold text-ink">Nada para marcar aqui</h1>
          <p className="text-[0.9rem] text-ink-soft">
            A saída não existe mais, ou este território ainda não tem quadras
            desenhadas.
          </p>
          <Button asChild>
            <Link to="/calendario">Voltar ao calendário</Link>
          </Button>
        </div>
      </div>
    );
  }

  const janela = rodadaEm(territorio.id, saida.data, rodadas);
  const emRodada = { ...territorio, inicio: janela.inicio };
  const naJanela = (data: string) =>
    (!janela.inicio || data >= janela.inicio) && (!janela.fim || data < janela.fim);
  const desteDia = new Map(
    marcas
      .filter((m) => m.territorio_id === territorio.id && m.saida_id === saida.id)
      .map((m) => [m.quadra_id, m]),
  );
  const deOutroDia = new Map(
    marcas
      .filter(
        (m) =>
          m.territorio_id === territorio.id &&
          m.saida_id !== saida.id &&
          naJanela(m.data),
      )
      .map((m) => [m.quadra_id, m]),
  );
  const paradaAtual = paradaAtualDe(emRodada, marcas, paradas);

  const quadras = quadrasDe(territorio.limites);
  const estados: Record<string, EstadoQuadra> = {};
  for (const q of quadras) {
    if (desteDia.has(q.id)) estados[q.id] = "feita";
    else if (deOutroDia.has(q.id)) estados[q.id] = "outra";
    else if (paradaAtual.has(q.id)) estados[q.id] = "andamento";
  }
  const feitas = desteDia.size + deOutroDia.size;
  const pinos = [...paradaAtual.values()].map((p) => ({
    quadraId: p.quadra_id,
    lng: p.lng,
    lat: p.lat,
  }));

  const semParada = (lista: Parada[], quadraId: string) =>
    lista.filter(
      (p) => !(p.territorio_id === territorio.id && p.quadra_id === quadraId),
    );
  const semMarca = (lista: Marca[], quadraId: string) =>
    lista.filter(
      (m) =>
        !(
          m.saida_id === saida.id &&
          m.territorio_id === territorio.id &&
          m.quadra_id === quadraId
        ),
    );

  async function marcarFeita(quadraId: string) {
    if (!saida || !territorio) return;
    const marcada = desteDia.has(quadraId);
    const tinhaPino = paradaAtual.has(quadraId);
    const antesM = marcas;
    const antesP = paradas;
    setMarcas(
      marcada
        ? semMarca(marcas, quadraId)
        : [
            ...marcas,
            {
              saida_id: saida.id,
              territorio_id: territorio.id,
              quadra_id: quadraId,
              data: saida.data,
              local: saida.local,
              publicador_id: saida.publicador_id,
            },
          ],
    );
    if (!marcada && tinhaPino) setParadas(semParada(paradas, quadraId));
    try {
      if (marcada) await desmarcarQuadra(saida.id, territorio.id, quadraId);
      else {
        await marcarQuadra(saida.id, territorio.id, quadraId);
        if (tinhaPino) await limparParada(territorio.id, quadraId);
      }
    } catch {
      setMarcas(antesM);
      setParadas(antesP);
      toast.error("Não foi possível salvar a quadra. Tente novamente.");
    }
  }

  async function marcarParada(
    quadraId: string,
    lngLat: { lng: number; lat: number },
  ) {
    if (!saida || !territorio) return;
    const eraFeita = desteDia.has(quadraId);
    const antesM = marcas;
    const antesP = paradas;
    const nova: Parada = {
      saida_id: saida.id,
      territorio_id: territorio.id,
      quadra_id: quadraId,
      lng: lngLat.lng,
      lat: lngLat.lat,
      data: saida.data,
      local: saida.local,
      publicador_id: saida.publicador_id,
    };
    setParadas([...semParada(paradas, quadraId), nova]);
    if (eraFeita) setMarcas(semMarca(marcas, quadraId));
    try {
      await pararEm(saida.id, territorio.id, quadraId, lngLat.lng, lngLat.lat);
      if (eraFeita) await desmarcarQuadra(saida.id, territorio.id, quadraId);
    } catch {
      setMarcas(antesM);
      setParadas(antesP);
      toast.error("Não foi possível salvar o ponto de parada. Tente novamente.");
    }
  }

  async function aoTocarQuadra(
    quadraId: string,
    lngLat: { lng: number; lat: number },
  ) {
    const jaFeitaEmOutra = deOutroDia.get(quadraId);
    if (jaFeitaEmOutra) {
      toast.info(
        `Esta quadra já foi feita na saída de ${dataBR(jaFeitaEmOutra.data)}.`,
        {
          action: {
            label: "Começar nova rodada",
            onClick: () => setConfirmarRodada(true),
          },
        },
      );
      return;
    }
    if (modo === "feita") await marcarFeita(quadraId);
    else await marcarParada(quadraId, lngLat);
  }

  async function novaRodadaAqui() {
    if (!saida || !territorio) return;
    setConfirmarRodada(false);
    try {
      await comecarRodada(territorio.id, saida.data);
      setRodadas(await listRodadas());
      toast.success(`Nova rodada começada em ${dataBR(saida.data)}.`);
    } catch {
      toast.error("Não foi possível começar a nova rodada. Tente novamente.");
    }
  }

  async function removerPino(quadraId: string) {
    if (!territorio) return;
    const antes = paradas;
    setParadas(semParada(paradas, quadraId));
    try {
      await limparParada(territorio.id, quadraId);
    } catch {
      setParadas(antes);
      toast.error("Não foi possível remover o ponto. Tente novamente.");
    }
  }

  const nomeDia = DIA_SEMANA[diaDaSemana(saida.data)];
  const botaoModo =
    "inline-flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[0.82rem] font-medium transition-colors";

  return (
    <div className="relative h-dvh w-full overflow-hidden">
      <BaseMap bounds={boundsDeTerritorios([territorio]) ?? undefined}>
        <TerritorioPolygon
          limites={territorio.limites}
          estados={estados}
          paradas={pinos}
          onQuadraClick={aoTocarQuadra}
          onParadaClick={modo === "parada" ? removerPino : undefined}
          historicoDe={(quadraId) =>
            historicoDaQuadra(territorio.id, quadraId, marcas, publicadores)
          }
        />
      </BaseMap>

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 p-3">
        <div className="pointer-events-auto mx-auto grid max-w-130 gap-2.5 rounded-xl border border-line bg-white/95 px-3 py-2.5 shadow-card backdrop-blur">
          <div className="flex items-center gap-2.5">
            <Link
              to="/calendario"
              aria-label="Voltar ao calendário"
              className="grid size-9 flex-none place-items-center rounded-lg text-ink-soft transition-colors hover:bg-mist hover:text-jwblue"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
            </Link>
            <div className="grid min-w-0 gap-0.5">
              <span className="text-[0.72rem] font-semibold uppercase tracking-[0.1em] text-ink-soft">
                Marcando {nomeDia}, {dataBR(saida.data)}
              </span>
              <span className="truncate text-[0.95rem] font-semibold text-jwblue-deep">
                Território Nº {territorio.numero}
                {territorio.nome ? ` · ${territorio.nome}` : ""}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-mist p-1">
            <button
              type="button"
              onClick={() => setModo("feita")}
              aria-pressed={modo === "feita"}
              className={cn(
                botaoModo,
                modo === "feita"
                  ? "bg-white text-jwblue-deep shadow-card"
                  : "text-ink-soft",
              )}
            >
              <Check className="size-3.5" aria-hidden="true" /> Feita
            </button>
            <button
              type="button"
              onClick={() => setModo("parada")}
              aria-pressed={modo === "parada"}
              className={cn(
                botaoModo,
                modo === "parada" ? "bg-white text-ocre shadow-card" : "text-ink-soft",
              )}
            >
              <MapPin className="size-3.5" aria-hidden="true" /> Paramos aqui
            </button>
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 p-3">
        <div className="pointer-events-auto mx-auto grid max-w-130 gap-1 rounded-xl border border-line bg-white/95 px-3.5 py-3 text-center shadow-card backdrop-blur">
          <span className="text-[0.95rem] font-semibold text-ink">
            {feitas} de {quadras.length} quadras feitas nesta rodada
          </span>
          <span className="text-[0.8rem] text-ink-soft">
            {modo === "feita"
              ? "Toque numa quadra para marcar o que foi feito neste dia."
              : "Toque no mapa onde o grupo parou. Toque no pino para remover."}
          </span>
        </div>
      </div>

      <AlertDialog open={confirmarRodada} onOpenChange={setConfirmarRodada}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Começar nova rodada no Território Nº {territorio.numero}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              A contagem recomeça do zero a partir de {dataBR(saida.data)}, a data
              desta saída, para que o que você marcar hoje entre na rodada nova. As
              marcas antigas continuam guardadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={novaRodadaAqui}>
              Começar nova rodada
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
