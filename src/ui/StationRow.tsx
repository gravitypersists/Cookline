import type { Lane } from "../layout/lanes";
import type { RowModel, Segment } from "../layout/rows";
import { DOT, DOT_CENTER, LINE_WIDTH, TERMINAL_DOT, gutterWidth, laneX } from "../layout/geometry";
import { timecode } from "../format/time";
import { Duration } from "./Duration";

interface Props {
  row: RowModel;
  lanes: Lane[];
  expanded: boolean;
  onToggle: () => void;
  highlight: string | null;
}

function lineBackground(lane: Lane, style: Segment["style"]): string {
  const color = `var(--line-${lane.slot})`;
  if (style === "solid") return color;
  const [on, off] = lane.alt ? [3, 7] : [6, 11];
  return `repeating-linear-gradient(to bottom, ${color} 0 ${on}px, transparent ${on}px ${off}px)`;
}

export function StationRow({ row, lanes, expanded, onToggle, highlight }: Props) {
  const { station: s } = row;
  const dimmed = (lane: number) =>
    highlight !== null && lanes[lane]!.componentId !== highlight ? "dim" : "";
  const own = lanes[row.lane]!;

  return (
    <div
      class="row"
      role="button"
      tabIndex={0}
      aria-expanded={expanded}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggle();
        }
      }}
    >
      <div class="gutter" style={{ width: `${gutterWidth(lanes.length)}px` }} aria-hidden="true">
        {row.segments.map((seg) => (
          <div
            class={`seg ${dimmed(seg.lane)}`}
            style={{
              left: `${laneX(seg.lane) - LINE_WIDTH / 2}px`,
              top: seg.from === "dot" ? `${DOT_CENTER}px` : "0",
              // A segment never runs dot to dot, so an ending segment always starts at the top.
              ...(seg.to === "dot" ? { height: `${DOT_CENTER}px` } : { bottom: "0" }),
              background: lineBackground(lanes[seg.lane]!, seg.style),
            }}
          />
        ))}
        {row.mergeBars.map((b) => {
          const x1 = laneX(Math.min(b.from, b.to));
          const x2 = laneX(Math.max(b.from, b.to));
          return (
            <div
              class={`bar ${dimmed(b.from)}`}
              style={{
                left: `${x1 - LINE_WIDTH / 2}px`,
                width: `${x2 - x1 + LINE_WIDTH}px`,
                background: `var(--line-${lanes[b.from]!.slot})`,
              }}
            />
          );
        })}
        {row.terminal ? (
          <div
            class={`dot terminal ${dimmed(row.lane)}`}
            style={{ left: `${laneX(row.lane) - TERMINAL_DOT / 2}px`, background: `var(--line-${own.slot})` }}
          />
        ) : (
          <div
            class={`dot ${dimmed(row.lane)}`}
            style={{ left: `${laneX(row.lane) - DOT / 2}px`, borderColor: `var(--line-${own.slot})` }}
          />
        )}
      </div>

      <div class="content">
        <div class="heading">
          <span class="timecode">{timecode(row.start)}</span>
          <span class="station-title">{s.title}</span>
          {!row.terminal && <Duration d={s.duration} />}
        </div>

        {row.chips.length > 0 && (
          <div class="chips">
            {row.chips.map((c) => (
              <span class="chip">
                {c.plus && "+ "}
                {c.label}
                {c.secondary && <span class="chip-secondary"> {c.secondary}</span>}
              </span>
            ))}
          </div>
        )}

        {row.meanwhile && (
          <div class="meanwhile">
            <strong>Meanwhile</strong>
            {row.meanwhile.freeMinutes !== undefined && ` · ${row.meanwhile.freeMinutes} free min`}
            {": "}
            {row.meanwhile.items.join(", ")}
          </div>
        )}

        {expanded && (
          <div class="details">
            <p class="source">
              {s.duration.quote ? `Recipe says “${s.duration.quote}”` : "Time estimated"}
              {s.cue && ` · ${s.cue}`}
            </p>
            {s.detail && <p>{s.detail}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
