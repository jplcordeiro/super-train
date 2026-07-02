import { useState } from "react";
import { supabase } from "../lib/supabase";

export function Login() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: senha,
    });
    if (error) setErro("E-mail ou senha inválidos.");
  }

  return (
    <form
      onSubmit={entrar}
      style={{ maxWidth: 320, margin: "20vh auto", display: "grid", gap: 12 }}
    >
      <h1>super-train</h1>
      <input
        type="email"
        placeholder="E-mail"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <input
        type="password"
        placeholder="Senha"
        value={senha}
        onChange={(e) => setSenha(e.target.value)}
        required
      />
      {erro && <p style={{ color: "crimson" }}>{erro}</p>}
      <button type="submit">Entrar</button>
    </form>
  );
}
