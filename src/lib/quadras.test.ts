import { describe, it, expect, vi } from "vitest";
import {
  listMarcas,
  listParadas,
  historicoDaQuadra,
  marcasDaRodada,
  paradasDaRodada,
  paradaAtualDe,
  quadrasFeitasDe,
  progressoDe,
  passagensDoMes,
} from "./quadras";
import type { Marca, Parada } from "./quadras";
import type { EmRodada } from "./rodadas";
import type { Publicador } from "./types";

const linhas: Record<string, unknown[]> = {
  quadra_feita: [],
  saida: [],
  ponto_parada: [],
};
const selects: string[] = [];

vi.mock("./supabase", () => ({
  supabase: {
    from: (tabela: string) => ({
      select: (colunas: string) => {
        selects.push(`${tabela}: ${colunas}`);
        return Promise.resolve({ data: linhas[tabela], error: null });
      },
    }),
  },
}));

function quadrado(lng: number, lat: number): GeoJSON.Polygon {
  return {
    type: "Polygon",
    coordinates: [
      [
        [lng, lat],
        [lng + 1, lat],
        [lng + 1, lat + 1],
        [lng, lat],
      ],
    ],
  };
}

function territorio(ids: string[], inicio: string | null = null): EmRodada {
  return {
    id: "t1",
    numero: "6",
    nome: null,
    limites: {
      type: "FeatureCollection",
      features: ids.map((id, i) => ({
        type: "Feature",
        properties: { id },
        geometry: quadrado(-46 + i, -23),
      })),
    },
    ativo: true,
    inicio,
    created_at: "",
  };
}

const marca = (quadra_id: string, data: string, saida_id = "s1"): Marca => ({
  saida_id,
  territorio_id: "t1",
  quadra_id,
  data,
  local: null,
  publicador_id: null,
});

const parada = (quadra_id: string, data: string, saida_id = "s1"): Parada => ({
  saida_id,
  territorio_id: "t1",
  quadra_id,
  lng: -46,
  lat: -23,
  data,
  local: null,
  publicador_id: null,
});

