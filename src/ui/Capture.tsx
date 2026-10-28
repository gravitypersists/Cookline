import { useRef, useState } from "preact/hooks";
import { extractRecipe, type Stage } from "../extract/extract";
import { downscale } from "../extract/image";
import { getApiKey, getModel, getUniversalPrompt } from "../store/settings";
import { saveExtraction } from "../store/recipes";
import { describeFailure } from "./failure";
import { Camera, Photos } from "./icons";

type Status =
  | { kind: "idle" }
  | { kind: "working"; stage: Stage }
  | { kind: "failed"; message: string; errors?: string[]; raw?: string };

const STAGE_TEXT: Record<Stage, string> = {
  reading: "Reading recipe…",
  repairing: "Fixing a few problems…",
};

// New recipe (SPEC §3): photos and one text box. With no photos the text is the
// recipe; alongside photos it's notes, or more of the recipe.
export function Capture() {
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

  const addFiles = async (input: HTMLInputElement) => {
    if (!input.files) return;
    const urls = await Promise.all([...input.files].map(downscale));
    setImages((prev) => [...prev, ...urls]);
    input.value = ""; // so choosing the same photo again still fires change
  };

  const hasPhotos = images.length > 0;
  const ready = hasPhotos || text.trim().length > 0;

  const run = async () => {
    abort.current = new AbortController();
    setStatus({ kind: "working", stage: "reading" });
    const input = { images, text };
    try {
      const result = await extractRecipe({
        input,
        apiKey,
        model: getModel(),
        universalPrompt: getUniversalPrompt(),
        signal: abort.current.signal,
        onStage: (stage) => setStatus({ kind: "working", stage }),
      });
      const record = await saveExtraction(result, input);
      location.hash = `#/recipe/${record.id}`;
    } catch (e) {
      if ((e as Error).name === "AbortError") return setStatus({ kind: "idle" });
      setStatus({ kind: "failed", ...describeFailure(e) });
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

      <section class="section">
        <div class="capture-tiles">
          <label class="tile">
            <Camera />
            {hasPhotos ? "Take another" : "Take photo"}
            <input type="file" accept="image/*" capture="environment" hidden onChange={(e) => addFiles(e.target as HTMLInputElement)} />
          </label>
          <label class="tile">
            <Photos />
            Choose photos
            <input type="file" accept="image/*" multiple hidden onChange={(e) => addFiles(e.target as HTMLInputElement)} />
          </label>
        </div>
        {hasPhotos && (
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

      <section class="section">
        <label class="label" for="recipe-text">
          {hasPhotos ? "Notes (optional)" : "Or paste the recipe"}
        </label>
        <textarea
          id="recipe-text"
          class={hasPhotos ? "input textarea short" : "input textarea"}
          placeholder={
            hasPhotos
              ? "Anything the photos don't say: “making a double batch”, “no oven, using the air fryer”, or the rest of the recipe."
              : "Ingredients and method"
          }
          value={text}
          onInput={(e) => setText((e.target as HTMLTextAreaElement).value)}
        />
      </section>

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

      <button type="button" class="button primary wide" disabled={!ready} onClick={run}>
        {status.kind === "failed" ? "Try again" : "Make map"}
      </button>
    </main>
  );
}
