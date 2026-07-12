import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { SaidaForm } from "./SaidaForm";

const criarSaidas = vi.fn().mockResolvedValue(undefined);

vi.mock("../lib/saidas", async (orig) => {
  const actual = await (orig() as Promise<Record<string, unknown>>);
  return { ...actual, criarSaidas: (...args: unknown[]) => criarSaidas(...args) };
});

function montar() {
  render(
    <SaidaForm
      data="2026-07-12"
      territorios={[]}
      publicadores={[]}
      locais={[]}
      onPronto={() => {}}
      onCancelar={() => {}}
    />,
  );
  return screen.getByLabelText("Data");
}

describe("SaidaForm: campo data", () => {
  it("mostra a data do dia clicado no formato brasileiro", () => {
    expect(montar()).toHaveValue("12/07/2026");
  });

  it("insere as barras enquanto se digita", () => {
    const campo = montar();
    fireEvent.change(campo, { target: { value: "25" } });
    expect(campo).toHaveValue("25");
    fireEvent.change(campo, { target: { value: "2512" } });
    expect(campo).toHaveValue("25/12");
    fireEvent.change(campo, { target: { value: "25/122026" } });
    expect(campo).toHaveValue("25/12/2026");
  });

  it("salva a data digitada em ISO", async () => {
    const campo = montar();
    fireEvent.change(campo, { target: { value: "25122026" } });
    fireEvent.click(screen.getByRole("button", { name: "Criar saída" }));
    await waitFor(() =>
      expect(criarSaidas).toHaveBeenCalledWith(
        expect.objectContaining({ data: "2026-12-25" }),
        ["2026-12-25"],
      ),
    );
  });
});
