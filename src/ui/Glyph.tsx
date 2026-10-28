import { useMemo } from "preact/hooks";
import { assignLanes } from "../layout/lanes";
import type { RecipeGraph } from "../model/types";
import { plan } from "../schedule/plan";

// A recipe's lines in miniature, colored and ordered as on its map.
export function Glyph({ graph }: { graph: RecipeGraph }) {
  const slots = useMemo(() => {
    try {
      const { graph: planned, schedule } = plan(graph);
      return assignLanes(planned, schedule).map((l) => l.slot);
    } catch {
      return [1];
    }
  }, [graph]);
  return (
    <span class="glyph" aria-hidden="true">
      {slots.map((slot) => (
        <span style={{ background: `var(--line-${slot})` }} />
      ))}
    </span>
  );
}
