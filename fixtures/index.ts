import type { RecipeGraph } from "../src/model/types";
import curry from "./curry.json";
import tomatoSoup from "./tomato-soup.json";
import sausagePasta from "./sausage-pasta.json";
import focaccia from "./focaccia.json";
import chickenTacos from "./chicken-tacos.json";
import jammyEggs from "./jammy-eggs.json";
import garlicShrimp from "./garlic-shrimp.json";

// Hand-written recipe graphs (SPEC §9), each exercising a different shape.
export const fixtures: Record<string, RecipeGraph> = {
  curry: curry as RecipeGraph, // the mockup recipe; three lines
  "tomato-soup": tomatoSoup as RecipeGraph, // one pot, single line
  "sausage-pasta": sausagePasta as RecipeGraph, // two vessels
  focaccia: focaccia as RecipeGraph, // long passive stretches
  "chicken-tacos": chickenTacos as RecipeGraph, // nested merge: crema → slaw → tacos
  "jammy-eggs": jammyEggs as RecipeGraph, // an exact time
  "garlic-shrimp": garlicShrimp as RecipeGraph, // first step needs prep → inserted station
};
