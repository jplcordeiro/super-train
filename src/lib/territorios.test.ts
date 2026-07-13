import { describe, it, expect } from "vitest";
import {
  statusTerritorio,
  boundsDeTerritorios,
  quadrasDe,
  limitesDe,
  featureCollectionDe,
} from "./territorios";
import type { Territorio, Designacao } from "./types";

function quadrado(lng: number, lat: number, lado = 1): GeoJSON.Polygon {
  return {
    type: "Polygon",
    coordinates: [
      [
        [lng, lat],
        [lng + lado, lat],
        [lng + lado, lat + lado],
        [lng, lat + lado],
        [lng, lat],
      ],
    ],
  };
}

function multi(...quadrados: GeoJSON.Polygon[]): GeoJSON.MultiPolygon {
  return {
    type: "MultiPolygon",
    coordinates: quadrados.map((q) => q.coordinates),
  };
}

function colecao(
  ...quadras: [string, GeoJSON.Polygon][]
): GeoJSON.FeatureCollection<GeoJSON.Polygon> {
  return {
    type: "FeatureCollection",
    features: quadras.map(([id, geometry]) => ({
      type: "Feature",
      properties: { id },
      geometry,
    })),
  };
}

const base: Territorio = {
  id: "t1",
  numero: "12",
  nome: null,
  limites: null,
  ativo: true,
  progresso_desde: null,
  created_at: "",
};

describe("statusTerritorio", () => {
  it("é 'inativo' quando ativo=false, mesmo sem designação", () => {
    expect(statusTerritorio({ ...base, ativo: false }, undefined)).toBe("inativo");
  });
  it("é 'designado' quando há designação aberta", () => {
    const d: Designacao = {
      id: "d1",
      territorio_id: "t1",
      publicador_id: "p1",
      data_saida: "2026-07-01",
      data_devolucao: null,
      created_at: "",
    };
    expect(statusTerritorio(base, d)).toBe("designado");
  });
  it("é 'disponivel' quando ativo e sem designação aberta", () => {
    expect(statusTerritorio(base, undefined)).toBe("disponivel");
  });
});

describe("quadrasDe", () => {
  it("retorna lista vazia quando não há limites", () => {
    expect(quadrasDe(null)).toEqual([]);
  });

  it("preserva o id de cada quadra de uma FeatureCollection", () => {
    const a = quadrado(-46, -23);
    const b = quadrado(-44, -21);
    expect(quadrasDe(colecao(["qa", a], ["qb", b]))).toEqual([
      { id: "qa", coordinates: a.coordinates },
      { id: "qb", coordinates: b.coordinates },
    ]);
  });

  it("dá id por índice às quadras de um MultiPolygon legado", () => {
    const a = quadrado(-46, -23);
    const b = quadrado(-44, -21);
    expect(quadrasDe(multi(a, b))).toEqual([
      { id: "0", coordinates: a.coordinates },
      { id: "1", coordinates: b.coordinates },
    ]);
  });

  it("trata um Polygon legado como um território de uma quadra só", () => {
    const p = quadrado(-46, -23);
    expect(quadrasDe(p)).toEqual([{ id: "0", coordinates: p.coordinates }]);
  });
});

describe("boundsDeTerritorios", () => {
  it("retorna null quando nenhum território tem limites", () => {
    expect(boundsDeTerritorios([base, { ...base, id: "t2" }])).toBeNull();
  });

  it("envolve todos os polígonos, ignorando os sem limites", () => {
    const ts: Territorio[] = [
      { ...base, id: "a", limites: quadrado(-46, -23) },
      { ...base, id: "b", limites: null },
      { ...base, id: "c", limites: quadrado(-44, -21) },
    ];
    expect(boundsDeTerritorios(ts)).toEqual([
      [-46, -23],
      [-43, -20],
    ]);
  });

  it("com um só território, envolve exatamente o polígono dele", () => {
    const p = quadrado(-46, -23, 2);
    expect(boundsDeTerritorios([{ ...base, limites: p }])).toEqual([
      [-46, -23],
      [-44, -21],
    ]);
  });

  it("envolve todas as quadras de um MultiPolygon", () => {
    const t = { ...base, limites: multi(quadrado(-46, -23), quadrado(-44, -21)) };
    expect(boundsDeTerritorios([t])).toEqual([
      [-46, -23],
      [-43, -20],
    ]);
  });

  it("envolve uma lista mista de Polygon (linha antiga) e MultiPolygon (linha nova)", () => {
    const ts: Territorio[] = [
      { ...base, id: "a", limites: quadrado(-46, -23) },
      { ...base, id: "b", limites: multi(quadrado(-40, -18), quadrado(-38, -16)) },
    ];
    expect(boundsDeTerritorios(ts)).toEqual([
      [-46, -23],
      [-37, -15],
    ]);
  });

  it("envolve todas as quadras de uma FeatureCollection", () => {
    const t = {
      ...base,
      limites: colecao(["qa", quadrado(-46, -23)], ["qb", quadrado(-44, -21)]),
    };
    expect(boundsDeTerritorios([t])).toEqual([
      [-46, -23],
      [-43, -20],
    ]);
  });
});

function feature(p: GeoJSON.Polygon, id?: string): GeoJSON.Feature {
  return { type: "Feature", id, properties: {}, geometry: p };
}

describe("limitesDe", () => {
  it("é null quando não há nenhuma quadra desenhada", () => {
    expect(limitesDe([])).toBeNull();
  });

  it("mantém o id que o draw deu a cada quadra", () => {
    const a = quadrado(-46, -23);
    const b = quadrado(-44, -21);
    const limites = limitesDe([feature(a, "draw-1"), feature(b, "draw-2")]);
    expect(limites?.features.map((f) => f.properties?.id)).toEqual([
      "draw-1",
      "draw-2",
    ]);
    expect(limites?.features[0].geometry).toEqual(a);
  });

  it("dá um id novo à quadra que ainda não tem", () => {
    const limites = limitesDe([feature(quadrado(-46, -23))]);
    expect(limites?.features[0].properties?.id).toEqual(expect.any(String));
    expect(limites?.features[0].properties?.id).not.toBe("");
  });

  it("ignora features que não são polígonos", () => {
    const ponto: GeoJSON.Feature = {
      type: "Feature",
      properties: {},
      geometry: { type: "Point", coordinates: [-46, -23] },
    };
    expect(limitesDe([ponto])).toBeNull();
  });
});

describe("featureCollectionDe", () => {
  it("é uma coleção vazia quando o território não tem limites", () => {
    expect(featureCollectionDe(null)).toEqual({
      type: "FeatureCollection",
      features: [],
    });
  });

  it("devolve uma feature de polígono por quadra, pronta para o draw", () => {
    const a = quadrado(-46, -23);
    const b = quadrado(-44, -21);
    const fc = featureCollectionDe(multi(a, b));
    expect(fc.features).toHaveLength(2);
    expect(fc.features[0].geometry).toEqual(a);
    expect(fc.features[1].geometry).toEqual(b);
  });

  it("aceita um Polygon antigo e devolve uma feature só", () => {
    const a = quadrado(-46, -23);
    expect(featureCollectionDe(a).features).toHaveLength(1);
  });

  it("leva o id da quadra para a feature, para o draw e o mapa o preservarem", () => {
    const fc = featureCollectionDe(colecao(["qa", quadrado(-46, -23)]));
    expect(fc.features[0].id).toBe("qa");
    expect(fc.features[0].properties?.id).toBe("qa");
  });
});