describe("listMarcas", () => {
  it("não pede embed de saida: quadra_feita só tem FK para saida_territorio", async () => {
    linhas.quadra_feita = [];
    linhas.saida = [];
    selects.length = 0;

    await listMarcas();

    const pedido = selects.find((s) => s.startsWith("quadra_feita:")) ?? "";
    expect(pedido).not.toMatch(/saida\s*\(/);
  });

  it("traz data, local e dirigente de cada marca a partir da saída dela", async () => {
    linhas.quadra_feita = [{ saida_id: "s1", territorio_id: "t1", quadra_id: "qa" }];
    linhas.saida = [
      { id: "s1", data: "2026-07-12", local: "Gruta da Ilha", publicador_id: "p1" },
    ];

    expect(await listMarcas()).toEqual([
      {
        saida_id: "s1",
        territorio_id: "t1",
        quadra_id: "qa",
        data: "2026-07-12",
        local: "Gruta da Ilha",
        publicador_id: "p1",
      },
    ]);
  });

  it("descarta a marca cuja saída sumiu, em vez de inventar uma data", async () => {
    linhas.quadra_feita = [{ saida_id: "sumiu", territorio_id: "t1", quadra_id: "qa" }];
    linhas.saida = [
      { id: "s1", data: "2026-07-12", local: null, publicador_id: null },
    ];

    expect(await listMarcas()).toEqual([]);
  });
});

describe("historicoDaQuadra", () => {
  const publicadores: Publicador[] = [
    { id: "p1", nome: "Kleber", telefone: null, created_at: "" },
  ];
  const passagem = (data: string, saida_id: string, publicador_id: string | null) => ({
    ...marca("qa", data, saida_id),
    local: "Gruta da Ilha",
    publicador_id,
  });

  it("lista as passagens da mais recente para a mais antiga", () => {
    const marcas = [
      passagem("2026-06-21", "s0", "p1"),
      passagem("2026-07-12", "s1", null),
    ];
    expect(historicoDaQuadra("t1", "qa", marcas, publicadores)).toEqual([
      { data: "2026-07-12", local: "Gruta da Ilha", dirigente: null },
      { data: "2026-06-21", local: "Gruta da Ilha", dirigente: "Kleber" },
    ]);
  });

  it("atravessa rodadas: mostra também o que veio antes da linha de corte", () => {
    const marcas = [passagem("2026-01-10", "s0", "p1"), passagem("2026-07-12", "s1", "p1")];
    expect(historicoDaQuadra("t1", "qa", marcas, publicadores)).toHaveLength(2);
  });

  it("ignora as marcas de outra quadra e de outro território", () => {
    const marcas = [
      passagem("2026-07-12", "s1", "p1"),
      { ...marca("qb", "2026-07-12", "s1"), local: null, publicador_id: null },
      {
        ...marca("qa", "2026-07-12", "s1"),
        territorio_id: "t2",
        local: null,
        publicador_id: null,
      },
    ];
    expect(historicoDaQuadra("t1", "qa", marcas, publicadores)).toHaveLength(1);
  });

  it("é vazio para uma quadra que nunca foi feita", () => {
    expect(historicoDaQuadra("t1", "nunca", [], publicadores)).toEqual([]);
  });
});

describe("marcasDaRodada", () => {
  it("conta tudo quando a rodada nunca foi zerada", () => {
    const t = territorio(["a", "b"]);
    const marcas = [marca("a", "2026-01-10"), marca("b", "2026-07-12")];
    expect(marcasDaRodada(t, marcas)).toHaveLength(2);
  });

  it("descarta as marcas anteriores à linha de corte", () => {
    const t = territorio(["a", "b"], "2026-07-01");
    const marcas = [marca("a", "2026-06-28"), marca("b", "2026-07-12")];
    expect(marcasDaRodada(t, marcas).map((m) => m.quadra_id)).toEqual(["b"]);
  });

  it("mantém a marca do próprio dia em que a rodada começou", () => {
    const t = territorio(["a"], "2026-07-12");
    expect(marcasDaRodada(t, [marca("a", "2026-07-12")])).toHaveLength(1);
  });

  it("ignora marcas de outro território", () => {
    const t = territorio(["a"]);
    const deOutro: Marca = { ...marca("a", "2026-07-12"), territorio_id: "t2" };
    expect(marcasDaRodada(t, [deOutro])).toEqual([]);
  });
});

describe("quadrasFeitasDe", () => {
  it("conta uma vez só a quadra trabalhada em duas saídas", () => {
    const t = territorio(["a", "b"]);
    const marcas = [marca("a", "2026-07-12", "s1"), marca("a", "2026-07-15", "s2")];
    expect(quadrasFeitasDe(t, marcas)).toEqual(new Set(["a"]));
  });

  it("descarta a marca órfã de uma quadra que foi apagada do desenho", () => {
    const t = territorio(["a"]);
    const marcas = [marca("a", "2026-07-12"), marca("quadra-apagada", "2026-07-12")];
    expect(quadrasFeitasDe(t, marcas)).toEqual(new Set(["a"]));
  });
});

describe("progressoDe", () => {
  it("mostra as quadras feitas sobre o total do território", () => {
    const t = territorio(["a", "b", "c"]);
    expect(progressoDe(t, [marca("a", "2026-07-12")])).toEqual({
      feitas: 1,
      total: 3,
      emAndamento: 0,
      concluido: false,
    });
  });

  it("é concluído quando todas as quadras foram feitas", () => {
    const t = territorio(["a", "b"]);
    const marcas = [marca("a", "2026-07-12"), marca("b", "2026-07-12")];
    expect(progressoDe(t, marcas)).toEqual({
      feitas: 2,
      total: 2,
      emAndamento: 0,
      concluido: true,
    });
  });

  it("volta a zero depois de a rodada ser zerada, sem apagar as marcas antigas", () => {
    const marcas = [marca("a", "2026-07-12"), marca("b", "2026-07-12")];
    const zerado = territorio(["a", "b"], "2026-07-13");
    expect(progressoDe(zerado, marcas)).toEqual({
      feitas: 0,
      total: 2,
      emAndamento: 0,
      concluido: false,
    });
  });

  it("a quadra órfã não infla o total nem o feito", () => {
    const t = territorio(["a", "b"]);
    const marcas = [marca("a", "2026-07-12"), marca("sumiu", "2026-07-12")];
    expect(progressoDe(t, marcas)).toEqual({
      feitas: 1,
      total: 2,
      emAndamento: 0,
      concluido: false,
    });
  });

  it("território sem limites não tem progresso nem fica concluído", () => {
    const semLimites: EmRodada = { ...territorio([]), limites: null };
    expect(progressoDe(semLimites, [])).toEqual({
      feitas: 0,
      total: 0,
      emAndamento: 0,
      concluido: false,
    });
  });

  it("conta como em andamento o pino de uma quadra ainda não feita", () => {
    const t = territorio(["a", "b", "c"]);
    const marcas = [marca("a", "2026-07-12")];
    const paradas = [parada("b", "2026-07-12")];
    expect(progressoDe(t, marcas, paradas)).toEqual({
      feitas: 1,
      total: 3,
      emAndamento: 1,
      concluido: false,
    });
  });
});

describe("listParadas", () => {
  it("traz data, local e dirigente do pino a partir da saída dele", async () => {
    linhas.ponto_parada = [
      { territorio_id: "t1", quadra_id: "qa", saida_id: "s1", lng: -46.1, lat: -23.2 },
    ];
    linhas.saida = [
      { id: "s1", data: "2026-07-12", local: "Gruta da Ilha", publicador_id: "p1" },
    ];

    expect(await listParadas()).toEqual([
      {
        territorio_id: "t1",
        quadra_id: "qa",
        saida_id: "s1",
        lng: -46.1,
        lat: -23.2,
        data: "2026-07-12",
        local: "Gruta da Ilha",
        publicador_id: "p1",
      },
    ]);
  });

  it("descarta o pino cuja saída sumiu, em vez de inventar uma data", async () => {
    linhas.ponto_parada = [
      { territorio_id: "t1", quadra_id: "qa", saida_id: "sumiu", lng: -46, lat: -23 },
    ];
    linhas.saida = [{ id: "s1", data: "2026-07-12", local: null, publicador_id: null }];

    expect(await listParadas()).toEqual([]);
  });
});

describe("paradasDaRodada", () => {
  it("conta tudo quando a rodada nunca foi zerada", () => {
    const t = territorio(["a", "b"]);
    const paradas = [parada("a", "2026-01-10"), parada("b", "2026-07-12")];
    expect(paradasDaRodada(t, paradas)).toHaveLength(2);
  });

  it("descarta os pinos anteriores à linha de corte", () => {
    const t = territorio(["a", "b"], "2026-07-01");
    const paradas = [parada("a", "2026-06-28"), parada("b", "2026-07-12")];
    expect(paradasDaRodada(t, paradas).map((p) => p.quadra_id)).toEqual(["b"]);
  });

  it("ignora pinos de outro território", () => {
    const t = territorio(["a"]);
    const deOutro: Parada = { ...parada("a", "2026-07-12"), territorio_id: "t2" };
    expect(paradasDaRodada(t, [deOutro])).toEqual([]);
  });
});

describe("paradaAtualDe", () => {
  it("devolve o pino de uma quadra ainda não feita", () => {
    const t = territorio(["a", "b"]);
    const atual = paradaAtualDe(t, [], [parada("b", "2026-07-12")]);
    expect([...atual.keys()]).toEqual(["b"]);
  });

  it("exclui o pino de uma quadra que já está feita (feita vence)", () => {
    const t = territorio(["a", "b"]);
    const atual = paradaAtualDe(t, [marca("b", "2026-07-12")], [parada("b", "2026-07-12")]);
    expect(atual.size).toBe(0);
  });

  it("exclui o pino de uma saída anterior à linha de corte", () => {
    const t = territorio(["a"], "2026-07-01");
    const atual = paradaAtualDe(t, [], [parada("a", "2026-06-28")]);
    expect(atual.size).toBe(0);
  });

  it("exclui o pino de uma quadra que não existe mais no desenho", () => {
    const t = territorio(["a"]);
    const atual = paradaAtualDe(t, [], [parada("sumiu", "2026-07-12")]);
    expect(atual.size).toBe(0);
  });
});

describe("passagensDoMes", () => {
  const julho = { ano: 2026, mes: 7 };

  it("agrupa as marcas por saída, em ordem de data", () => {
    const marcas: Marca[] = [
      { ...marca("qb", "2026-07-19", "s3"), local: "Salão" },
      { ...marca("qa", "2026-07-05", "s1"), local: "Salão" },
      { ...marca("qc", "2026-07-12", "s2"), local: "Praça da Matriz" },
    ];

    expect(passagensDoMes(territorio(["qa", "qb", "qc"]), julho, marcas)).toEqual([
      { saida_id: "s1", data: "2026-07-05", local: "Salão", quadras: 1 },
      { saida_id: "s2", data: "2026-07-12", local: "Praça da Matriz", quadras: 1 },
      { saida_id: "s3", data: "2026-07-19", local: "Salão", quadras: 1 },
    ]);
  });

  it("conta quadras distintas dentro da mesma saída", () => {
    const marcas = [
      marca("qa", "2026-07-05"),
      marca("qb", "2026-07-05"),
      marca("qa", "2026-07-05"),
    ];

    expect(passagensDoMes(territorio(["qa", "qb"]), julho, marcas)).toEqual([
      { saida_id: "s1", data: "2026-07-05", local: null, quadras: 2 },
    ]);
  });

  it("ignora marcas de outro mês", () => {
    const marcas = [marca("qa", "2026-06-28"), marca("qb", "2026-07-05", "s2")];

    expect(passagensDoMes(territorio(["qa", "qb"]), julho, marcas)).toEqual([
      { saida_id: "s2", data: "2026-07-05", local: null, quadras: 1 },
    ]);
  });

  it("ignora marcas de outro território", () => {
    const marcas: Marca[] = [
      { ...marca("qa", "2026-07-05"), territorio_id: "outro" },
    ];

    expect(passagensDoMes(territorio(["qa"]), julho, marcas)).toEqual([]);
  });

  it("ignora marca cuja quadra sumiu do desenho", () => {
    const marcas = [marca("qa", "2026-07-05"), marca("apagada", "2026-07-05")];

    expect(passagensDoMes(territorio(["qa"]), julho, marcas)).toEqual([
      { saida_id: "s1", data: "2026-07-05", local: null, quadras: 1 },
    ]);
  });

  it("devolve lista vazia quando o mês não teve passagem", () => {
    expect(passagensDoMes(territorio(["qa"]), julho, [])).toEqual([]);
  });
});
