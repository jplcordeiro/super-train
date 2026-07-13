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

function colecao(
  ...quadras: [string, GeoJSON.Polygon][]
): GeoJSON.FeatureCollection<GeoJSON.Polygon> {
  return {
    type: "FeatureCollection",
    features: quadras.map(([id, geometry]) => ({
      type: "Feature",
      properties: { id },
      geometry,
    })),
  };
}

describe("TerritorioGlyph", () => {
  it("mostra o placeholder tracejado quando não há limites", () => {
    const { container } = render(<TerritorioGlyph limites={null} />);
    expect(container.querySelector("path")).toBeNull();
    expect(container.querySelector("rect")).toBeInTheDocument();
  });

  it("desenha um path para um território de uma quadra", () => {
    const { container } = render(<TerritorioGlyph limites={quadrado(-46, -23)} />);
    expect(container.querySelectorAll("path")).toHaveLength(1);
  });

  it("desenha um path por quadra de um MultiPolygon", () => {
    const limites: GeoJSON.MultiPolygon = {
      type: "MultiPolygon",
      coordinates: [
        quadrado(-46, -23).coordinates,
        quadrado(-44, -21).coordinates,
        quadrado(-42, -19).coordinates,
      ],
    };
    const { container } = render(<TerritorioGlyph limites={limites} />);
    expect(container.querySelectorAll("path")).toHaveLength(3);
  });

  it("inverte o eixo Y: a maior latitude produz o menor y no SVG", () => {
    const limites: GeoJSON.Polygon = {
      type: "Polygon",
      coordinates: [
        [
          [-46, -23],
          [-45, -23],
          [-45, -19],
          [-46, -19],
          [-46, -23],
        ],
      ],
    };
    const { container } = render(<TerritorioGlyph limites={limites} />);
    const d = container.querySelector("path")?.getAttribute("d") ?? "";
    expect(d).toBe("M41.0,86.0L59.0,86.0L59.0,14.0L41.0,14.0L41.0,86.0Z");
  });

  it("normaliza a bounding box pela união de todas as quadras, com escala compartilhada", () => {
    const limites: GeoJSON.MultiPolygon = {
      type: "MultiPolygon",
      coordinates: [quadrado(0, 0, 10).coordinates, quadrado(10, 0, 10).coordinates],
    };
    const { container } = render(<TerritorioGlyph limites={limites} />);
    const ds = [...container.querySelectorAll("path")].map((p) => p.getAttribute("d"));
    expect(ds).toEqual([
      "M14.0,68.0L50.0,68.0L50.0,32.0L14.0,32.0L14.0,68.0Z",
      "M50.0,68.0L86.0,68.0L86.0,32.0L50.0,32.0L50.0,68.0Z",
    ]);
  });

  it("pinta só as quadras feitas, deixando as que faltam no azul de sempre", () => {
    const limites = colecao(["qa", quadrado(0, 0)], ["qb", quadrado(2, 0)]);
    const { container } = render(
      <TerritorioGlyph limites={limites} feitas={new Set(["qa"])} />,
    );
    const classes = [...container.querySelectorAll("path")].map((p) =>
      p.getAttribute("class"),
    );
    expect(classes[0]).toContain("fill-sage");
    expect(classes[1]).toContain("fill-jwblue");
  });
});
