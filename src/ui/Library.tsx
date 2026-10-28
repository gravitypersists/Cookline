import { useEffect, useState } from "preact/hooks";
import { fixtures } from "../../fixtures";
import { totalLabel } from "../format/time";
import type { RecipeGraph } from "../model/types";
import { plan } from "../schedule/plan";
import { getApiKey } from "../store/settings";
import { listRecipes, type RecipeRecord } from "../store/recipes";
import { Glyph } from "./Glyph";
import { Camera, ChevronRight, Cog } from "./icons";

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

function RecipeCard({ href, graph, meta }: { href: string; graph: RecipeGraph; meta: string }) {
  return (
    <a class="card link-card" href={href}>
      <Glyph graph={graph} />
      <span class="text">
        <span class="title">{graph.title}</span>
        <span class="note">{meta}</span>
      </span>
      <span class="chevron">
        <ChevronRight />
      </span>
    </a>
  );
}

// Home (SPEC §3): saved recipes, newest first; works offline.
export function Library() {
  const [recipes, setRecipes] = useState<RecipeRecord[] | null>(null);
  const [failed, setFailed] = useState(false);
  const hasKey = getApiKey() !== "";

  useEffect(() => {
    listRecipes().then(setRecipes, () => setFailed(true));
  }, []);

  const empty = recipes !== null && recipes.length === 0;

  return (
    <main class="page">
      <header class="stack">
        <div class="app-header">
          <h1 class="brand app-title">Cookline</h1>
          <a class="icon-button" href="#/settings" aria-label="Settings">
            <Cog />
          </a>
        </div>
        <p class="tagline">Recipes as transit maps: see what runs at once, and what to prep while you wait.</p>
      </header>

      <div class="stack">
        <a class="button primary wide" href="#/new">
          <Camera />
          New recipe
        </a>
        {!hasKey && (
          <p class="note">
            To read recipes, add your OpenRouter API key in <a href="#/settings">Settings</a>.
          </p>
        )}
      </div>

      <section class="section">
        <h2 class="label">Your recipes</h2>
        {failed && <p class="note error">Couldn't open saved recipes on this device.</p>}
        {empty && (
          <p class="empty">Nothing saved yet. Recipes you read are kept here and work offline. Try an example below.</p>
        )}
        {recipes && recipes.length > 0 && (
          <ul class="list">
            {recipes.map((r) => (
              <li key={r.id}>
                <RecipeCard
                  href={`#/recipe/${r.id}`}
                  graph={r.graph}
                  meta={[totalOf(r.graph), ago(r.createdAt)].filter(Boolean).join(" · ")}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {recipes !== null && (
        <details class="section examples" open={empty}>
          <summary class="label">Examples</summary>
          <ul class="list">
            {Object.entries(fixtures).map(([id, f]) => (
              <li key={id}>
                <RecipeCard href={`#/fixture/${id}`} graph={f} meta={totalOf(f)} />
              </li>
            ))}
          </ul>
        </details>
      )}
    </main>
  );
}
