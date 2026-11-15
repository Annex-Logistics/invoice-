// Light / dark / follow-the-system theme. The choice is a per-device
// preference (not included in backups). public/theme-init.js applies it
// before first paint; this module changes it at runtime.

export type ThemeChoice = "system" | "light" | "dark";

const KEY = "annexinvoice.theme.v1";

export function getTheme(): ThemeChoice {
  try {
    const t = window.localStorage.getItem(KEY);
    return t === "light" || t === "dark" ? t : "system";
  } catch {
    return "system";
  }
}

function systemPrefersDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function applyTheme(choice: ThemeChoice = getTheme()) {
  const dark = choice === "dark" || (choice === "system" && systemPrefersDark());
  document.documentElement.classList.toggle("dark", dark);
}

export function setTheme(choice: ThemeChoice) {
  try {
    window.localStorage.setItem(KEY, choice);
  } catch {
    /* storage blocked: apply for this page only */
  }
  applyTheme(choice);
}

// Follow OS changes while the choice is "system". Returns an unsubscribe.
export function watchSystemTheme(): () => void {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const onChange = () => {
    if (getTheme() === "system") applyTheme("system");
  };
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}
