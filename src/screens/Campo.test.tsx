import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";
import { Campo } from "./Campo";

const bounds = vi.fn();
const estados = vi.fn();

vi.mock("../map/BaseMap", () => ({
  BaseMap: (props: { bounds?: unknown; children?: React.ReactNode }) => {
    bounds(props.bounds);
    return <div data-testid="map">{props.children}</div>;
  },
}));
vi.mock("../map/TerritorioPolygon", () => ({
  TerritorioPolygon: (props: { estados?: unknown }) => {
    estados(props.estados);
    return <div data-testid="poly" />;
  },
}));
vi.mock("../lib/quadras", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/quadras")>()),
  listMarcas: vi.fn().mockResolvedValue([
    {
      saida_id: "s1",
      territorio_id: "t1",
      quadra_id: "quadra-a",
      data: "2026-07-12",
    },
  ]),
}));
vi.mock("../lib/territorios", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/territorios")>()),
  listTerritorios: vi.fn().mockResolvedValue([
    {
      id: "t1",
      numero: "12",
      nome: "Centro",
      limites: {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: { id: "quadra-a" },
            geometry: {
              type: "Polygon",
              coordinates: [
                [
                  [-46, -23],
                  [-45, -23],
                  [-45, -22],
                  [-46, -22],
                  [-46, -23],
                ],
              ],
            },
          },
          {
            type: "Feature",
            properties: { id: "quadra-b" },
            geometry: {
              type: "Polygon",
              coordinates: [
                [
                  [-44, -21],
                  [-43, -21],
                  [-43, -20],
                  [-44, -20],
                  [-44, -21],
                ],
              ],
            },
          },
        ],
      },
      ativo: true,
      progresso_desde: null,
      created_at: "",
    },
  ]),
}));

describe("Campo", () => {
  it("renderiza o polígono do território pedido", async () => {
    render(
      <MemoryRouter initialEntries={["/campo/t1"]}>
        <Routes>
          <Route path="/campo/:id" element={<Campo />} />
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByTestId("poly")).toBeInTheDocument());
  });

  it("enquadra o mapa em todas as quadras do território", async () => {
    render(
      <MemoryRouter initialEntries={["/campo/t1"]}>
        <Routes>
          <Route path="/campo/:id" element={<Campo />} />
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByTestId("poly")).toBeInTheDocument());
    expect(bounds).toHaveBeenLastCalledWith([
      [-46, -23],
      [-43, -20],
    ]);
  });

  it("pinta as quadras já feitas na rodada e deixa as outras como faltantes", async () => {
    render(
      <MemoryRouter initialEntries={["/campo/t1"]}>
        <Routes>
          <Route path="/campo/:id" element={<Campo />} />
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByTestId("poly")).toBeInTheDocument());
    expect(estados).toHaveBeenLastCalledWith({ "quadra-a": "feita" });
  });
});
