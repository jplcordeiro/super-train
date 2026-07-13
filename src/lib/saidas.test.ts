import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  atualizarSaida,
  dataBR,
  dataISO,
  datasSemanaisAteFimDoMes,
  diaDaSemana,
  gradeDoMes,
  locaisUsados,
  mascaraData,
  mesVizinho,
  mesmoMes,
  saidasDoDia,
} from "./saidas";
import type { EntradaSaida } from "./saidas";
import type { Periodo, Saida } from "./types";

interface Chamada {
  tabela: string;
  op: string;
  valores?: unknown;
  filtros: Record<string, unknown>;
}

const chamadas: Chamada[] = [];
let vinculos: string[] = [];

vi.mock("./supabase", () => {
  function consulta(tabela: string) {
    const chamada: Chamada = { tabela, op: "", filtros: {} };
    const encadeavel = {
      select: () => ((chamada.op ||= "select"), chamadas.push(chamada), encadeavel),
      update: (valores: unknown) => (
        Object.assign(chamada, { op: "update", valores }),
        chamadas.push(chamada),
        encadeavel
      ),
      insert: (valores: unknown) => (
        Object.assign(chamada, { op: "insert", valores }),
        chamadas.push(chamada),
        encadeavel
      ),
      delete: () => ((chamada.op = "delete"), chamadas.push(chamada), encadeavel),
      eq: (coluna: string, valor: unknown) => (
        (chamada.filtros[coluna] = valor), encadeavel
      ),
      in: (coluna: string, valores: unknown) => (
        (chamada.filtros[coluna] = valores), encadeavel
      ),
      then: (resolver: (r: unknown) => void) =>
        resolver(
          chamada.op === "select"
            ? { data: vinculos.map((territorio_id) => ({ territorio_id })), error: null }
            : { data: [], error: null },
        ),
    };
    return encadeavel;
  }
  return { supabase: { from: (tabela: string) => consulta(tabela) } };
});

const entrada = (territorio_ids: string[]): EntradaSaida => ({
  data: "2026-07-12",
  periodo: "manha",
  local: "Gruta da Ilha",
  publicador_id: "p1",
  observacao: null,
  territorio_ids,
});

const feitas = (tabela: string, op: string) =>
  chamadas.filter((c) => c.tabela === tabela && c.op === op);

function saida(p: Partial<Saida> & { id: string }): Saida {
  return {
    data: "2026-07-05",
    periodo: "manha" as Periodo,
    local: null,
    publicador_id: null,
    observacao: null,
    created_at: "2026-06-01T00:00:00Z",
    territorio_ids: [],
    ...p,
  };
}

describe("atualizarSaida", () => {
  beforeEach(() => {
    chamadas.length = 0;
    vinculos = [];
  });

  it("não desvincula um território que continua na saída", async () => {
    vinculos = ["t1"];
    await atualizarSaida("s1", entrada(["t1"]));

    expect(feitas("saida_territorio", "delete")).toHaveLength(0);
    expect(feitas("saida_territorio", "insert")).toHaveLength(0);
  });

  it("desvincula só o território que saiu", async () => {
    vinculos = ["t1", "t2"];
    await atualizarSaida("s1", entrada(["t1"]));

    const remocoes = feitas("saida_territorio", "delete");
    expect(remocoes).toHaveLength(1);
    expect(remocoes[0].filtros).toEqual({ saida_id: "s1", territorio_id: ["t2"] });
  });

  it("vincula só o território que entrou", async () => {
    vinculos = ["t1"];
    await atualizarSaida("s1", entrada(["t1", "t2"]));

    expect(feitas("saida_territorio", "delete")).toHaveLength(0);
    expect(feitas("saida_territorio", "insert")[0].valores).toEqual([
      { saida_id: "s1", territorio_id: "t2" },
    ]);
  });
});

describe("gradeDoMes", () => {
  it("cobre semanas inteiras, de domingo a sábado", () => {
    const grade = gradeDoMes({ ano: 2026, mes: 7 });
    expect(grade[0]).toBe("2026-06-28");
    expect(grade[grade.length - 1]).toBe("2026-08-01");
    expect(grade).toHaveLength(35);
    expect(diaDaSemana(grade[0])).toBe(0);
    expect(diaDaSemana(grade[grade.length - 1])).toBe(6);
  });

  it("começa no próprio dia 1 quando o mês já abre num domingo", () => {
    const grade = gradeDoMes({ ano: 2026, mes: 2 });
    expect(grade[0]).toBe("2026-02-01");
  });

  it("marca como de fora os dias do mês vizinho", () => {
    const mes = { ano: 2026, mes: 7 };
    expect(mesmoMes("2026-06-28", mes)).toBe(false);
    expect(mesmoMes("2026-07-01", mes)).toBe(true);
    expect(mesmoMes("2026-08-01", mes)).toBe(false);
  });
});

