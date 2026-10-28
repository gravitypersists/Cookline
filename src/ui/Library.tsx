import { useEffect, useState } from "preact/hooks";
import { fixtures } from "../../fixtures";
import { totalLabel } from "../format/time";
import type { RecipeGraph } from "../model/types";
import { plan } from "../schedule/plan";
import { getApiKey } from "../store/settings";
import { listRecipes, type RecipeRecord } from "../store/recipes";

function totalOf(graph: RecipeGraph): string {
  try {
    return totalLabel(plan(graph).schedule.total).toLowerCase();
  } catch {
    return "";
  }
}

const ago = (t: number) => {
  const days = Math.floor((Date.now() - t) / 86_400_000);
  if (days < 1) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  return new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

// Home (SPEC §3): saved recipes, newest first; works offline.
export function Library() {
  const [recipes, setRecipes] = useState<RecipeRecord[] | null>(null);
  const [failed, setFailed] = useState(false);
  const hasKey = getApiKey() !== "";

  useEffect(() => {
    listRecipes().then(setRecipes, () => setFailed(true));
  }, []);

  return (
    <main class="page">
      <header class="map-header">
        <h1 class="map-title">Cookline</h1>
      </header>

      <a class="button primary" href="#/new">
        New recipe
      </a>
      {!hasKey && (
        <p class="note">
          To read recipes, add your OpenRouter API key in <a href="#/settings">Settings</a>.
        </p>
      )}

      <section class="section">
        <h2 class="label">Your recipes</h2>
        {failed && <p class="note error">Couldn't open saved recipes on this device.</p>}
        {recipes?.length === 0 && (
          <p class="note">Nothing saved yet. Recipes you read are kept here, and work offline.</p>
        )}
        {recipes && recipes.length > 0 && (
          <ul class="list">
            {recipes.map((r) => (
              <li>
                <a class="card link-card recipe-card" href={`#/recipe/${r.id}`}>
                  <span>{r.graph.title}</span>
                  <span class="note">{[totalOf(r.graph), ago(r.createdAt)].filter(Boolean).join(" · ")}</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <details class="section examples">
        <summary class="label">Examples</summary>
        <ul class="list">
          {Object.entries(fixtures).map(([id, f]) => (
            <li>
              <a class="card link-card" href={`#/fixture/${id}`}>
                {f.title}
              </a>
            </li>
          ))}
        </ul>
      </details>

      <a class="button" href="#/settings">
        Settings
      </a>
    </main>
  );
}
