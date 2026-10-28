import { render } from "preact";
import { useEffect, useMemo, useState } from "preact/hooks";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/transit.css";
import { fixtures } from "../fixtures";
import { plan } from "./schedule/plan";
import { buildMap } from "./layout/rows";
import { TransitMap } from "./ui/TransitMap";
import { ThemeSwitch, applyStoredTheme } from "./ui/ThemeSwitch";

applyStoredTheme();

// Hash routing (SPEC §2): #/fixture/<id>. Fixtures stand in for saved recipes
// until the library exists (milestone 4).
const fixtureFromHash = () => {
  const id = location.hash.match(/^#\/fixture\/(.+)$/)?.[1];
  return id && id in fixtures ? id : "curry";
};

function App() {
  const [id, setId] = useState(fixtureFromHash);
  useEffect(() => {
    const onHash = () => setId(fixtureFromHash());
    addEventListener("hashchange", onHash);
    return () => removeEventListener("hashchange", onHash);
  }, []);

  const map = useMemo(() => {
    const { graph, schedule } = plan(fixtures[id]!);
    return buildMap(graph, schedule);
  }, [id]);

  return (
    <>
      <TransitMap key={id} map={map} />
      <footer class="page footer">
        <select
          class="select"
          aria-label="Recipe"
          value={id}
          onChange={(e) => (location.hash = `#/fixture/${(e.target as HTMLSelectElement).value}`)}
        >
          {Object.entries(fixtures).map(([key, f]) => (
            <option value={key}>{f.title}</option>
          ))}
        </select>
        <ThemeSwitch />
      </footer>
    </>
  );
}

render(<App />, document.getElementById("app")!);
