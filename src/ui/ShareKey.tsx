import { useState } from "preact/hooks";
import { PRIVATEBIN } from "../share/privatebin";
import { createShareLink } from "../share/share";

type State =
  | { kind: "idle" }
  | { kind: "creating" }
  | { kind: "ready"; link: string; copied: boolean }
  | { kind: "failed"; message: string };

const appUrl = () => location.origin + location.pathname;

// Settings → Share: a one-time link that sets Cookline up on someone else's
// phone, with this device's key or one made just for them (SPEC §3).
export function ShareKey({ apiKey }: { apiKey: string }) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const [otherOpen, setOtherOpen] = useState(false);
  const [otherKey, setOtherKey] = useState("");

  const create = async (key: string) => {
    setState({ kind: "creating" });
    try {
      setState({ kind: "ready", link: await createShareLink(key.trim(), appUrl()), copied: false });
      setOtherKey("");
      setOtherOpen(false);
    } catch (e) {
      setState({ kind: "failed", message: (e as Error).message || "Couldn't create a link." });
    }
  };

  const copy = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      setState({ kind: "ready", link, copied: true });
    } catch {
      // Clipboard blocked: the link is selectable in the field.
    }
  };

  const share = (link: string) =>
    navigator.share({ title: "Cookline", text: "Set up Cookline:", url: link }).catch(() => {});

  const creating = state.kind === "creating";

  return (
    <section class="panel">
      <span class="panel-title">Share Cookline</span>
      <p class="note">
        Creates a link that sets Cookline up on someone else's phone. The key is encrypted on this device before it
        goes to{" "}
        <a href={PRIVATEBIN} target="_blank" rel="noreferrer">
          PrivateBin
        </a>
        , which stores it without being able to read it. Opening the link destroys the stored copy, so it works once.
        Unused links expire after a day.
      </p>

      {state.kind === "ready" && (
        <>
          <input
            class="input"
            readonly
            value={state.link}
            aria-label="Share link"
            onFocus={(e) => (e.target as HTMLInputElement).select()}
          />
          <div class="field-row">
            <button type="button" class="button primary" onClick={() => copy(state.link)}>
              {state.copied ? "Copied" : "Copy link"}
            </button>
            {"share" in navigator && (
              <button type="button" class="button" onClick={() => share(state.link)}>
                Share…
              </button>
            )}
          </div>
        </>
      )}

      <div class="field-row">
        <button type="button" class="button" disabled={!apiKey || creating} onClick={() => create(apiKey)}>
          {creating && !otherOpen ? "Creating…" : "Share my key"}
        </button>
        {!otherOpen && (
          <button type="button" class="button" disabled={creating} onClick={() => setOtherOpen(true)}>
            Share a new key
          </button>
        )}
      </div>

      {otherOpen && (
        <>
          <p class="note">
            Make a key for them in{" "}
            <a href="https://openrouter.ai/settings/keys" target="_blank" rel="noreferrer">
              OpenRouter
            </a>{" "}
            (a credit limit keeps it cheap if it leaks) and paste it here. It's only shared, not saved on this device.
          </p>
          <div class="field-row">
            <input
              class="input"
              type="password"
              autocomplete="off"
              spellcheck={false}
              placeholder="sk-or-…"
              aria-label="Key to share"
              value={otherKey}
              onInput={(e) => setOtherKey((e.target as HTMLInputElement).value)}
            />
          </div>
          <div class="field-row">
            <button type="button" class="button primary" disabled={!otherKey.trim() || creating} onClick={() => create(otherKey)}>
              {creating ? "Creating…" : "Create link"}
            </button>
            <button type="button" class="button" onClick={() => setOtherOpen(false)}>
              Cancel
            </button>
          </div>
        </>
      )}

      {state.kind === "failed" && <p class="note error">{state.message}</p>}
    </section>
  );
}
