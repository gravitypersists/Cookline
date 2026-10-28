import { useEffect, useState } from "preact/hooks";
import { checkKey, listModels, type ModelInfo } from "../extract/openrouter";
import { RECOMMENDED_MODEL, clearApiKey, getApiKey, getModel, setApiKey, setModel } from "../store/settings";
import { costLabel, costSentence, estimateCost } from "../extract/cost";
import { ShareKey } from "./ShareKey";
import { ThemeSwitch } from "./ThemeSwitch";

const price = (m: ModelInfo) => `$${m.promptPerM.toFixed(2)} in / $${m.completionPerM.toFixed(2)} out per M tokens`;

// Recommended first, then cheapest per photo (the usual way in).
function byCost(models: ModelInfo[]): ModelInfo[] {
  return [...models].sort(
    (a, b) =>
      Number(b.id === RECOMMENDED_MODEL) - Number(a.id === RECOMMENDED_MODEL) ||
      estimateCost(a).photo - estimateCost(b).photo,
  );
}

const optionLabel = (m: ModelInfo) =>
  `${m.name}${m.id === RECOMMENDED_MODEL ? " (recommended)" : ""} · ${costLabel(estimateCost(m))}`;

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

  const options = models && !models.some((m) => m.id === model) ? [{ id: model, name: model } as ModelInfo, ...models] : models;
  const selected = models?.find((m) => m.id === model);

  return (
    <main class="page">
      <header class="map-header">
        <h1 class="map-title">Settings</h1>
      </header>

      <section class="section">
        <label class="label" for="key">
          OpenRouter API key
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
          {keyStatus && <span class={keyStatus.ok ? "note" : "note error"}>{keyStatus.text}</span>}
        </div>
        <p class="note">
          Stored only on this device. It's sent to openrouter.ai to read recipes, and nowhere else unless you create
          a share link below. You pay OpenRouter per recipe read (a fraction of a cent with the recommended model).
        </p>
      </section>

      <section class="section">
        <label class="label" for="model">
          Model
        </label>
        {options ? (
          <select id="model" class="select" value={model} onChange={(e) => chooseModel((e.target as HTMLSelectElement).value)}>
            {options.map((m) => (
              <option value={m.id}>{m.promptPerM === undefined ? m.name : optionLabel(m)}</option>
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
        {selected && (
          <p class="note">
            {costSentence(estimateCost(selected))} A second pass to fix mistakes, when needed, roughly doubles it.
          </p>
        )}
        <p class="note">
          {selected ? price(selected) : "Only models that can read photos and follow a JSON schema are listed."}
          {model !== RECOMMENDED_MODEL && (
            <>
              {" · "}
              <button type="button" class="text-button" onClick={() => chooseModel(RECOMMENDED_MODEL)}>
                Use recommended
              </button>
            </>
          )}
        </p>
      </section>

      <ShareKey apiKey={key} />

      <section class="section">
        <span class="label">Theme</span>
        <ThemeSwitch />
      </section>
    </main>
  );
}
