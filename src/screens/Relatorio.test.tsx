import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Relatorio } from "./Relatorio";
import type { Marca } from "../lib/quadras";
import type { Territorio } from "../lib/types";

const quadra = (id: string, lng: number): GeoJSON.Feature<GeoJSON.Polygon> => ({
  type: "Feature",
  properties: { id },
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [lng, -23],
        [lng + 1, -23],
        [lng + 1, -22],
        [lng, -23],
      ],
    ],
  },
});

const territorio: Territorio = {
  id: "t1",
  numero: "12",
  nome: "Vila Nova",
  limites: {
    type: "FeatureCollection",
    features: [quadra("qa", -46), quadra("qb", -44)],
  },
  ativo: true,
  created_at: "",
};

vi.mock("../lib/territorios", async (orig) => {
  const actual = await (orig() as Promise<Record<string, unknown>>);
  return { ...actual, listTerritorios: vi.fn() };
});
vi.mock("../lib/quadras", async (orig) => {
  const actual = await (orig() as Promise<Record<string, unknown>>);
  return { ...actual, listMarcas: vi.fn() };
});
vi.mock("../lib/rodadas", async (orig) => {
  const actual = await (orig() as Promise<Record<string, unknown>>);
  return { ...actual, listRodadas: vi.fn().mockResolvedValue([]) };
});

async function montar(marcas: Marca[], t: Territorio = territorio) {
  const { listTerritorios } = await import("../lib/territorios");
  const { listMarcas } = await import("../lib/quadras");
  vi.mocked(listTerritorios).mockResolvedValue([t]);
  vi.mocked(listMarcas).mockResolvedValue(marcas);
  render(<Relatorio />);
  await waitFor(() =>
    expect(screen.queryByRole("status")).not.toBeInTheDocument(),
  );
}

describe("Relatorio", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.setSystemTime(new Date(2026, 6, 20));
  });

  it("lista as passagens do mês dentro do card do território", async () => {
    await montar([
      {
        saida_id: "s1",
        territorio_id: "t1",
        quadra_id: "qa",
        data: "2026-07-05",
        local: "Salão",
        publicador_id: null,
      },
      {
        saida_id: "s2",
        territorio_id: "t1",
        quadra_id: "qb",
        data: "2026-07-12",
        local: null,
        publicador_id: null,
      },
    ]);

    expect(screen.getByText("2 saídas neste mês")).toBeInTheDocument();
    expect(screen.getByText("05/07/2026").closest("li")).toHaveTextContent(
      "05/07/2026 · Salão · 1 quadra",
    );
    expect(screen.getByText("12/07/2026").closest("li")).toHaveTextContent(
      "12/07/2026 · Sem ponto de encontro · 1 quadra",
    );
  });

  it("diz 1 saída no singular", async () => {
    await montar([
      {
        saida_id: "s1",
        territorio_id: "t1",
        quadra_id: "qa",
        data: "2026-07-05",
        local: "Salão",
        publicador_id: null,
      },
    ]);

    expect(screen.getByText("1 saída neste mês")).toBeInTheDocument();
  });

  it("soma as quadras da mesma saída numa linha só", async () => {
    await montar([
      {
        saida_id: "s1",
        territorio_id: "t1",
        quadra_id: "qa",
        data: "2026-07-05",
        local: "Salão",
        publicador_id: null,
      },
      {
        saida_id: "s1",
        territorio_id: "t1",
        quadra_id: "qb",
        data: "2026-07-05",
        local: "Salão",
        publicador_id: null,
      },
    ]);

    expect(screen.getByText("05/07/2026").closest("li")).toHaveTextContent(
      "2 quadras",
    );
  });
});
