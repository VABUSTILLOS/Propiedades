"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";

import { cn } from "@/lib/utils";

type Theme = "light" | "dark";

const THEME_OPTIONS: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Oscuro", icon: Moon },
];

/** Desktop viewport width used to render the desktop layout on small screens. */
const DESKTOP_WIDTH = 1280;
/** The viewport content Next.js renders from the `viewport` export in layout.tsx. */
const ORIGINAL_VIEWPORT =
  "width=device-width, initial-scale=1, viewport-fit=cover";
const VIEWPORT_SELECTOR = 'meta[name="viewport"]';

/**
 * Viewport content that locks the layout to a desktop width and scales it to
 * fit. Browsers only auto-scale a bare `width=1280` until a reload; an explicit
 * initial-scale of deviceWidth/1280 keeps the desktop view zoomed-to-fit across
 * reloads and client-side navigations.
 */
function desktopViewportContent(): string {
  const scale = Math.min(window.screen.width / DESKTOP_WIDTH, 1);
  return (
    `width=${DESKTOP_WIDTH}, initial-scale=${scale}, ` +
    `maximum-scale=${scale}, minimum-scale=${scale}, user-scalable=no`
  );
}

const listeners = new Set<() => void>();
let originalViewport = "";

function systemIsDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function getStoredTheme(): Theme | null {
  const stored = localStorage.getItem("theme");
  return stored === "light" || stored === "dark" ? stored : null;
}

/** Effective theme: explicit preference or the OS color scheme. */
function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

function getThemeSnapshot(): Theme {
  return getStoredTheme() ?? (systemIsDark() ? "dark" : "light");
}

const getThemeServerSnapshot = (): Theme => "light";

function getDesktopViewSnapshot(): boolean {
  return localStorage.getItem("desktopView") === "true";
}

const getDesktopViewServerSnapshot = (): boolean => false;

function subscribe(callback: () => void) {
  listeners.add(callback);
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", callback);
  return () => {
    listeners.delete(callback);
    media.removeEventListener("change", callback);
  };
}

function notify() {
  listeners.forEach((listener) => listener());
}

/** Persist and apply a theme; passing null restores the OS preference. */
function setTheme(theme: Theme | null) {
  if (theme) localStorage.setItem("theme", theme);
  else localStorage.removeItem("theme");
  notify();
}

/** Lock/unlock the viewport to a desktop width so responsive CSS resolves desktop. */
function applyDesktopView(on: boolean) {
  const viewport = document.querySelector<HTMLMetaElement>(VIEWPORT_SELECTOR);
  if (viewport) {
    if (!originalViewport) {
      // The inline script in layout.tsx captures the original value before
      // changing it; fall back to the known serialized value if hydration
      // re-asserts the tag and drops the attribute.
      const saved = viewport.getAttribute("data-original-viewport");
      originalViewport =
        saved ||
        (viewport.content === desktopViewportContent()
          ? ORIGINAL_VIEWPORT
          : viewport.content);
    }
    viewport.setAttribute("content", on ? desktopViewportContent() : originalViewport);
  }
  document.documentElement.classList.toggle("desktop-view", on);
}

function setDesktopView(on: boolean) {
  localStorage.setItem("desktopView", on ? "true" : "false");
  applyDesktopView(on);
  notify();
}

/**
 * Theme switcher plus a "desktop view" toggle. The sun/moon buttons pick the
 * color scheme (clicking the active one restores the OS preference); the
 * monitor button locks the viewport to a desktop width so mobile and tablet
 * screens render the desktop layout scaled to fit. Both choices persist in
 * localStorage. The initial classes are applied by an inline script in the
 * root layout so there is no flash of the wrong theme.
 */
export function ThemeToggle() {
  const theme = useSyncExternalStore(
    subscribe,
    getThemeSnapshot,
    getThemeServerSnapshot,
  );
  const desktopView = useSyncExternalStore(
    subscribe,
    getDesktopViewSnapshot,
    getDesktopViewServerSnapshot,
  );

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    applyDesktopView(desktopView);
  }, [desktopView]);

  // Client-side navigation replaces the head elements (Next re-renders the
  // metadata), so the viewport meta node itself gets swapped and the content
  // resets. Watch the head and re-apply the desktop width whenever a fresh
  // viewport meta appears with the wrong content.
  useEffect(() => {
    const observer = new MutationObserver(() => {
      const on = localStorage.getItem("desktopView") === "true";
      const viewport = document.querySelector<HTMLMetaElement>(
        VIEWPORT_SELECTOR,
      );
      if (!viewport) return;
      const target = on ? desktopViewportContent() : originalViewport;
      if (viewport.content !== target) applyDesktopView(on);
    });
    observer.observe(document.head, { childList: true });
    return () => observer.disconnect();
  }, []);

  return (
    <div className="inline-flex items-center rounded-full border border-border bg-secondary/60 p-0.5">
      <div
        role="radiogroup"
        aria-label="Tema de color"
        className="inline-flex items-center"
      >
        {THEME_OPTIONS.map(({ value, label, icon: Icon }) => {
          const active = theme === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={active}
              title={label}
              aria-label={`Tema ${label.toLowerCase()}`}
              onClick={() => setTheme(active ? null : value)}
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
      <span
        aria-hidden="true"
        className={cn(
          "mx-0.5 h-5 w-px bg-border lg:hidden",
          desktopView && "lg:block",
        )}
      />
      <button
        type="button"
        aria-pressed={desktopView}
        title="Vista de escritorio"
        aria-label="Vista de escritorio"
        onClick={() => setDesktopView(!desktopView)}
        className={cn(
          "inline-flex size-8 items-center justify-center rounded-full transition-colors lg:hidden",
          desktopView && "lg:inline-flex",
          desktopView
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <Monitor className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
