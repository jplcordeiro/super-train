import { useSession } from "./auth/useSession";
import { Login } from "./auth/Login";

export default function App() {
  const { session, loading } = useSession();
  if (loading) return <p>Carregando…</p>;
  if (!session) return <Login />;
  return <p>Autenticado. (rotas na Task 8)</p>;
}
