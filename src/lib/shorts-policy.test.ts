import { describe, expect, it } from "vitest";
import { blocksShortPublication, isShortPublished } from "./shorts-policy";
describe("Shorts publication rules", () => {
  for (const label of ["pornography", "sexual_nudity", "sexual_act"]) {
    it(`keeps explicit ${label} private`, () => expect(blocksShortPublication({decision:"reject",confidence:0.99,labels:[label]})).toBe(true));
  }
  for (const label of ["offtopic", "profanity", "violence", "no_english", "nudity"]) {
    it(`does not block ${label}`, () => expect(blocksShortPublication({decision:"reject",confidence:1,labels:[label]})).toBe(false));
  }
  it("publishes uncertainty", () => expect(blocksShortPublication({decision:"review",confidence:0.99,labels:["sexual_act"]})).toBe(false));
  it("does not block low-confidence sexual flags", () => expect(blocksShortPublication({decision:"reject",confidence:0.5,labels:["sexual_act"]})).toBe(false));
  it("publishes unavailable analysis", () => expect(blocksShortPublication({decision:"review",confidence:0,labels:[]})).toBe(false));
  it("includes published human-review videos", () => expect(isShortPublished({status:"approved",published_at:"2026-11-06"})).toBe(true));
  it("excludes hidden videos", () => expect(isShortPublished({status:"hidden",published_at:"2026-11-06"})).toBe(false));
  it("excludes unfinalized rows", () => expect(isShortPublished({status:"approved",published_at:null})).toBe(false));
});