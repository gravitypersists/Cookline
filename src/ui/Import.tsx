import { useState } from "preact/hooks";
import { checkKey } from "../extract/openrouter";
import { PasteGone } from "../share/privatebin";
import { redeemShare, type ShareToken } from "../share/share";
import { getApiKey, setApiKey } from "../store/settings";

type State =
  | { kind: "ask" }
  | { kind: "working" }
  | { kind: "done"; detail: string }
  | { kind: "failed"; message: string };

// Opened from a share link. Nothing is fetched until the person agrees: the
// link works once, so a link preview or prefetch mustn't use it up, and a link
// mustn't swap someone's key without asking.
export function Import({ token }: { token: ShareToken | null }) {
  const [state, setState] = useState<State>({ kind: "ask" });
  const replacing = getApiKey() !== "";

  if (!token) {
    return (
      <main class="page">
        <h1 class="map-title">Set up Cookline</h1>
        <p class="note">
          Nothing to import here. Open the share link again, or add a key in <a href="#/settings">Settings</a>.
        </p>
      </main>
    );
  }

  const accept = async () => {
    setState({ kind: "working" });
    try {
      const key = await redeemShare(token);
      setApiKey(key);
      let detail = "You're ready to read recipes.";
      try {
        const info = await checkKey(key);
        if (typeof info.limitRemaining === "number") detail = `$${info.limitRemaining.toFixed(2)} of credit left on it.`;
      } catch {
        detail = "OpenRouter didn't accept it, though. Ask the sender to check the key.";
      }
      setState({ kind: "done", detail });
    } catch (e) {
      setState({
        kind: "failed",
        message:
          e instanceof PasteGone
            ? "This link has already been used or has expired. Ask for a new one."
            : "Couldn't read the link. Check your connection and try again.",
      });
    }
  };

  return (
    <main class="page">
      <h1 class="map-title">Set up Cookline</h1>

      {state.kind === "ask" && (
        <>
          <p>Someone shared their OpenRouter key so you can turn recipe photos into maps. Save it on this device?</p>
          {replacing && <p class="note">This replaces the key already saved here.</p>}
          <div class="field-row">
            <button type="button" class="button primary" onClick={accept}>
              Save key
            </button>
            <a class="button" href="#/">
              No thanks
            </a>
          </div>
        </>
      )}
      {state.kind === "working" && (
        <p class="status" role="status">
          Saving key…
        </p>
      )}
      {state.kind === "done" && (
        <>
          <p class="status" role="status">
            Key saved.
          </p>
          <p class="note">{state.detail}</p>
          <a class="button primary" href="#/new">
            Read a recipe
          </a>
        </>
      )}
      {state.kind === "failed" && (
        <>
          <p role="alert">{state.message}</p>
          <a class="button" href="#/">
            Go to Cookline
          </a>
        </>
      )}
    </main>
  );
}
