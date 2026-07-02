import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { Cadastro } from "./Cadastro";

vi.mock("../map/BaseMap", () => ({ BaseMap: () => <div data-testid="map" /> }));
vi.mock("../lib/territorios", () => ({ criarTerritorio: vi.fn() }));

describe("Cadastro", () => {
  it("desabilita salvar sem número e sem polígono", () => {
    render(<Cadastro />);
    expect(screen.getByRole("button", { name: /salvar/i })).toBeDisabled();
  });
});
