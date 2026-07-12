import { useState } from "react";
import { toast } from "sonner";
import {
  atualizarSaida,
  criarSaidas,
  dataBR,
  dataISO,
  datasSemanaisAteFimDoMes,
  diaDaSemana,
  DIA_SEMANA,
  mascaraData,
  type EntradaSaida,
} from "../lib/saidas";
import type { Periodo, Publicador, Saida, Territorio } from "../lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const SEM_PUBLICADOR = "a-definir";

interface Props {
  data: string;
  saida?: Saida;
  territorios: Territorio[];
  publicadores: Publicador[];
  locais: string[];
  onPronto: () => void;
  onCancelar: () => void;
}

export function SaidaForm({
  data,
  saida,
  territorios,
  publicadores,
  locais,
  onPronto,
  onCancelar,
}: Props) {
  const [quando, setQuando] = useState(saida?.data ?? data);
  const [textoData, setTextoData] = useState(dataBR(saida?.data ?? data));
  const [periodo, setPeriodo] = useState<Periodo>(saida?.periodo ?? "manha");
  const [local, setLocal] = useState(saida?.local ?? "");
  const [publicadorId, setPublicadorId] = useState(
    saida?.publicador_id ?? SEM_PUBLICADOR,
  );
  const [escolhidos, setEscolhidos] = useState<string[]>(saida?.territorio_ids ?? []);
  const [observacao, setObservacao] = useState(saida?.observacao ?? "");
  const [repetir, setRepetir] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const repeticoes = datasSemanaisAteFimDoMes(quando);
  const podeRepetir = !saida && repeticoes.length > 1;
  const nomeDia = DIA_SEMANA[diaDaSemana(quando)];

  function alternarTerritorio(id: string) {
    setEscolhidos((atual) =>
      atual.includes(id) ? atual.filter((t) => t !== id) : [...atual, id],
    );
  }

  async function salvar() {
    const entrada: EntradaSaida = {
      data: quando,
      periodo,
      local: local.trim() || null,
      publicador_id: publicadorId === SEM_PUBLICADOR ? null : publicadorId,
      observacao: observacao.trim() || null,
      territorio_ids: escolhidos,
    };
    setSalvando(true);
    try {
      if (saida) {
        await atualizarSaida(saida.id, entrada);
        toast.success("Saída atualizada.");
      } else {
        const datas = repetir && podeRepetir ? repeticoes : [quando];
        await criarSaidas(entrada, datas);
        toast.success(
          datas.length > 1
            ? `${datas.length} saídas criadas, uma em cada ${nomeDia}.`
            : "Saída criada.",
        );
      }
      onPronto();
    } catch {
      toast.error("Não foi possível salvar a saída. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  const rotulo = "text-[0.72rem] font-semibold uppercase tracking-[0.1em] text-ink-soft";

  return (
    <div className="grid gap-5">
      <div className="grid gap-2">
        <Label className={rotulo} htmlFor="saida-data">
          Data
        </Label>
        <Input
          id="saida-data"
          inputMode="numeric"
          placeholder="dd/mm/aaaa"
          value={textoData}
          onChange={(e) => {
            const texto = mascaraData(e.target.value);
            setTextoData(texto);
            const iso = dataISO(texto);
            if (iso) setQuando(iso);
          }}
          onBlur={() => setTextoData(dataBR(quando))}
        />
      </div>

      <div className="grid gap-2">
        <span className={rotulo}>Período</span>
        <div className="grid grid-cols-2 gap-2">
          {(["manha", "tarde"] as const).map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={periodo === p}
              onClick={() => setPeriodo(p)}
              className={cn(
                "min-h-10 rounded-lg border text-[0.9rem] transition-colors",
                periodo === p
                  ? "border-jwblue bg-jwblue-wash font-medium text-jwblue-deep"
                  : "border-line bg-white text-ink-soft hover:border-line-strong",
              )}
            >
              {p === "manha" ? "Manhã" : "Tarde"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-2">
        <Label className={rotulo} htmlFor="saida-local">
          Ponto de encontro
        </Label>
        <Input
          id="saida-local"
          list="locais-usados"
          placeholder="Gruta da Ilha"
          value={local}
          onChange={(e) => setLocal(e.target.value)}
        />
        <datalist id="locais-usados">
          {locais.map((l) => (
            <option key={l} value={l} />
          ))}
        </datalist>
      </div>

      <div className="grid gap-2">
        <Label className={rotulo} htmlFor="saida-publicador">
          Dirigente
        </Label>
        <Select value={publicadorId} onValueChange={setPublicadorId}>
          <SelectTrigger id="saida-publicador" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={SEM_PUBLICADOR}>A definir</SelectItem>
            {publicadores.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-2">
        <span className={rotulo}>Territórios</span>
        {territorios.length === 0 ? (
          <p className="text-[0.85rem] text-ink-soft">Nenhum território cadastrado.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {territorios.map((t) => {
              const marcado = escolhidos.includes(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={marcado}
                  onClick={() => alternarTerritorio(t.id)}
                  title={t.nome ?? undefined}
                  className={cn(
                    "min-h-9 rounded-full border px-3 font-mono text-[0.82rem] tabular-nums transition-colors",
                    marcado
                      ? "border-jwblue bg-jwblue text-white"
                      : "border-line bg-white text-ink-soft hover:border-line-strong",
                    !t.ativo && !marcado && "text-ink-faint italic",
                  )}
                >
                  {t.numero}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid gap-2">
        <Label className={rotulo} htmlFor="saida-obs">
          Observação
        </Label>
        <Input
          id="saida-obs"
          placeholder="faltante, grupo esperança…"
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
        />
      </div>

      {podeRepetir && (
        <label className="flex cursor-pointer select-none items-start gap-2.5 rounded-lg border border-line bg-mist px-3 py-2.5 text-[0.85rem] text-ink">
          <Checkbox
            className="mt-0.5"
            checked={repetir}
            onCheckedChange={(v) => setRepetir(v === true)}
          />
          <span>
            Repetir toda {nomeDia} até o fim do mês
            <span className="block text-[0.78rem] text-ink-soft">
              Cria {repeticoes.length} saídas iguais. Depois dá para editar cada uma
              separadamente.
            </span>
          </span>
        </label>
      )}

      <div className="flex gap-2">
        <Button onClick={salvar} disabled={salvando}>
          {saida ? "Salvar alterações" : "Criar saída"}
        </Button>
        <Button variant="outline" onClick={onCancelar} disabled={salvando}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
