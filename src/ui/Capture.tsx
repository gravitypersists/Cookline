import { useRef, useState } from "preact/hooks";
import { ExtractionError, extractRecipe, type Stage } from "../extract/extract";
import { downscale } from "../extract/image";
import { getApiKey, getModel } from "../store/settings";
import { saveLast } from "../store/last";

type Mode = "photos" | "text";
type Status =
  | { kind: "idle" }
  | { kind: "working"; stage: Stage }
  | { kind: "failed"; message: string; errors?: string[]; raw?: string };

const STAGE_TEXT: Record<Stage, string> = {
  reading: "Reading recipe…",
  repairing: "Fixing a few problems…",
};

export function Capture() {
  const [mode, setMode] = useState<Mode>("photos");
  const [images, setImages] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const abort = useRef<AbortController | null>(null);
  const apiKey = getApiKey();

  if (!apiKey) {
    return (
      <main class="page">
        <h1 class="map-title">New recipe</h1>
        <p class="note">
          Reading a recipe needs your OpenRouter API key. Add it in <a href="#/settings">Settings</a>.
        </p>
      </main>
    );
  }

  const addFiles = async (files: FileList | null) => {
    if (!files) return;
    const urls = await Promise.all([...files].map(downscale));
    setImages((prev) => [...prev, ...urls]);
  };

  const ready = mode === "photos" ? images.length > 0 : text.trim().length > 0;

  const run = async () => {
    abort.current = new AbortController();
    setStatus({ kind: "working", stage: "reading" });
    try {
      const result = await extractRecipe({
        input: mode === "photos" ? { kind: "images", images } : { kind: "text", text },
        apiKey,
        model: getModel(),
        signal: abort.current.signal,
        onStage: (stage) => setStatus({ kind: "working", stage }),
      });
      saveLast(result);
      location.hash = "#/recipe/last";
    } catch (e) {
      if ((e as Error).name === "AbortError") return setStatus({ kind: "idle" });
      if (e instanceof ExtractionError) {
        return setStatus({ kind: "failed", message: e.message, errors: e.errors, raw: e.raw });
      }
      setStatus({ kind: "failed", message: (e as Error).message || "Something went wrong." });
    }
  };

  if (status.kind === "working") {
    return (
      <main class="page">
        <h1 class="map-title">New recipe</h1>
        <p class="status" role="status" aria-live="polite">
          {STAGE_TEXT[status.stage]}
        </p>
        <button type="button" class="button" onClick={() => abort.current?.abort()}>
          Cancel
        </button>
      </main>
    );
  }

  return (
    <main class="page">
      <h1 class="map-title">New recipe</h1>

      <div class="segmented" role="group" aria-label="Input">
        <button type="button" aria-pressed={mode === "photos"} onClick={() => setMode("photos")}>
          Photos
        </button>
        <button type="button" aria-pressed={mode === "text"} onClick={() => setMode("text")}>
          Text
        </button>
      </div>

      {mode === "photos" ? (
        <section class="section">
          <div class="field-row">
            <label class="button">
              Take photo
              <input type="file" accept="image/*" capture="environment" hidden onChange={(e) => addFiles((e.target as HTMLInputElement).files)} />
            </label>
            <label class="button">
              Choose photos
              <input type="file" accept="image/*" multiple hidden onChange={(e) => addFiles((e.target as HTMLInputElement).files)} />
            </label>
          </div>
          {images.length > 0 && (
            <ul class="thumbs">
              {images.map((src, i) => (
                <li>
                  <img src={src} alt={`Page ${i + 1}`} />
                  <button
                    type="button"
                    class="thumb-remove"
                    aria-label={`Remove page ${i + 1}`}
                    onClick={() => setImages(images.filter((_, j) => j !== i))}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p class="note">For a recipe over several pages, add them in order.</p>
        </section>
      ) : (
        <textarea
          class="input textarea"
          placeholder="Paste the recipe: ingredients and method"
          value={text}
          onInput={(e) => setText((e.target as HTMLTextAreaElement).value)}
        />
      )}

      {status.kind === "failed" && (
        <div class="card error-card" role="alert">
          <p>{status.message}</p>
          {status.errors && (
            <ul>
              {status.errors.map((e) => (
                <li>{e}</li>
              ))}
            </ul>
          )}
          {status.raw && (
            <details>
              <summary>Model output</summary>
              <pre>{status.raw}</pre>
            </details>
          )}
        </div>
      )}

      <button type="button" class="button primary" disabled={!ready} onClick={run}>
        {status.kind === "failed" ? "Try again" : "Make map"}
      </button>
    </main>
  );
}
