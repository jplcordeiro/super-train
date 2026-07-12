import { describe, it, expect } from "vitest";
import { statusTerritorio, boundsDeTerritorios, quadrasDe } from "./territorios";
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

const base: Territorio = {
  id: "t1",
  numero: "12",
  nome: null,
  limites: null,
  ativo: true,
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

  it("trata um Polygon como um território de uma quadra só", () => {
    const p = quadrado(-46, -23);
    expect(quadrasDe(p)).toEqual([p.coordinates]);
  });

  it("devolve uma entrada por quadra de um MultiPolygon", () => {
    const a = quadrado(-46, -23);
    const b = quadrado(-44, -21);
    expect(quadrasDe(multi(a, b))).toEqual([a.coordinates, b.coordinates]);
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
});
