import type { Lane } from "../layout/lanes";

interface Props {
  lanes: Lane[];
  highlight: string | null;
  onHighlight: (componentId: string | null) => void;
}

export function Legend({ lanes, highlight, onHighlight }: Props) {
  return (
    <div class="legend label">
      {lanes.map((l) => (
        <button
          type="button"
          class="legend-item label"
          aria-pressed={highlight === l.componentId}
          onClick={() => onHighlight(highlight === l.componentId ? null : l.componentId)}
        >
          <span class="legend-swatch" style={{ background: `var(--line-${l.slot})` }} />
          {l.name}
        </button>
      ))}
      <span class="legend-item">
        <span class="legend-swatch waiting" />
        Waiting
      </span>
    </div>
  );
}
