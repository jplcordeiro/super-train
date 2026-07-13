import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";
import { Cadastro } from "./Cadastro";

vi.mock("../map/BaseMap", () => ({ BaseMap: () => <div data-testid="map" /> }));
vi.mock("../lib/territorios", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/territorios")>()),
  criarTerritorio: vi.fn(),
  atualizarTerritorio: vi.fn(),
  listTerritorios: vi.fn().mockResolvedValue([]),
}));

function renderCadastro(rota = "/cadastro") {
  const router = createMemoryRouter(
    [
      { path: "/", element: <div>Gestão</div> },
      { path: "/cadastro", element: <Cadastro /> },
      { path: "/cadastro/:id", element: <Cadastro /> },
    ],
    { initialEntries: ["/", rota], initialIndex: 1 },
  );
  render(<RouterProvider router={router} />);
  return router;
}

const limites: GeoJSON.FeatureCollection<GeoJSON.Polygon> = {
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
  ],
};

async function renderEdicao() {
  const { listTerritorios } = await import("../lib/territorios");
  vi.mocked(listTerritorios).mockResolvedValue([
    {
      id: "t1",
      numero: "12",
      nome: "Centro",
      limites,
      ativo: true,
      progresso_desde: null,
      created_at: "",
    },
  ]);
  renderCadastro("/cadastro/t1");
  await screen.findByDisplayValue("12");
}

describe("Cadastro", () => {
  it("desabilita salvar sem número e sem quadra", () => {
    renderCadastro();
    expect(screen.getByRole("button", { name: /salvar/i })).toBeDisabled();
  });

  it("pede as quadras enquanto nada foi desenhado", () => {
    renderCadastro();
    expect(screen.getByText(/desenhe as quadras/i)).toBeInTheDocument();
  });

  it("no modo edição, carrega o território e salva com atualizarTerritorio", async () => {
    const { atualizarTerritorio } = await import("../lib/territorios");
    await renderEdicao();

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

  it("sai direto quando nada foi alterado", async () => {
    renderCadastro();
    fireEvent.click(screen.getByRole("link", { name: /territórios/i }));

    expect(await screen.findByText("Gestão")).toBeInTheDocument();
    expect(screen.queryByText(/sair sem salvar\?/i)).not.toBeInTheDocument();
  });

  it("avisa ao voltar com alterações pendentes e permite continuar editando", async () => {
    renderCadastro();
    fireEvent.change(screen.getByLabelText(/número do território/i), {
      target: { value: "7" },
    });
    fireEvent.click(screen.getByRole("link", { name: /territórios/i }));

    expect(await screen.findByText(/sair sem salvar\?/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /continuar editando/i }));

    await waitFor(() =>
      expect(screen.queryByText(/sair sem salvar\?/i)).not.toBeInTheDocument(),
    );
    expect(screen.getByLabelText(/número do território/i)).toHaveValue("7");
    expect(screen.queryByText("Gestão")).not.toBeInTheDocument();
  });

  it("descarta as alterações quando o usuário confirma a saída", async () => {
    renderCadastro();
    fireEvent.change(screen.getByLabelText(/número do território/i), {
      target: { value: "7" },
    });
    fireEvent.click(screen.getByRole("link", { name: /territórios/i }));

    fireEvent.click(
      await screen.findByRole("button", { name: /sair sem salvar/i }),
    );

    expect(await screen.findByText("Gestão")).toBeInTheDocument();
  });

  it("na edição, avisa apenas quando o território foi mesmo alterado", async () => {
    await renderEdicao();

    fireEvent.click(screen.getByRole("link", { name: /territórios/i }));
    expect(await screen.findByText("Gestão")).toBeInTheDocument();
  });

  it("na edição, avisa ao voltar depois de mudar um campo", async () => {
    await renderEdicao();

    fireEvent.change(screen.getByLabelText(/nome do território/i), {
      target: { value: "Centro Novo" },
    });
    fireEvent.click(screen.getByRole("link", { name: /territórios/i }));

    expect(await screen.findByText(/sair sem salvar\?/i)).toBeInTheDocument();
  });

  it("avisa também no voltar do navegador", async () => {
    const router = renderCadastro();
    fireEvent.change(screen.getByLabelText(/número do território/i), {
      target: { value: "7" },
    });

    router.navigate(-1);

    expect(await screen.findByText(/sair sem salvar\?/i)).toBeInTheDocument();
    expect(screen.queryByText("Gestão")).not.toBeInTheDocument();
  });

  it("na edição, salvar navega sem disparar o aviso", async () => {
    await renderEdicao();

    fireEvent.change(screen.getByLabelText(/nome do território/i), {
      target: { value: "Centro Novo" },
    });
    fireEvent.click(screen.getByRole("button", { name: /salvar alterações/i }));

    expect(await screen.findByText("Gestão")).toBeInTheDocument();
    expect(screen.queryByText(/sair sem salvar\?/i)).not.toBeInTheDocument();
  });
});
