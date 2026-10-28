import { describe, expect, it } from "vitest";
import { costLabel, costSentence, estimateCost, formatCost } from "./cost";

const haiku = { id: "anthropic/claude-haiku-5.5", name: "Claude Haiku 5.5", promptPerM: 0.1, completionPerM: 0.5 };
const flash = { id: "google/gemini-3.7-flash", name: "Gemini 3.7 Flash", promptPerM: 0.75, completionPerM: 3.75, imagePerM: 0.75 };
const free = { id: "x/free", name: "Free", promptPerM: 0, completionPerM: 0 };

describe("cost estimates", () => {
  it("are a fraction of a cent for the recommended model", () => {
    const e = estimateCost(haiku);
    expect(e.text).toBeGreaterThan(0.0005);
    expect(e.text).toBeLessThan(0.003);
    expect(e.photo).toBeGreaterThan(e.text); // a photo is more input tokens than pasted text
  });

  it("price photos by the model family's image tokens", () => {
    const openai = estimateCost({ ...haiku, id: "openai/x" });
    expect(openai.photo).toBeLessThan(estimateCost(haiku).photo);
  });

  it("format compactly", () => {
    expect(formatCost(0.00113)).toBe("0.11¢");
    expect(formatCost(0.0086)).toBe("0.86¢");
    expect(formatCost(0.001)).toBe("0.1¢");
    expect(formatCost(0.023)).toBe("2.3¢");
    expect(formatCost(0.12)).toBe("12¢");
    expect(formatCost(12.5)).toBe("1,250¢");
    expect(formatCost(0)).toBe("free");
  });

  it("show one number when text and photo round the same, two when they don't", () => {
    expect(costLabel({ text: 0.00111, photo: 0.00113 })).toBe("~0.11¢");
    expect(costLabel(estimateCost(flash))).toMatch(/^~0\.\d\d¢ text · 0\.\d\d¢ photo$/);
    expect(costSentence({ text: 0.00111, photo: 0.00113 })).toBe("About 0.11¢ per recipe, from text or a photo.");
    expect(costSentence({ text: 0.0085, photo: 0.0092 })).toBe("About 0.85¢ per recipe from text, 0.92¢ from a photo.");
    expect(costSentence(estimateCost(free))).toBe("Free to use.");
    expect(costLabel(estimateCost(free))).toBe("free");
  });
});
