import { Routes, Route, Navigate } from "react-router-dom";
import { useSession } from "./auth/useSession";
import { Login } from "./auth/Login";
import { Gestao } from "./screens/Gestao";
import { Cadastro } from "./screens/Cadastro";
import { Campo } from "./screens/Campo";

export default function App() {
  const { session, loading } = useSession();
  if (loading) return <p>Carregando…</p>;
  if (!session) return <Login />;
  return (
    <Routes>
      <Route path="/" element={<Gestao />} />
      <Route path="/cadastro" element={<Cadastro />} />
      <Route path="/campo/:id" element={<Campo />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
