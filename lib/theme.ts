/**
 * The light/dark choice. "system" follows the OS and is the default, so a
 * first-time visitor gets whichever theme the rest of their machine is in.
 *
 * The preference lives in localStorage, and the resolved theme lives in
 * `data-theme` on <html>, where globals.css picks it up. `themeScript` below is
 * the same resolution written out for an inline <head> script, so the attribute
 * is set while the HTML is still parsing and the page never paints the wrong
 * theme first.
 */
export const THEME_KEY = "lodestar:theme:v1";

export type Theme = "light" | "dark";
export type ThemePreference = Theme | "system";

export function readPreference(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(THEME_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // Private mode / blocked storage — fall back to the system theme.
  }
  return "system";
}

export function storePreference(preference: ThemePreference) {
  try {
    if (preference === "system") window.localStorage.removeItem(THEME_KEY);
    else window.localStorage.setItem(THEME_KEY, preference);
  } catch {
    // Nothing to persist to; the choice still applies for this page.
  }
}

export function resolveTheme(preference: ThemePreference): Theme {
  if (preference !== "system") return preference;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
}

/** Runs synchronously in <head>, before the browser paints anything. */
export const themeScript = `(function(){try{var p=localStorage.getItem(${JSON.stringify(THEME_KEY)});var t=p==="light"||p==="dark"?p:matchMedia("(prefers-color-scheme: light)").matches?"light":"dark";document.documentElement.dataset.theme=t}catch(e){}})()`;
