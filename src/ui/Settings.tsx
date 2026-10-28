import { useEffect, useState } from "preact/hooks";
import { checkKey, listModels, type ModelInfo } from "../extract/openrouter";
import { RECOMMENDED_MODEL, clearApiKey, getApiKey, getModel, setApiKey, setModel } from "../store/settings";
import { costLabel, costSentence, estimateCost } from "../extract/cost";
import { ShareKey } from "./ShareKey";
import { ThemeSwitch } from "./ThemeSwitch";

// Recommended first, then cheapest per photo (the usual way in).
function byCost(models: ModelInfo[]): ModelInfo[] {
  return [...models].sort(
    (a, b) =>
      Number(b.id === RECOMMENDED_MODEL) - Number(a.id === RECOMMENDED_MODEL) ||
      estimateCost(a).photo - estimateCost(b).photo,
  );
}

// OpenRouter names read "Provider: Model"; the provider becomes the group.
const provider = (m: ModelInfo) => (m.name.includes(": ") ? m.name.split(": ")[0]! : "Other");
const shortName = (m: ModelInfo) => (m.name.includes(": ") ? m.name.slice(m.name.indexOf(": ") + 2) : m.name);
const optionLabel = (m: ModelInfo) => `${shortName(m)} · ${costLabel(estimateCost(m))}`;

// Recommended first, then one group per provider (alphabetical), cheapest first.
function groupModels(models: ModelInfo[]): [string, ModelInfo[]][] {
  const groups = new Map<string, ModelInfo[]>();
  for (const m of models) {
    const g = m.id === RECOMMENDED_MODEL ? "Recommended" : provider(m);
    groups.set(g, [...(groups.get(g) ?? []), m]);
  }
  return [...groups.entries()].sort(([a], [b]) =>
    a === "Recommended" ? -1 : b === "Recommended" ? 1 : a.localeCompare(b),
  );
}

export function Settings() {
  const [key, setKey] = useState(getApiKey);
  const [showKey, setShowKey] = useState(false);
  const [keyStatus, setKeyStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [model, setModelState] = useState(getModel);
  const [models, setModels] = useState<ModelInfo[] | null>(null);
  const [modelsError, setModelsError] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    listModels(ctrl.signal).then((m) => setModels(byCost(m)), () => setModelsError(true));
    return () => ctrl.abort();
  }, []);

  const saveKey = (value: string) => {
    setKey(value);
    setApiKey(value);
    setKeyStatus(null);
    setConfirmClear(false);
  };

  // Two taps to clear, so a stray tap doesn't lose the key.
  const [confirmClear, setConfirmClear] = useState(false);
  useEffect(() => {
    if (!confirmClear) return;
    const t = setTimeout(() => setConfirmClear(false), 4000);
    return () => clearTimeout(t);
  }, [confirmClear]);
  const clear = () => {
    if (!confirmClear) return setConfirmClear(true);
    clearApiKey();
    setKey("");
    setConfirmClear(false);
    setKeyStatus({ ok: true, text: "Key removed from this device." });
  };

  const test = async () => {
    setKeyStatus({ ok: true, text: "Checking…" });
    try {
      const info = await checkKey(key);
      const left =
        info.limitRemaining === null || info.limitRemaining === undefined
          ? "no credit limit set"
          : `$${info.limitRemaining.toFixed(2)} of credit left`;
      setKeyStatus({ ok: true, text: `Key works · ${left}` });
    } catch (e) {
      setKeyStatus({ ok: false, text: (e as Error).message });
    }
  };

  const chooseModel = (id: string) => {
    setModelState(id);
    setModel(id);
  };

  const keyInput = {
    id: "key",
    class: "input",
    autocomplete: "off",
    spellcheck: false,
    placeholder: "sk-or-…",
    value: key,
    onInput: (e: Event) => saveKey((e.target as HTMLInputElement).value),
  };

  const options = models;
  const selected = models?.find((m) => m.id === model);

  return (
    <main class="page">
      <h1 class="map-title">Settings</h1>

      <section class="panel">
        <label class="panel-title" for="key">
          OpenRouter key
        </label>
        <div class="field-row">
          {showKey ? <input type="text" {...keyInput} /> : <input type="password" {...keyInput} />}
          <button type="button" class="button" onClick={() => setShowKey(!showKey)}>
            {showKey ? "Hide" : "Show"}
          </button>
        </div>
        <div class="field-row">
          <button type="button" class="button" disabled={!key} onClick={test}>
            Test key
          </button>
          {key && (
            <button type="button" class="button" onClick={clear}>
              {confirmClear ? "Tap again to clear" : "Clear key"}
            </button>
          )}
        </div>
        {keyStatus && (
          <p class={keyStatus.ok ? "note" : "note error"} role="status">
            {keyStatus.text}
          </p>
        )}
        <p class="note">
          Stored only on this device. It's sent to openrouter.ai to read recipes, and nowhere else unless you create a
          share link below.
        </p>
      </section>

      <section class="panel">
        <label class="panel-title" for="model">
          Model
        </label>
        {options ? (
          <select id="model" class="select" value={model} onChange={(e) => chooseModel((e.target as HTMLSelectElement).value)}>
            {!selected && <option value={model}>{model}</option>}
            {groupModels(options).map(([group, ms]) => (
              <optgroup label={group}>
                {ms.map((m) => (
                  <option value={m.id}>{optionLabel(m)}</option>
                ))}
              </optgroup>
            ))}
          </select>
        ) : (
          <input
            id="model"
            class="input"
            value={model}
            placeholder={modelsError ? "Couldn't load models; type an id" : "Loading models…"}
            onInput={(e) => chooseModel((e.target as HTMLInputElement).value)}
          />
        )}
        {selected && <p class="cost">{costSentence(estimateCost(selected))}</p>}
        <p class="note">
          {selected
            ? "Paid to OpenRouter per recipe read. A second pass to fix mistakes, when needed, roughly doubles it."
            : "Only models that can read photos and follow a JSON schema are listed."}
          {model !== RECOMMENDED_MODEL && (
            <>
              {" "}
              <button type="button" class="text-button" onClick={() => chooseModel(RECOMMENDED_MODEL)}>
                Use the recommended model
              </button>
            </>
          )}
        </p>
      </section>

      <ShareKey apiKey={key} />

      <section class="panel">
        <span class="panel-title">Appearance</span>
        <ThemeSwitch />
      </section>
    </main>
  );
}
