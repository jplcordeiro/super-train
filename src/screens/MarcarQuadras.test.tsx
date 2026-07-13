import { render, screen, waitFor, act } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MarcarQuadras } from "./MarcarQuadras";
import type { EstadoQuadra } from "../map/TerritorioPolygon";

const props: {
  estados?: Record<string, EstadoQuadra>;
  onQuadraClick?: (id: string) => void;
} = {};

vi.mock("../map/BaseMap", () => ({
  BaseMap: (p: { children?: React.ReactNode }) => (
    <div data-testid="map">{p.children}</div>
  ),
}));
vi.mock("../map/TerritorioPolygon", () => ({
  TerritorioPolygon: (p: {
    estados?: Record<string, EstadoQuadra>;
    onQuadraClick?: (id: string) => void;
  }) => {
    props.estados = p.estados;
    props.onQuadraClick = p.onQuadraClick;
    return <div data-testid="poly" />;
  },
}));

vi.mock("../lib/territorios", async (importOriginal) => {
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
  return {
    ...(await importOriginal<typeof import("../lib/territorios")>()),
    listTerritorios: vi.fn().mockResolvedValue([
      {
        id: "t1",
        numero: "6",
        nome: "Centro",
        limites: {
          type: "FeatureCollection",
          features: [quadra("qa", -46), quadra("qb", -44), quadra("qc", -42)],
        },
        ativo: true,
        progresso_desde: null,
        created_at: "",
      },
    ]),
  };
});

vi.mock("../lib/saidas", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/saidas")>()),
  buscarSaida: vi.fn().mockResolvedValue({
    id: "s1",
    data: "2026-07-12",
    periodo: "manha",
    local: "Gruta da Ilha",
    publicador_id: null,
    observacao: null,
    created_at: "",
    territorio_ids: ["t1"],
  }),
}));

vi.mock("../lib/quadras", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/quadras")>()),
  listMarcas: vi.fn(),
  marcarQuadra: vi.fn().mockResolvedValue(undefined),
  desmarcarQuadra: vi.fn().mockResolvedValue(undefined),
}));

const toastInfo = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    info: (...args: unknown[]) => toastInfo(...args),
    success: vi.fn(),
    error: vi.fn(),
  },
}));

async function renderTela() {
  render(
    <MemoryRouter initialEntries={["/saida/s1/territorio/t1"]}>
      <Routes>
        <Route
          path="/saida/:saidaId/territorio/:territorioId"
          element={<MarcarQuadras />}
        />
      </Routes>
    </MemoryRouter>,
  );
  await waitFor(() => expect(screen.getByTestId("poly")).toBeInTheDocument());
}

describe("MarcarQuadras", () => {
  beforeEach(async () => {
    const { listMarcas, marcarQuadra, desmarcarQuadra } = await import("../lib/quadras");
    vi.mocked(marcarQuadra).mockClear();
    vi.mocked(desmarcarQuadra).mockClear();
    vi.mocked(listMarcas).mockResolvedValue([
      {
        saida_id: "s1",
        territorio_id: "t1",
        quadra_id: "qa",
        data: "2026-07-12",
        local: null,
        publicador_id: null,
      },
      {
        saida_id: "s0",
        territorio_id: "t1",
        quadra_id: "qb",
        data: "2026-07-05",
        local: null,
        publicador_id: null,
      },
    ]);
    toastInfo.mockClear();
  });

  it("mostra a data da saída que está sendo marcada, não a de hoje", async () => {
    await renderTela();
    expect(screen.getByText(/12\/07\/2026/)).toBeInTheDocument();
    expect(screen.getByText(/território nº 6/i)).toBeInTheDocument();
  });

  it("separa o que esta saída fez do que outra saída da rodada já tinha feito", async () => {
    await renderTela();
    expect(props.estados).toEqual({ qa: "feita", qb: "outra" });
  });

  it("marca a quadra que faltava", async () => {
    const { marcarQuadra } = await import("../lib/quadras");
    await renderTela();

    await act(async () => props.onQuadraClick?.("qc"));

    expect(marcarQuadra).toHaveBeenCalledWith("s1", "t1", "qc");
    await waitFor(() => expect(props.estados?.qc).toBe("feita"));
  });

  it("desmarca a quadra que esta saída tinha marcado", async () => {
    const { desmarcarQuadra } = await import("../lib/quadras");
    await renderTela();

    await act(async () => props.onQuadraClick?.("qa"));

    expect(desmarcarQuadra).toHaveBeenCalledWith("s1", "t1", "qa");
    await waitFor(() => expect(props.estados?.qa).toBeUndefined());
  });

  it("não mexe na quadra feita em outra saída: só explica de quando ela é", async () => {
    const { marcarQuadra, desmarcarQuadra } = await import("../lib/quadras");
    await renderTela();

    await act(async () => props.onQuadraClick?.("qb"));

    expect(marcarQuadra).not.toHaveBeenCalled();
    expect(desmarcarQuadra).not.toHaveBeenCalled();
    expect(toastInfo).toHaveBeenCalledWith(
      expect.stringContaining("05/07/2026"),
    );
    expect(props.estados?.qb).toBe("outra");
  });

  it("conta as quadras feitas na rodada", async () => {
    await renderTela();
    expect(screen.getByText(/2 de 3 quadras/i)).toBeInTheDocument();
  });
});
