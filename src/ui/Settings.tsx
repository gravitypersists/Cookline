import { useEffect, useState } from "preact/hooks";
import { checkKey, listModels, type ModelInfo } from "../extract/openrouter";
import { DEFAULT_MODEL, getApiKey, getModel, setApiKey, setModel } from "../store/settings";
import { ThemeSwitch } from "./ThemeSwitch";

const price = (m: ModelInfo) => `$${m.promptPerM.toFixed(2)} in / $${m.completionPerM.toFixed(2)} out per M tokens`;

export function Settings() {
  const [key, setKey] = useState(getApiKey);
  const [showKey, setShowKey] = useState(false);
  const [keyStatus, setKeyStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [model, setModelState] = useState(getModel);
  const [models, setModels] = useState<ModelInfo[] | null>(null);
  const [modelsError, setModelsError] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    listModels(ctrl.signal).then(setModels, () => setModelsError(true));
    return () => ctrl.abort();
  }, []);

  const saveKey = (value: string) => {
    setKey(value);
    setApiKey(value);
    setKeyStatus(null);
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
          {keyStatus && <span class={keyStatus.ok ? "note" : "note error"}>{keyStatus.text}</span>}
        </div>
        <p class="note">
          Stored only on this device and sent only to openrouter.ai. You pay OpenRouter per recipe read (a fraction
          of a cent with the default model). Setting a credit limit on the key is a good idea.
        </p>
      </section>

      <section class="section">
        <label class="label" for="model">
          Model
        </label>
        {options ? (
          <select id="model" class="select" value={model} onChange={(e) => chooseModel((e.target as HTMLSelectElement).value)}>
            {options.map((m) => (
              <option value={m.id}>{m.id === DEFAULT_MODEL ? `${m.name} (default)` : m.name}</option>
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
        <p class="note">
          {selected ? price(selected) : "Only models that can read photos and follow a JSON schema are listed."}
          {model !== DEFAULT_MODEL && (
            <>
              {" · "}
              <button type="button" class="text-button" onClick={() => chooseModel(DEFAULT_MODEL)}>
                Use default
              </button>
            </>
          )}
        </p>
      </section>

      <section class="section">
        <span class="label">Theme</span>
        <ThemeSwitch />
      </section>
    </main>
  );
}
