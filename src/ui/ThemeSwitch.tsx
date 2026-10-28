import { useEffect, useState } from "preact/hooks";
import { read, write } from "./storage";

type Theme = "system" | "light" | "dark";
const KEY = "reciper.theme";

export function applyStoredTheme() {
  apply((read(KEY) as Theme | null) ?? "system");
}

function apply(theme: Theme) {
  if (theme === "system") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", theme);
}

// Temporary home for the theme setting until the Settings screen (milestone 3).
export function ThemeSwitch() {
  const [theme, setTheme] = useState<Theme>((read(KEY) as Theme | null) ?? "system");
  useEffect(() => {
    apply(theme);
    write(KEY, theme);
  }, [theme]);

  return (
    <div class="segmented" role="group" aria-label="Theme">
      {(["system", "light", "dark"] as const).map((t) => (
        <button type="button" aria-pressed={theme === t} onClick={() => setTheme(t)}>
          {t[0]!.toUpperCase() + t.slice(1)}
        </button>
      ))}
    </div>
  );
}
