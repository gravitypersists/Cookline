import type { Lane } from "../layout/lanes";
import type { BreakModel } from "../layout/rows";
import { LINE_WIDTH, gutterWidth, laneX } from "../layout/geometry";
import { minutes } from "../format/time";
import { lineBackground } from "./StationRow";

interface Props {
  wait: BreakModel;
  lanes: Lane[];
  highlight: string | null;
}

// A long wait, drawn like an axis break: each live line stops, two slashes, and
// carries on (SPEC §6.3).
export function BreakRow({ wait, lanes, highlight }: Props) {
  const dimmed = (lane: number) =>
    highlight !== null && lanes[lane]!.componentId !== highlight ? "dim" : "";

  return (
    <div class="break-row">
      <div class="gutter" style={{ width: `${gutterWidth(lanes.length)}px` }} aria-hidden="true">
        {wait.segments.map((seg) => {
          const lane = lanes[seg.lane]!;
          const left = `${laneX(seg.lane) - LINE_WIDTH / 2}px`;
          const background = lineBackground(lane, seg.style);
          return (
            <>
              <div class={`seg ${dimmed(seg.lane)}`} style={{ left, top: 0, height: "14px", background }} />
              <div class={`seg ${dimmed(seg.lane)}`} style={{ left, top: "30px", bottom: 0, background }} />
              {[16, 23].map((top) => (
                <div
                  class={`slash ${dimmed(seg.lane)}`}
                  style={{ left: `${laneX(seg.lane) - 7}px`, top: `${top}px`, background: `var(--line-${lane.slot})` }}
                />
              ))}
            </>
          );
        })}
      </div>
      <div class="break-label">Wait ~{minutes(wait.minutes)}</div>
    </div>
  );
}
