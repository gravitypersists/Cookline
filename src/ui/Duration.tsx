import type { Duration as D } from "../model/types";
import { durationAria, durationText, isExact } from "../format/time";
import { Stopwatch } from "./icons";

export function Duration({ d }: { d: D }) {
  const exact = isExact(d);
  return (
    <span class={exact ? "duration exact" : "duration"} aria-label={durationAria(d)}>
      {exact && <Stopwatch />}
      {durationText(d)}
    </span>
  );
}
