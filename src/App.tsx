import { Routes, Route, Navigate } from "react-router-dom";
import { useSession } from "./auth/useSession";
import { Login } from "./auth/Login";
import { Gestao } from "./screens/Gestao";
import { Cadastro } from "./screens/Cadastro";
import { Campo } from "./screens/Campo";
import { LocatorSeal } from "./components/LocatorSeal";

// Splash da inicialização: enquanto a sessão é verificada. Reusa o mesmo bloco
// de identidade do Login (selo + wordmark) para que a tela se dissolva sem
// saltos quando o Login aparece; o traço percorrendo o contorno é o "plotando".
function AppBoot() {
  return (
    <main
      className="grid min-h-dvh place-items-center px-4"
      role="status"
      aria-label="Carregando super-train"
    >
      <div className="flex flex-col items-center">
        <LocatorSeal tracing />
        <h1 className="mt-6 text-2xl font-semibold tracking-tight text-jwblue-deep">
          super-train
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          Territórios de campo da congregação
        </p>
      </div>
    </main>
  );
}

export default function App() {
  const { session, loading } = useSession();
  if (loading) return <AppBoot />;
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
