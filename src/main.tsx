import { render } from "preact";
import { useEffect, useMemo, useState } from "preact/hooks";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/transit.css";
import { fixtures } from "../fixtures";
import type { RecipeGraph } from "./model/types";
import { plan } from "./schedule/plan";
import { buildMap } from "./layout/rows";
import { loadLast } from "./store/last";
import { TransitMap } from "./ui/TransitMap";
import { Home } from "./ui/Home";
import { Settings } from "./ui/Settings";
import { Capture } from "./ui/Capture";
import { applyStoredTheme } from "./ui/ThemeSwitch";
import { Import } from "./ui/Import";
import { parseShareHash } from "./share/share";

applyStoredTheme();

// A share link carries a one-time secret in the fragment. Take it, then
// replace the URL so the secret doesn't linger in history or bookmarks.
const shareToken = parseShareHash(location.hash);
if (shareToken) history.replaceState(null, "", `${location.pathname}${location.search}#/import`);

// Hash routing (SPEC §2), since GitHub Pages has no server rewrites.
type Route =
  | { name: "home" }
  | { name: "new" }
  | { name: "settings" }
  | { name: "fixture"; id: string }
  | { name: "last" }
  | { name: "import" };

function parse(hash: string): Route {
  const fixture = hash.match(/^#\/fixture\/(.+)$/)?.[1];
  if (fixture && fixture in fixtures) return { name: "fixture", id: fixture };
  if (hash === "#/new") return { name: "new" };
  if (hash === "#/settings") return { name: "settings" };
  if (hash === "#/recipe/last") return { name: "last" };
  if (hash === "#/import") return { name: "import" };
  return { name: "home" };
}

function useRoute(): Route {
  const [route, setRoute] = useState(() => parse(location.hash));
  useEffect(() => {
    const onHash = () => {
      setRoute(parse(location.hash));
      scrollTo(0, 0);
    };
    addEventListener("hashchange", onHash);
    return () => removeEventListener("hashchange", onHash);
  }, []);
  return route;
}

function MapView({ graph, children }: { graph: RecipeGraph; children?: preact.ComponentChildren }) {
  const map = useMemo(() => {
    const { graph: planned, schedule } = plan(graph);
    return buildMap(planned, schedule);
  }, [graph]);
  return (
    <>
      <TransitMap map={map} />
      {children}
    </>
  );
}

function LastRecipe() {
  const last = useMemo(loadLast, []);
  if (!last) {
    location.hash = "#/";
    return null;
  }
  const cost = last.cost !== undefined ? ` · $${last.cost.toFixed(4)}` : "";
  return (
    <MapView graph={last.graph}>
      <footer class="page meta">
        {last.warnings.length > 0 && (
          <ul class="note">
            {last.warnings.map((w) => (
              <li>{w}</li>
            ))}
          </ul>
        )}
        <p class="note">
          Read by {last.model}
          {cost}
          {last.repaired && " · fixed on a second pass"}
        </p>
      </footer>
    </MapView>
  );
}

function App() {
  const route = useRoute();
  return (
    <>
      {route.name !== "home" && (
        <nav class="topbar">
          <a href="#/">‹ Recipes</a>
        </nav>
      )}
      {route.name === "home" && <Home />}
      {route.name === "new" && <Capture />}
      {route.name === "settings" && <Settings />}
      {route.name === "fixture" && <MapView key={route.id} graph={fixtures[route.id]!} />}
      {route.name === "last" && <LastRecipe />}
      {route.name === "import" && <Import token={shareToken} />}
    </>
  );
}

render(<App />, document.getElementById("app")!);
