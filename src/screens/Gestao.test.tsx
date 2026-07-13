import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";
import { Gestao } from "./Gestao";

vi.mock("../lib/territorios", async (orig) => {
  const actual = await (orig() as Promise<Record<string, unknown>>);
  return {
    ...actual,
    listTerritorios: vi.fn().mockResolvedValue([
      { id: "t1", numero: "12", nome: "Centro", limites: null, ativo: true, created_at: "" },
    ]),
    setAtivo: vi.fn(),
  };
});
vi.mock("../lib/publicadores", () => ({
  listPublicadores: vi.fn().mockResolvedValue([]),
  criarPublicador: vi.fn(),
  excluirPublicador: vi.fn(),
}));
vi.mock("../lib/designacoes", () => ({
  designacoesAbertas: vi.fn().mockResolvedValue([]),
  designar: vi.fn(),
  devolver: vi.fn(),
}));

describe("Gestao", () => {
  it("lista o território cadastrado", async () => {
    render(
      <MemoryRouter>
        <Gestao />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText(/12/)).toBeInTheDocument());
    expect(screen.getByText("Centro")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Abrir mapa do território Nº 12" }),
    ).toBeInTheDocument();
  });
});
