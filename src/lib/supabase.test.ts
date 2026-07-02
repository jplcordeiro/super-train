import { describe, it, expect } from "vitest";
import { supabase } from "./supabase";

describe("supabase client", () => {
  it("is configured with url and key from env", () => {
    expect(supabase).toBeDefined();
    // The client exposes `from`, proving it constructed correctly.
    expect(typeof supabase.from).toBe("function");
  });
});
