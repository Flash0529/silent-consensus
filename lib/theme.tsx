"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

// "system" follows the OS. An explicit choice is stored in localStorage and
// mirrored to <html data-theme>, which the tokens in globals.css key off.

export type ThemePref = "system" | "light" | "dark";

const KEY = "hush-theme";

function readPref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

function apply(pref: ThemePref) {
  const root = document.documentElement;
  if (pref === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", pref);
}

/** Runs before first paint (inlined in <head>) so there's no light flash in dark mode. */
export const themeBootScript = `try{var t=localStorage.getItem(${JSON.stringify(KEY)});if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}`;

const ThemeContext = createContext<{ theme: ThemePref; setTheme: (t: ThemePref) => void }>({
  theme: "system",
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemePref>("system");

  useEffect(() => {
    setThemeState(readPref());
    // Keep other tabs in sync.
    const onStorage = (e: StorageEvent) => {
      if (e.key !== KEY) return;
      const next = readPref();
      apply(next);
      setThemeState(next);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setTheme = useCallback((t: ThemePref) => {
    try {
      if (t === "system") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, t);
    } catch {
      /* storage blocked: still apply for this session */
    }
    apply(t);
    setThemeState(t);
  }, []);

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
