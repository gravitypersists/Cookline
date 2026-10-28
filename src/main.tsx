import { render } from "preact";
import { useEffect, useState } from "preact/hooks";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/transit.css";
import { fixtures } from "../fixtures";
import { Library } from "./ui/Library";
import { Settings } from "./ui/Settings";
import { Capture } from "./ui/Capture";
import { MapView } from "./ui/MapView";
import { RecipeView } from "./ui/RecipeView";
import { TopBar } from "./ui/TopBar";
import { applyStoredTheme } from "./ui/ThemeSwitch";
import { Import } from "./ui/Import";
import { parseShareHash } from "./share/share";
import { registerSW } from "virtual:pwa-register";

applyStoredTheme();

// Offline support and installability; updates apply on the next launch.
registerSW({ immediate: true });

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
  | { name: "recipe"; id: string }
  | { name: "import" };

function parse(hash: string): Route {
  const fixture = hash.match(/^#\/fixture\/(.+)$/)?.[1];
  if (fixture && fixture in fixtures) return { name: "fixture", id: fixture };
  if (hash === "#/new") return { name: "new" };
  if (hash === "#/settings") return { name: "settings" };
  const recipe = hash.match(/^#\/recipe\/([\w-]+)$/)?.[1];
  if (recipe) return { name: "recipe", id: recipe };
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

function App() {
  const route = useRoute();
  return (
    <>
      {["new", "settings", "import"].includes(route.name) && <TopBar />}
      {route.name === "home" && <Library />}
      {route.name === "new" && <Capture />}
      {route.name === "settings" && <Settings />}
      {route.name === "fixture" && <MapView key={route.id} graph={fixtures[route.id]!} />}
      {route.name === "recipe" && <RecipeView key={route.id} id={route.id} />}
      {route.name === "import" && <Import token={shareToken} />}
    </>
  );
}

render(<App />, document.getElementById("app")!);
