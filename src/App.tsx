import { Routes, Route, Navigate } from "react-router-dom";
import { useSession } from "./auth/useSession";
import { Login } from "./auth/Login";
import { Gestao } from "./screens/Gestao";
import { Cadastro } from "./screens/Cadastro";
import { Campo } from "./screens/Campo";
import { Mapa } from "./screens/Mapa";
import { Calendario } from "./screens/Calendario";
import { Publicadores } from "./screens/Publicadores";
import { LocatorSeal } from "./components/LocatorSeal";
import { AppShell } from "./components/AppShell";

function AppBoot() {
  return (
    <main
      className="grid min-h-dvh place-items-center px-4"
      role="status"
      aria-label="Carregando polygon"
    >
      <div className="flex flex-col items-center">
        <LocatorSeal tracing />
        <h1 className="mt-6 text-2xl font-semibold tracking-tight text-jwblue-deep">
          polygon
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
      <Route element={<AppShell />}>
        <Route path="/" element={<Gestao />} />
        <Route path="/mapa" element={<Mapa />} />
        <Route path="/calendario" element={<Calendario />} />
        <Route path="/publicadores" element={<Publicadores />} />
      </Route>
      <Route path="/cadastro" element={<Cadastro />} />
      <Route path="/cadastro/:id" element={<Cadastro />} />
      <Route path="/campo/:id" element={<Campo />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
