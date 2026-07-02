import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";
import { Campo } from "./Campo";

vi.mock("../map/BaseMap", () => ({
  BaseMap: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="map">{children}</div>
  ),
}));
vi.mock("../map/TerritorioPolygon", () => ({
  TerritorioPolygon: () => <div data-testid="poly" />,
}));
vi.mock("../lib/territorios", () => ({
  listTerritorios: vi.fn().mockResolvedValue([
    {
      id: "t1",
      numero: "12",
      nome: "Centro",
      limites: { type: "Polygon", coordinates: [] },
      ativo: true,
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
});
