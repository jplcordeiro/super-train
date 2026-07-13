import { render } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

class MapboxDrawFalso {
  noMapa = false;
  features: GeoJSON.Feature[] = [];

  getAll() {
    if (!this.noMapa) throw new TypeError("Cannot read properties of undefined");
    return { type: "FeatureCollection", features: this.features };
  }

  set(colecao: GeoJSON.FeatureCollection) {
    this.features = colecao.features;
  }
}

const criadas: MapboxDrawFalso[] = [];

vi.mock("@mapbox/mapbox-gl-draw", () => ({
  default: class {
    constructor() {
      const instancia = new MapboxDrawFalso();
      criadas.push(instancia);
      return instancia as never;
    }
  },
}));
vi.mock("@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css", () => ({}));

const mapa = {
  ouvintes: {} as Record<string, (() => void)[]>,
  on(evento: string, cb: () => void) {
    (this.ouvintes[evento] ??= []).push(cb);
  },
  off(evento: string, cb: () => void) {
    this.ouvintes[evento] = (this.ouvintes[evento] ?? []).filter((x) => x !== cb);
  },
  emitir(evento: string) {
    for (const cb of this.ouvintes[evento] ?? []) cb();
  },
  isStyleLoaded: () => true,
  once: (_: string, cb: () => void) => cb(),
};

vi.mock("react-map-gl/mapbox", () => ({
  useMap: () => ({ current: mapa }),
  useControl: (
    onCreate: (ctx: unknown) => unknown,
    onAdd?: (ctx: unknown) => void,
  ) => {
    const ctx = { map: mapa };
    const comitada = onCreate(ctx) as MapboxDrawFalso;
    onCreate(ctx);
    comitada.noMapa = true;
    onAdd?.(ctx);
    return comitada;
  },
}));

const quadra: GeoJSON.Feature = {
  type: "Feature",
  id: "quadra-do-draw",
  properties: {},
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [-46, -23],
        [-45, -23],
        [-45, -22],
        [-46, -23],
      ],
    ],
  },
};

describe("DrawControl", () => {
  beforeEach(() => {
    criadas.length = 0;
    mapa.ouvintes = {};
  });

  it("lê as quadras da instância que está no mapa, não de uma órfã do StrictMode", async () => {
    const { DrawControl } = await import("./Cadastro");
    const onChange = vi.fn();

    render(<DrawControl desenhoInicial={null} onChange={onChange} />);

    const noMapa = criadas.find((d) => d.noMapa)!;
    noMapa.features = [quadra];
    mapa.emitir("draw.create");

    expect(onChange).toHaveBeenCalledWith({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { id: "quadra-do-draw" },
          geometry: quadra.geometry,
        },
      ],
    });
  });
});
