import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
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
});
