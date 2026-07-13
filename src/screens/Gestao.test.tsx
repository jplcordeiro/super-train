import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Gestao } from "./Gestao";
import type { Marca } from "../lib/quadras";
import type { Territorio } from "../lib/types";

const { quadra } = vi.hoisted(() => ({
  quadra: (id: string, lng: number): GeoJSON.Feature<GeoJSON.Polygon> => ({
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
  }),
}));

const territorio: Territorio = {
  id: "t1",
  numero: "12",
  nome: "Centro",
  limites: {
    type: "FeatureCollection",
    features: [quadra("qa", -46), quadra("qb", -44)],
  },
  ativo: true,
  progresso_desde: null,
  created_at: "",
};

vi.mock("../lib/territorios", async (orig) => {
  const actual = await (orig() as Promise<Record<string, unknown>>);
  return {
    ...actual,
    listTerritorios: vi.fn(),
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
  devolver: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../lib/quadras", async (orig) => {
  const actual = await (orig() as Promise<Record<string, unknown>>);
  return {
    ...actual,
    listMarcas: vi.fn().mockResolvedValue([]),
    iniciarNovaRodada: vi.fn().mockResolvedValue(undefined),
  };
});

const marca = (quadra_id: string): Marca => ({
  saida_id: "s1",
  territorio_id: "t1",
  quadra_id,
  data: "2026-07-12",
});

async function montar(marcas: Marca[] = [], t: Territorio = territorio) {
  const { listTerritorios } = await import("../lib/territorios");
  const { listMarcas } = await import("../lib/quadras");
  vi.mocked(listTerritorios).mockResolvedValue([t]);
  vi.mocked(listMarcas).mockResolvedValue(marcas);
  render(
    <MemoryRouter>
      <Gestao />
    </MemoryRouter>,
  );
  await waitFor(() => expect(screen.getByText("Centro")).toBeInTheDocument());
}

describe("Gestao", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lista o território cadastrado", async () => {
    await montar();
    expect(
      screen.getByRole("link", { name: "Abrir mapa do território Nº 12" }),
    ).toBeInTheDocument();
  });

  it("mostra quantas quadras já foram feitas na rodada", async () => {
    await montar([marca("qa")]);
    expect(screen.getByText("1/2 quadras")).toBeInTheDocument();
  });

  it("mostra o território como concluído quando todas as quadras foram feitas", async () => {
    await montar([marca("qa"), marca("qb")]);
    expect(screen.getByText(/concluído/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /começar nova rodada/i }),
    ).toBeInTheDocument();
  });

  it("não oferece nova rodada enquanto faltam quadras", async () => {
    await montar([marca("qa")]);
    expect(
      screen.queryByRole("button", { name: /começar nova rodada/i }),
    ).not.toBeInTheDocument();
  });

  it("começar nova rodada move a linha de corte do território", async () => {
    const { iniciarNovaRodada } = await import("../lib/quadras");
    await montar([marca("qa"), marca("qb")]);

    fireEvent.click(screen.getByRole("button", { name: /começar nova rodada/i }));

    await waitFor(() => expect(iniciarNovaRodada).toHaveBeenCalledWith("t1"));
  });

  it("devolver um território concluído oferece começar a nova rodada", async () => {
    const { designacoesAbertas } = await import("../lib/designacoes");
    const { iniciarNovaRodada } = await import("../lib/quadras");
    vi.mocked(designacoesAbertas).mockResolvedValue([
      {
        id: "d1",
        territorio_id: "t1",
        publicador_id: "p1",
        data_saida: "2026-07-01",
        data_devolucao: null,
        created_at: "",
      },
    ]);
    await montar([marca("qa"), marca("qb")]);

    fireEvent.click(screen.getByRole("button", { name: /devolver/i }));

    expect(await screen.findByText(/concluído\. começar nova rodada\?/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /agora não/i }));
    await waitFor(() =>
      expect(screen.queryByText(/começar nova rodada\?/i)).not.toBeInTheDocument(),
    );
    expect(iniciarNovaRodada).not.toHaveBeenCalled();
  });

  it("depois de zerada, a rodada volta a zero sem perder as marcas antigas", async () => {
    const zerado = { ...territorio, progresso_desde: "2026-07-13" };
    await montar([marca("qa"), marca("qb")], zerado);

    expect(screen.getByText("0/2 quadras")).toBeInTheDocument();
    expect(screen.queryByText(/concluído/i)).not.toBeInTheDocument();
  });
});
