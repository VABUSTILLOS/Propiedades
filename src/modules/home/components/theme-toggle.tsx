"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";

import { cn } from "@/lib/utils";

type Theme = "light" | "dark" | "system";

const OPTIONS: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Oscuro", icon: Moon },
  { value: "system", label: "Sistema", icon: Monitor },
];

const listeners = new Set<() => void>();

function systemIsDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyTheme(theme: Theme) {
  const dark = theme === "dark" || (theme === "system" && systemIsDark());
  document.documentElement.classList.toggle("dark", dark);
}

function getSnapshot(): Theme {
  const stored = localStorage.getItem("theme");
  return stored === "light" || stored === "dark" ? stored : "system";
}

const getServerSnapshot = (): Theme => "system";

function subscribe(callback: () => void) {
  listeners.add(callback);
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", callback);
  return () => {
    listeners.delete(callback);
    media.removeEventListener("change", callback);
  };
}

function setStoredTheme(theme: Theme) {
  if (theme === "system") localStorage.removeItem("theme");
  else localStorage.setItem("theme", theme);
  listeners.forEach((listener) => listener());
}

/**
 * Light / dark / system theme switcher. Persists the choice in localStorage
 * ("theme") and follows the OS preference while "system" is selected. The
 * initial class is applied by an inline script in the root layout so there
 * is no flash of the wrong theme.
 */
export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return (
    <div
      role="radiogroup"
      aria-label="Tema de color"
      className="inline-flex items-center rounded-full border border-border bg-secondary/60 p-0.5"
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const active = theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            title={label}
            aria-label={`Tema ${label.toLowerCase()}`}
            onClick={() => setStoredTheme(value)}
            className={cn(
              "inline-flex size-8 items-center justify-center rounded-full transition-colors",
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
