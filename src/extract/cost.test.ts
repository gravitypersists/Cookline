import { describe, expect, it } from "vitest";
import { costLabel, costSentence, estimateCost, formatCostShort, formatCostWords } from "./cost";

const haiku = { id: "anthropic/claude-haiku-5.5", name: "Claude Haiku 5.5", promptPerM: 0.1, completionPerM: 0.5 };
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

  it("write fractions of a cent as fractions, never as decimals", () => {
    expect(formatCostWords(0.0012)).toBe("an eighth of a cent");
    expect(formatCostWords(0.001)).toBe("a tenth of a cent");
    expect(formatCostWords(0.0044)).toBe("half a cent");
    expect(formatCostWords(0.0033)).toBe("a third of a cent");
    expect(formatCostWords(0.0072)).toBe("three-quarters of a cent");
    expect(formatCostWords(0.0005)).toBe("less than a tenth of a cent");
    expect(formatCostWords(0.0095)).toBe("1¢");
    expect(formatCostWords(0.023)).toBe("2¢");
    expect(formatCostWords(12.5)).toBe("1,250¢");
    expect(formatCostWords(0)).toBe("free");
    expect(formatCostShort(0.0012)).toBe("⅛¢");
    expect(formatCostShort(0.0044)).toBe("½¢");
    expect(formatCostShort(0.0005)).toBe("<⅒¢");
    expect(formatCostShort(0.12)).toBe("12¢");
  });

  it("show one figure when text and photo round the same, two when they don't", () => {
    expect(costLabel(estimateCost(haiku))).toBe("~⅛¢");
    expect(costSentence(estimateCost(haiku))).toBe("About an eighth of a cent per recipe, from text or a photo.");
    expect(costLabel({ text: 0.0085, photo: 0.0092 })).toBe("~¾¢ text · 1¢ photo");
    expect(costSentence({ text: 0.0085, photo: 0.0092 })).toBe(
      "About three-quarters of a cent per recipe from text, 1¢ from a photo.",
    );
    expect(costSentence(estimateCost(free))).toBe("Free to use.");
    expect(costLabel(estimateCost(free))).toBe("free");
  });
});
