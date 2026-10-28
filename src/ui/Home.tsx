import { fixtures } from "../../fixtures";
import { getApiKey } from "../store/settings";
import { loadLast } from "../store/last";

export function Home() {
  const last = loadLast();
  const hasKey = getApiKey() !== "";

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

      {last && (
        <section class="section">
          <h2 class="label">Last read</h2>
          <a class="card link-card" href="#/recipe/last">
            {last.graph.title}
          </a>
        </section>
      )}

      <section class="section">
        <h2 class="label">Examples</h2>
        <ul class="list">
          {Object.entries(fixtures).map(([id, f]) => (
            <li>
              <a class="card link-card" href={`#/fixture/${id}`}>
                {f.title}
              </a>
            </li>
          ))}
        </ul>
      </section>

      <a class="button" href="#/settings">
        Settings
      </a>
    </main>
  );
}
