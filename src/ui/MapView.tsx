import type { ComponentChildren } from "preact";
import { useMemo, useRef, useState } from "preact/hooks";
import { buildMap } from "../layout/rows";
import type { RecipeGraph } from "../model/types";
import { plan } from "../schedule/plan";
import { exportPng } from "./export";
import { TopBar } from "./TopBar";
import { TransitMap } from "./TransitMap";

// A recipe's transit map, with export in the top bar and anything else (actions,
// details) underneath.
export function MapView({ graph, children }: { graph: RecipeGraph; children?: ComponentChildren }) {
  const map = useMemo(() => {
    const { graph: planned, schedule } = plan(graph);
    return buildMap(planned, schedule);
  }, [graph]);
  const ref = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onExport = async () => {
    setExporting(true);
    setError(null);
    try {
      await exportPng(ref.current!, graph.title);
    } catch (e) {
      setError(`Couldn't make the image: ${(e as Error).message}`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <TopBar>
        <button type="button" class="topbar-button" disabled={exporting} onClick={onExport}>
          {exporting ? "Exporting…" : "Share image"}
        </button>
      </TopBar>
      {error && (
        <p class="page note error" role="alert">
          {error}
        </p>
      )}
      <div ref={ref} class="export-root">
        <TransitMap map={map} />
      </div>
      {children}
    </>
  );
}
