import { Fragment } from "preact";
import { useState } from "preact/hooks";
import type { MapModel } from "../layout/rows";
import { totalLabel } from "../format/time";
import { Legend } from "./Legend";
import { StationRow } from "./StationRow";
import { BreakRow } from "./BreakRow";

export function TransitMap({ map }: { map: MapModel }) {
  const [highlight, setHighlight] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const eyebrow = [totalLabel(map.total), map.servings && `SERVES ${map.servings}`]
    .filter(Boolean)
    .join(" · ");

  return (
    <article class="page">
      <header class="map-header">
        <div class="label">{eyebrow}</div>
        <h1 class="map-title">{map.title}</h1>
      </header>

      <Legend lanes={map.lanes} highlight={highlight} onHighlight={setHighlight} />

      <div class="map">
        {map.rows.map((row) => {
          const wait = map.breaks[row.station.id];
          return (
            <Fragment key={row.station.id}>
              <StationRow
                row={row}
                lanes={map.lanes}
                highlight={highlight}
                expanded={expanded === row.station.id}
                onToggle={() => setExpanded(expanded === row.station.id ? null : row.station.id)}
              />
              {wait && <BreakRow wait={wait} lanes={map.lanes} highlight={highlight} />}
            </Fragment>
          );
        })}
      </div>
    </article>
  );
}
