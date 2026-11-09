import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { routeTree } from "@/routeTree.gen";
import { LEGAL_DOCUMENTS } from "@/routes/legal";

// Match routes without running loaders or rendering: loaders may need a server or
// network the test run lacks, and jsdom never loads the stylesheets React waits on.
describe("App routing", () => {
  it("matches a page for / instead of falling back to not found", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
    const matches = router.matchRoutes("/");
    expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
  });

  it("matches the legal center at /legal", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
    const matches = router.matchRoutes("/legal");
    expect(matches.at(-1)?.routeId).toBe("/legal");
  });

  it("exposes all seven legal documents with unique IDs and readable sections", () => {
    expect(LEGAL_DOCUMENTS).toHaveLength(7);
    expect(new Set(LEGAL_DOCUMENTS.map((document) => document.id)).size).toBe(7);
    for (const document of LEGAL_DOCUMENTS) {
      expect(document.title.length).toBeGreaterThan(5);
      expect(document.sections.length).toBeGreaterThan(0);
      expect(document.sections.every(([heading, body]) => heading.length > 0 && body.length > 40)).toBe(true);
    }
  });

  it("includes the official Telegram support destination in the legal documents", () => {
    expect(LEGAL_DOCUMENTS.some((document) => document.sections.some(([, body]) => body.includes("https://t.me/cloudysupport_t_bot")))).toBe(true);
  });
});
