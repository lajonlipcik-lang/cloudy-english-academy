import { describe, expect, it } from "vitest";
import { isCloudyRegionBlocked } from "./region-access";

describe("Cloudy regional access gate", () => {
  it("blocks requests identified as coming from Russia", () => {
    const request = new Request("https://cloudy.example/");
    Object.defineProperty(request, "headers", {
      value: new Headers({ "cf-ipcountry": "RU" }),
    });
    expect(isCloudyRegionBlocked(request)).toBe(true);
  });

  it("allows requests from other countries", () => {
    const request = new Request("https://cloudy.example/", {
      headers: { "cf-ipcountry": "KG" },
    });
    expect(isCloudyRegionBlocked(request)).toBe(false);
  });

  it("fails open when the edge country header is missing or unknown", () => {
    expect(isCloudyRegionBlocked(new Request("https://cloudy.example/"))).toBe(false);
    expect(isCloudyRegionBlocked(new Request("https://cloudy.example/", {
      headers: { "cf-ipcountry": "XX" },
    }))).toBe(false);
  });

  it("keeps the Cloudy mascot image available on the blocked screen", () => {
    const imageRequest = new Request("https://cloudy.example/cloudy-icon.png", {
      headers: { "cf-ipcountry": "RU" },
    });
    expect(isCloudyRegionBlocked(imageRequest)).toBe(false);
  });

  it("blocks application routes and APIs for the restricted region", () => {
    const request = new Request("https://cloudy.example/api/account", {
      headers: { "cf-ipcountry": "RU" },
    });
    expect(isCloudyRegionBlocked(request)).toBe(true);
  });
});
