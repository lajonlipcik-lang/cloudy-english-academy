import { describe, expect, it } from "vitest";
import { createCloudyRegionBlockedResponse, isCloudyRegionBlocked } from "./region-access";

const edgeHeaders = {
  "cf-ipcountry": "KG",
  "cf-connecting-ip": "203.0.113.10",
  "cf-ray": "abc123-FRA",
};

describe("Cloudy regional access gate", () => {
  it("blocks requests identified as coming from Russia", () => {
    const request = new Request("https://cloudy.example/", {
      headers: { ...edgeHeaders, "cf-ipcountry": "RU" },
    });
    expect(isCloudyRegionBlocked(request)).toBe(true);
  });

  it("allows requests from another country when the Cloudflare country header is present", () => {
    const request = new Request("https://cloudy.example/", { headers: edgeHeaders });
    expect(isCloudyRegionBlocked(request)).toBe(false);
  });

  it("fails closed when country metadata is missing or unknown", () => {
    expect(isCloudyRegionBlocked(new Request("https://cloudy.example/", {
      headers: { ...edgeHeaders, "cf-ipcountry": "XX" },
    }))).toBe(true);
    expect(isCloudyRegionBlocked(new Request("https://cloudy.example/", {
      headers: { ...edgeHeaders, "cf-ipcountry": "T1" },
    }))).toBe(true);
  });

  it("fails closed when country metadata is missing", () => {
    expect(isCloudyRegionBlocked(new Request("https://cloudy.example/"))).toBe(true);
  });

  it("keeps the legal center and brand assets available on the blocked screen", () => {
    const imageRequest = new Request("https://cloudy.example/cloudy-icon.png");
    const legalRequest = new Request("https://cloudy.example/legal", {
      headers: { ...edgeHeaders, "cf-ipcountry": "RU" },
    });
    const legalWithoutCountry = new Request("https://cloudy.example/legal");
    expect(isCloudyRegionBlocked(imageRequest)).toBe(false);
    expect(isCloudyRegionBlocked(legalRequest)).toBe(false);
    expect(isCloudyRegionBlocked(legalWithoutCountry)).toBe(false);
  });

  it("blocks application routes and APIs for the restricted region", () => {
    const request = new Request("https://cloudy.example/api/account", {
      headers: { ...edgeHeaders, "cf-ipcountry": "RU" },
    });
    expect(isCloudyRegionBlocked(request)).toBe(true);
  });

  it("renders the animated Cloudy mascot without the old status badge and with a working legal link", async () => {
    const response = createCloudyRegionBlockedResponse();
    const html = await response.text();
    expect(response.status).toBe(403);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(html).toContain('class="cloud-mascot"');
    expect(html).toContain("@keyframes cloudBlink");
    expect(html).not.toContain("ДОСТУП ОГРАНИЧЕН");
    expect(html).not.toContain('class="logo"');
    expect(html).toContain('href="/legal">Документы и доступность по странам</a>');
    expect(html).toContain("https://t.me/cloudysupportt_bot");
    expect(html).not.toContain("border: 1px solid");
    expect(html).not.toContain("<hr");
  });

  it("allows local development without edge headers", () => {
    expect(isCloudyRegionBlocked(new Request("http://localhost:3000/"))).toBe(false);
  });
});
