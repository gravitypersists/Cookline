import { render } from "preact";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/transit.css";
import curry from "../fixtures/curry.json";
import currySchedule from "../fixtures/curry.schedule.json";
import type { RecipeGraph, Schedule } from "./model/types";
import { buildMap } from "./layout/rows";
import { TransitMap } from "./ui/TransitMap";
import { ThemeSwitch, applyStoredTheme } from "./ui/ThemeSwitch";

applyStoredTheme();

const map = buildMap(curry as RecipeGraph, currySchedule as Schedule);

function App() {
  return (
    <>
      <TransitMap map={map} />
      <footer class="page" style={{ paddingTop: 0 }}>
        <ThemeSwitch />
      </footer>
    </>
  );
}

render(<App />, document.getElementById("app")!);
