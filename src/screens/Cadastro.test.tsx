import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";
import { Cadastro } from "./Cadastro";

vi.mock("../map/BaseMap", () => ({ BaseMap: () => <div data-testid="map" /> }));
vi.mock("../lib/territorios", () => ({ criarTerritorio: vi.fn() }));

describe("Cadastro", () => {
  it("desabilita salvar sem número e sem polígono", () => {
    render(
      <MemoryRouter>
        <Cadastro />
      </MemoryRouter>,
    );
    expect(screen.getByRole("button", { name: /salvar/i })).toBeDisabled();
  });
});
