import type { ComponentChildren } from "preact";

// Back to the library, with optional actions on the right.
export function TopBar({ children }: { children?: ComponentChildren }) {
  return (
    <nav class="topbar">
      <a href="#/">‹ Recipes</a>
      {children && <div class="topbar-actions">{children}</div>}
    </nav>
  );
}
