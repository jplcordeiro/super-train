import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { HistoricoQuadra } from "./HistoricoQuadra";

describe("HistoricoQuadra", () => {
  it("conta quantas vezes a quadra foi feita", () => {
    render(
      <HistoricoQuadra
        passagens={[
          { data: "2026-07-12", local: "Gruta da Ilha", dirigente: "Kleber" },
          { data: "2026-06-21", local: "Casa da Zezé", dirigente: "Ana" },
        ]}
      />,
    );
    expect(screen.getByText("Feita 2 vezes")).toBeInTheDocument();
  });

  it("mostra data, ponto de encontro e dirigente de cada passagem", () => {
    render(
      <HistoricoQuadra
        passagens={[{ data: "2026-07-12", local: "Gruta da Ilha", dirigente: "Kleber" }]}
      />,
    );
    expect(screen.getByText("Feita 1 vez")).toBeInTheDocument();
    expect(screen.getByText("12/07/2026")).toBeInTheDocument();
    expect(screen.getByText(/Gruta da Ilha · Kleber/)).toBeInTheDocument();
  });

  it("não inventa nome quando a saída não tinha dirigente nem ponto de encontro", () => {
    render(
      <HistoricoQuadra passagens={[{ data: "2026-07-12", local: null, dirigente: null }]} />,
    );
    expect(
      screen.getByText(/sem ponto de encontro · dirigente a definir/),
    ).toBeInTheDocument();
  });
});
