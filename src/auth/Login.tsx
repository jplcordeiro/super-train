import { useState } from "react";
import { supabase } from "../lib/supabase";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LocatorSeal } from "@/components/LocatorSeal";

export function Login() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [entrando, setEntrando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEntrando(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: senha,
    });
    if (error) setErro("E-mail ou senha inválidos.");
    setEntrando(false);
  }

  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center">
          <LocatorSeal />
          <h1 className="mt-6 text-2xl font-semibold tracking-tight text-jwblue-deep">
            super-train
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            Territórios de campo da congregação
          </p>
        </div>

        <form
          onSubmit={entrar}
          className="mt-8 grid gap-4 rounded-xl border border-line bg-card p-6 shadow-card"
        >
          <div className="grid gap-1.5">
            <label htmlFor="email" className="text-sm font-medium text-ink">
              E-mail
            </label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={erro != null}
              required
            />
          </div>

          <div className="grid gap-1.5">
            <label htmlFor="senha" className="text-sm font-medium text-ink">
              Senha
            </label>
            <Input
              id="senha"
              type="password"
              autoComplete="current-password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              aria-invalid={erro != null}
              required
            />
          </div>

          <p
            role="alert"
            aria-live="polite"
            className="min-h-5 text-sm text-danger"
          >
            {erro}
          </p>

          <Button type="submit" size="lg" disabled={entrando} className="cursor-pointer">
            {entrando ? "Entrando…" : "Entrar"}
          </Button>
        </form>
      </div>
    </main>
  );
}
