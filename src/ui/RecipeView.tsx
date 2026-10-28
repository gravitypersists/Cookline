import { useEffect, useState } from "preact/hooks";
import { extractRecipe, type ExtractInput } from "../extract/extract";
import { getApiKey, getModel } from "../store/settings";
import { deleteRecipe, getRecipe, getSource, replaceExtraction, type RecipeRecord } from "../store/recipes";
import { describeFailure } from "./failure";
import { formatCost } from "../extract/cost";
import { MapView } from "./MapView";
import { TopBar } from "./TopBar";

type Busy = { kind: "none" } | { kind: "rereading" } | { kind: "failed"; message: string };

// A saved recipe (SPEC §3 step 4): the map, then Read again and Delete.
export function RecipeView({ id }: { id: string }) {
  const [record, setRecord] = useState<RecipeRecord | null | undefined>(undefined);
  const [source, setSource] = useState<ExtractInput | undefined>(undefined);
  const [busy, setBusy] = useState<Busy>({ kind: "none" });
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    getRecipe(id).then((r) => setRecord(r ?? null), () => setRecord(null));
    getSource(id).then(setSource, () => {});
  }, [id]);

  useEffect(() => {
    if (!confirmDelete) return;
    const t = setTimeout(() => setConfirmDelete(false), 4000);
    return () => clearTimeout(t);
  }, [confirmDelete]);

  if (record === undefined) return <TopBar />;
  if (record === null) {
    return (
      <>
        <TopBar />
        <main class="page">
          <p class="note">This recipe isn't saved on this device.</p>
        </main>
      </>
    );
  }

  const reread = async () => {
    if (!source) return;
    setBusy({ kind: "rereading" });
    try {
      const result = await extractRecipe({ input: source, apiKey: getApiKey(), model: getModel() });
      setRecord(await replaceExtraction(id, result));
      setBusy({ kind: "none" });
    } catch (e) {
      setBusy({ kind: "failed", message: describeFailure(e).message });
    }
  };

  const remove = async () => {
    if (!confirmDelete) return setConfirmDelete(true);
    await deleteRecipe(id);
    location.hash = "#/";
  };

  const cost = record.cost !== undefined ? ` · ${formatCost(record.cost)}` : "";
  const canReread = source !== undefined && getApiKey() !== "";

  return (
    <MapView key={record.updatedAt} graph={record.graph}>
      <footer class="page meta">
        {record.warnings.length > 0 && (
          <ul class="note">
            {record.warnings.map((w) => (
              <li>{w}</li>
            ))}
          </ul>
        )}
        <p class="note">
          Read by {record.model}
          {cost}
          {record.repaired && " · fixed on a second pass"}
        </p>
        {busy.kind === "failed" && (
          <p class="note error" role="alert">
            {busy.message}
          </p>
        )}
        <div class="field-row">
          {canReread && (
            <button type="button" class="button" disabled={busy.kind === "rereading"} onClick={reread}>
              {busy.kind === "rereading" ? "Reading again…" : "Read again"}
            </button>
          )}
          <button type="button" class="button" onClick={remove}>
            {confirmDelete ? "Tap again to delete" : "Delete"}
          </button>
        </div>
        {canReread && (
          <p class="note">
            Read again sends the original {source!.kind === "images" ? "photos" : "text"} to {getModel()} and replaces
            this map.
          </p>
        )}
      </footer>
    </MapView>
  );
}
