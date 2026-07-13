import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";
import { Calendario } from "./Calendario";

const { hojeISO } = vi.hoisted(() => {
  const hoje = new Date();
  return {
    hojeISO: `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`,
  };
});

vi.mock("../lib/saidas", async (orig) => {
  const actual = await (orig() as Promise<Record<string, unknown>>);
  return {
    ...actual,
    listSaidas: vi.fn().mockResolvedValue([
      {
        id: "s1",
        data: hojeISO,
        periodo: "manha",
        local: "Gruta da Ilha",
        publicador_id: "p1",
        observacao: null,
        created_at: "2026-06-01T00:00:00Z",
        territorio_ids: ["t1"],
      },
      {
        id: "s2",
        data: hojeISO,
        periodo: "tarde",
        local: "Campinho Rua A",
        publicador_id: null,
        observacao: "faltante",
        created_at: "2026-06-02T00:00:00Z",
        territorio_ids: [],
      },
    ]),
    notaDoMes: vi.fn().mockResolvedValue("Todos os domingos temos duas saídas."),
    salvarNota: vi.fn(),
    excluirSaida: vi.fn(),
  };
});
vi.mock("../lib/territorios", async (orig) => {
  const actual = await (orig() as Promise<Record<string, unknown>>);
  return {
    ...actual,
    listTerritorios: vi.fn().mockResolvedValue([
      { id: "t1", numero: "6", nome: "Centro", limites: null, ativo: true, progresso_desde: null, created_at: "" },
    ]),
  };
});
vi.mock("../lib/publicadores", () => ({
  listPublicadores: vi
    .fn()
    .mockResolvedValue([{ id: "p1", nome: "Kleber", telefone: null, created_at: "" }]),
}));

function montar() {
  return render(
    <MemoryRouter>
      <Calendario />
    </MemoryRouter>,
  );
}

describe("Calendario", () => {
  it("mostra o ponto de encontro, o dirigente e o território da saída", async () => {
    montar();
    await waitFor(() =>
      expect(screen.getAllByText("Gruta da Ilha").length).toBeGreaterThan(0),
    );
    expect(screen.getAllByText("Kleber").length).toBeGreaterThan(0);
    expect(
      screen.getAllByRole("link", { name: /mapa do território 6/i }).length,
    ).toBeGreaterThan(0);
  });

  it("marca a saída sem dirigente como a definir", async () => {
    montar();
    await waitFor(() =>
      expect(screen.getAllByText(/a definir/i).length).toBeGreaterThan(0),
    );
  });

  it("marca a saída da tarde", async () => {
    montar();
    await waitFor(() => expect(screen.getAllByText("tarde").length).toBeGreaterThan(0));
  });

  it("carrega o aviso do mês", async () => {
    montar();
    await waitFor(() =>
      expect(screen.getByDisplayValue("Todos os domingos temos duas saídas.")).toBeInTheDocument(),
    );
  });
});
