import type { ComponentChildren } from "preact";
import { ChevronLeft } from "./icons";

// Back to the library, with optional actions on the right.
export function TopBar({ children }: { children?: ComponentChildren }) {
  return (
    <nav class="topbar">
      <a class="topbar-link" href="#/">
        <ChevronLeft />
        Recipes
      </a>
      {children && <div class="topbar-actions">{children}</div>}
    </nav>
  );
}
