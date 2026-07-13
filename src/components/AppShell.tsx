import { NavLink, Outlet } from "react-router-dom";
import { CalendarDays, LogOut, Map, Users } from "lucide-react";
import { supabase } from "../lib/supabase";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function HexIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 100" fill="none" aria-hidden="true">
      <path
        d="M20 34 L50 20 L80 34 L80 68 L50 82 L20 68 Z"
        stroke="currentColor"
        strokeWidth="7"
        strokeLinejoin="round"
      />
      <circle cx="50" cy="51" r="8" fill="currentColor" />
    </svg>
  );
}

const AREAS = [
  { to: "/", rotulo: "Territórios", Icone: HexIcon },
  { to: "/mapa", rotulo: "Mapa", Icone: Map },
  { to: "/calendario", rotulo: "Calendário", Icone: CalendarDays },
  { to: "/publicadores", rotulo: "Publicadores", Icone: Users },
];

export function AppShell() {
  return (
    <div className="flex h-dvh flex-col bg-paper">
      <header className="nao-imprime flex flex-none items-center gap-4 border-b border-line bg-white px-[clamp(14px,4vw,32px)] py-2.5">
        <div className="flex items-center gap-2.5">
          <HexIcon className="h-7 w-7 flex-none text-jwblue" />
          <span className="text-[1.05rem] font-semibold tracking-[-0.02em] text-ink">
            polygon
          </span>
        </div>

        <nav aria-label="Áreas" className="ml-4 hidden md:flex md:items-center md:gap-1">
          {AREAS.map(({ to, rotulo }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                cn(
                  "rounded-lg px-3 py-1.5 text-[0.78rem] font-semibold uppercase tracking-[0.1em] transition-colors",
                  isActive
                    ? "bg-jwblue-wash text-jwblue-deep"
                    : "text-ink-soft hover:text-jwblue",
                )
              }
            >
              {rotulo}
            </NavLink>
          ))}
        </nav>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => supabase.auth.signOut()}
          className="ml-auto text-ink-soft hover:text-jwblue"
        >
          <LogOut aria-hidden="true" />
          Sair
        </Button>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto">
        <Outlet />
      </main>

      <nav
        aria-label="Áreas"
        className="nao-imprime flex flex-none border-t border-line bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {AREAS.map(({ to, rotulo, Icone }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              cn(
                "flex flex-1 flex-col items-center gap-1 py-2 transition-colors",
                isActive ? "text-jwblue" : "text-ink-soft",
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icone
                  className={cn("size-5.5", isActive && "text-jwblue")}
                  aria-hidden="true"
                />
                <span className="text-[0.66rem] font-semibold uppercase tracking-[0.08em]">
                  {rotulo}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
