import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { BaseMap } from "../map/BaseMap";
import { TerritorioPolygon, type EstadoQuadra } from "../map/TerritorioPolygon";
import { boundsDeTerritorios, listTerritorios, quadrasDe } from "../lib/territorios";
import {
  desmarcarQuadra,
  listMarcas,
  marcarQuadra,
  marcasDaRodada,
  type Marca,
} from "../lib/quadras";
import { buscarSaida, dataBR, diaDaSemana, DIA_SEMANA } from "../lib/saidas";
import type { Saida, Territorio } from "../lib/types";
import { Button } from "@/components/ui/button";
import { RadarLoader } from "../components/RadarLoader";

export function MarcarQuadras() {
  const { saidaId, territorioId } = useParams();
  const [saida, setSaida] = useState<Saida | null>(null);
  const [territorio, setTerritorio] = useState<Territorio | null>(null);
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!saidaId) return;
    setCarregando(true);
    Promise.all([buscarSaida(saidaId), listTerritorios(), listMarcas()])
      .then(([s, todos, marcadas]) => {
        setSaida(s);
        setTerritorio(todos.find((t) => t.id === territorioId) ?? null);
        setMarcas(marcadas);
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

  const daRodada = marcasDaRodada(territorio, marcas);
  const desteDia = new Map(
    daRodada.filter((m) => m.saida_id === saida.id).map((m) => [m.quadra_id, m]),
  );
  const deOutroDia = new Map(
    daRodada.filter((m) => m.saida_id !== saida.id).map((m) => [m.quadra_id, m]),
  );

  const quadras = quadrasDe(territorio.limites);
  const estados: Record<string, EstadoQuadra> = {};
  for (const q of quadras) {
    if (desteDia.has(q.id)) estados[q.id] = "feita";
    else if (deOutroDia.has(q.id)) estados[q.id] = "outra";
  }
  const feitas = desteDia.size + deOutroDia.size;

  async function alternar(quadraId: string) {
    if (!saida || !territorio) return;
    const jaFeitaEmOutra = deOutroDia.get(quadraId);
    if (jaFeitaEmOutra) {
      toast.info(`Esta quadra já foi feita na saída de ${dataBR(jaFeitaEmOutra.data)}.`);
      return;
    }

    const marcada = desteDia.has(quadraId);
    const anteriores = marcas;
    const nova: Marca = {
      saida_id: saida.id,
      territorio_id: territorio.id,
      quadra_id: quadraId,
      data: saida.data,
    };
    setMarcas(
      marcada
        ? marcas.filter(
            (m) =>
              !(
                m.saida_id === saida.id &&
                m.territorio_id === territorio.id &&
                m.quadra_id === quadraId
              ),
          )
        : [...marcas, nova],
    );

    try {
      if (marcada) await desmarcarQuadra(saida.id, territorio.id, quadraId);
      else await marcarQuadra(saida.id, territorio.id, quadraId);
    } catch {
      setMarcas(anteriores);
      toast.error("Não foi possível salvar a quadra. Tente novamente.");
    }
  }

  const nomeDia = DIA_SEMANA[diaDaSemana(saida.data)];

  return (
    <div className="relative h-dvh w-full overflow-hidden">
      <BaseMap bounds={boundsDeTerritorios([territorio]) ?? undefined}>
        <TerritorioPolygon
          limites={territorio.limites}
          estados={estados}
          onQuadraClick={alternar}
        />
      </BaseMap>

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 p-3">
        <div className="pointer-events-auto mx-auto flex max-w-130 items-center gap-2.5 rounded-xl border border-line bg-white/95 px-3 py-2.5 shadow-card backdrop-blur">
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
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 p-3">
        <div className="pointer-events-auto mx-auto grid max-w-130 gap-1 rounded-xl border border-line bg-white/95 px-3.5 py-3 text-center shadow-card backdrop-blur">
          <span className="text-[0.95rem] font-semibold text-ink">
            {feitas} de {quadras.length} quadras feitas nesta rodada
          </span>
          <span className="text-[0.8rem] text-ink-soft">
            Toque numa quadra para marcar o que foi feito neste dia.
          </span>
        </div>
      </div>
    </div>
  );
}
