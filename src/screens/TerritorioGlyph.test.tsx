import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { TerritorioGlyph } from "./TerritorioGlyph";

function quadrado(lng: number, lat: number, lado = 1): GeoJSON.Polygon {
  return {
    type: "Polygon",
    coordinates: [
      [
        [lng, lat],
        [lng + lado, lat],
        [lng + lado, lat + lado],
        [lng, lat + lado],
        [lng, lat],
      ],
    ],
  };
}

describe("TerritorioGlyph", () => {
  it("mostra o placeholder tracejado quando não há limites", () => {
    const { container } = render(<TerritorioGlyph limites={null} />);
    expect(container.querySelector("path")).toBeNull();
    expect(container.querySelector("rect")).toBeInTheDocument();
  });

  it("desenha um subpath para um território de uma quadra", () => {
    const { container } = render(<TerritorioGlyph limites={quadrado(-46, -23)} />);
    const d = container.querySelector("path")?.getAttribute("d") ?? "";
    expect(d.match(/M/g)).toHaveLength(1);
  });

  it("desenha um subpath por quadra de um MultiPolygon", () => {
    const limites: GeoJSON.MultiPolygon = {
      type: "MultiPolygon",
      coordinates: [
        quadrado(-46, -23).coordinates,
        quadrado(-44, -21).coordinates,
        quadrado(-42, -19).coordinates,
      ],
    };
    const { container } = render(<TerritorioGlyph limites={limites} />);
    const d = container.querySelector("path")?.getAttribute("d") ?? "";
    expect(d.match(/M/g)).toHaveLength(3);
    expect(d.match(/Z/g)).toHaveLength(3);
  });
});
