/**
 * The light/dark choice. Dark is the default: Lodestar is a dark product first,
 * so a visitor who has never chosen gets graphite and chrome whatever the rest
 * of their machine is in. "system" is there for people who want the OS to
 * decide, but they have to ask for it.
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

export const DEFAULT_PREFERENCE: ThemePreference = "dark";

export function readPreference(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(THEME_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") return stored;
  } catch {
    // Private mode / blocked storage — fall back to the default.
  }
  return DEFAULT_PREFERENCE;
}

export function storePreference(preference: ThemePreference) {
  try {
    // The default needs no entry; anything else is an explicit choice.
    if (preference === DEFAULT_PREFERENCE) window.localStorage.removeItem(THEME_KEY);
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
  // Keep the browser chrome (mobile address bar) on the theme actually shown.
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", theme === "light" ? "#f4f4f6" : "#060608");
}

/**
 * Runs synchronously in <head>, before the browser paints anything. Mirrors
 * readPreference + resolveTheme: only a stored "light", or a stored "system" on
 * a light machine, gives light. Everything else — including no entry at all —
 * is dark.
 */
export const themeScript = `(function(){try{var p=localStorage.getItem(${JSON.stringify(THEME_KEY)});var t=p==="light"||(p==="system"&&matchMedia("(prefers-color-scheme: light)").matches)?"light":"dark";document.documentElement.dataset.theme=t;if(t==="light"){var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content","#f4f4f6")}}catch(e){}})()`;
