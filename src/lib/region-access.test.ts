import { describe, expect, it } from "vitest";
import { isCloudyRegionBlocked } from "./region-access";

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

  it("allows requests from another country when Cloudflare edge metadata is present", () => {
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

  it("fails closed when Cloudflare edge metadata is missing", () => {
    expect(isCloudyRegionBlocked(new Request("https://cloudy.example/", {
      headers: { "cf-ipcountry": "KG" },
    }))).toBe(true);
    expect(isCloudyRegionBlocked(new Request("https://cloudy.example/"))).toBe(true);
  });

  it("keeps brand assets available on the blocked screen", () => {
    const imageRequest = new Request("https://cloudy.example/cloudy-icon.png");
    expect(isCloudyRegionBlocked(imageRequest)).toBe(false);
  });

  it("blocks application routes and APIs for the restricted region", () => {
    const request = new Request("https://cloudy.example/api/account", {
      headers: { ...edgeHeaders, "cf-ipcountry": "RU" },
    });
    expect(isCloudyRegionBlocked(request)).toBe(true);
  });

  it("allows local development without edge headers", () => {
    expect(isCloudyRegionBlocked(new Request("http://localhost:3000/"))).toBe(false);
  });
});