describe("datasSemanaisAteFimDoMes", () => {
  it("repete de 7 em 7 sem passar do fim do mês", () => {
    expect(datasSemanaisAteFimDoMes("2026-07-06")).toEqual([
      "2026-07-06",
      "2026-07-13",
      "2026-07-20",
      "2026-07-27",
    ]);
  });

  it("devolve só a própria data quando não cabe outra semana", () => {
    expect(datasSemanaisAteFimDoMes("2026-07-27")).toEqual(["2026-07-27"]);
  });

  it("mantém o dia da semana em todas as repetições", () => {
    const datas = datasSemanaisAteFimDoMes("2026-07-02");
    expect(datas.every((d) => diaDaSemana(d) === diaDaSemana("2026-07-02"))).toBe(true);
  });
});

describe("mesVizinho", () => {
  it("atravessa a virada do ano", () => {
    expect(mesVizinho({ ano: 2026, mes: 12 }, 1)).toEqual({ ano: 2027, mes: 1 });
    expect(mesVizinho({ ano: 2026, mes: 1 }, -1)).toEqual({ ano: 2025, mes: 12 });
  });
});

describe("saidasDoDia", () => {
  it("ordena a manhã antes da tarde", () => {
    const lista = [
      saida({ id: "tarde", periodo: "tarde" }),
      saida({ id: "manha", periodo: "manha" }),
    ];
    expect(saidasDoDia(lista, "2026-07-05").map((s) => s.id)).toEqual([
      "manha",
      "tarde",
    ]);
  });

  it("mantém as duas saídas de domingo, ambas de manhã, na ordem de criação", () => {
    const lista = [
      saida({ id: "segunda", local: "Crepe Cevada", created_at: "2026-06-02T00:00:00Z" }),
      saida({ id: "primeira", local: "Casa da Zezé", created_at: "2026-06-01T00:00:00Z" }),
    ];
    expect(saidasDoDia(lista, "2026-07-05").map((s) => s.id)).toEqual([
      "primeira",
      "segunda",
    ]);
  });

  it("ignora as saídas dos outros dias", () => {
    const lista = [saida({ id: "a" }), saida({ id: "b", data: "2026-07-06" })];
    expect(saidasDoDia(lista, "2026-07-05").map((s) => s.id)).toEqual(["a"]);
  });
});

describe("locaisUsados", () => {
  it("junta os pontos de encontro sem repetir, em ordem alfabética", () => {
    const lista = [
      saida({ id: "1", local: "Gruta da Ilha" }),
      saida({ id: "2", local: "Casa da Zezé" }),
      saida({ id: "3", local: "Gruta da Ilha" }),
      saida({ id: "4", local: null }),
    ];
    expect(locaisUsados(lista)).toEqual(["Casa da Zezé", "Gruta da Ilha"]);
  });
});

describe("dataBR", () => {
  it("mostra a data no formato brasileiro", () => {
    expect(dataBR("2026-07-05")).toBe("05/07/2026");
  });
});

describe("dataISO", () => {
  it("lê a data digitada no formato brasileiro", () => {
    expect(dataISO("05/07/2026")).toBe("2026-07-05");
  });

  it("recusa data incompleta", () => {
    expect(dataISO("05/07")).toBeNull();
    expect(dataISO("")).toBeNull();
  });

  it("recusa dia que não existe no mês", () => {
    expect(dataISO("31/02/2026")).toBeNull();
    expect(dataISO("00/07/2026")).toBeNull();
    expect(dataISO("05/13/2026")).toBeNull();
  });
});

describe("mascaraData", () => {
  it("vai inserindo as barras conforme se digita", () => {
    expect(mascaraData("0")).toBe("0");
    expect(mascaraData("05")).toBe("05");
    expect(mascaraData("057")).toBe("05/7");
    expect(mascaraData("05/07")).toBe("05/07");
    expect(mascaraData("05/072026")).toBe("05/07/2026");
  });

  it("ignora o que não é dígito e o que passa de oito dígitos", () => {
    expect(mascaraData("5a7b2026999")).toBe("57/20/2699");
  });
});
