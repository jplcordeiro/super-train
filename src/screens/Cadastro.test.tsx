import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";
import { Cadastro } from "./Cadastro";

vi.mock("../map/BaseMap", () => ({ BaseMap: () => <div data-testid="map" /> }));
vi.mock("../lib/territorios", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/territorios")>()),
  criarTerritorio: vi.fn(),
  atualizarTerritorio: vi.fn(),
  listTerritorios: vi.fn().mockResolvedValue([]),
}));

describe("Cadastro", () => {
  it("desabilita salvar sem número e sem quadra", () => {
    render(
      <MemoryRouter>
        <Cadastro />
      </MemoryRouter>,
    );
    expect(screen.getByRole("button", { name: /salvar/i })).toBeDisabled();
  });

  it("pede as quadras enquanto nada foi desenhado", () => {
    render(
      <MemoryRouter>
        <Cadastro />
      </MemoryRouter>,
    );
    expect(screen.getByText(/desenhe as quadras/i)).toBeInTheDocument();
  });

  it("no modo edição, carrega o território e salva com atualizarTerritorio", async () => {
    const { listTerritorios, atualizarTerritorio } = await import("../lib/territorios");
    const limites: GeoJSON.MultiPolygon = {
      type: "MultiPolygon",
      coordinates: [
        [
          [
            [-46, -23],
            [-45, -23],
            [-45, -22],
            [-46, -22],
            [-46, -23],
          ],
        ],
      ],
    };
    vi.mocked(listTerritorios).mockResolvedValue([
      { id: "t1", numero: "12", nome: "Centro", limites, ativo: true, created_at: "" },
    ]);

    render(
      <MemoryRouter initialEntries={["/cadastro/t1"]}>
        <Routes>
          <Route path="/cadastro/:id" element={<Cadastro />} />
        </Routes>
      </MemoryRouter>,
    );

    const numero = await screen.findByLabelText(/número do território/i);
    expect(numero).toHaveValue("12");

    const salvar = await screen.findByRole("button", { name: /salvar alterações/i });
    expect(salvar).toBeEnabled();
    fireEvent.click(salvar);

    await waitFor(() =>
      expect(atualizarTerritorio).toHaveBeenCalledWith("t1", {
        numero: "12",
        nome: "Centro",
        limites,
      }),
    );
  });
});
