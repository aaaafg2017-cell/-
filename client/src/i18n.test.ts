import { describe, expect, it } from "vitest";
import { detectLocale } from "./i18n.ts";

describe("detectLocale", () => {
  it("uses Arabic for ar and ar-* tags", () => {
    Object.defineProperty(navigator, "language", {
      configurable: true,
      value: "ar",
    });
    expect(detectLocale()).toBe("ar");

    Object.defineProperty(navigator, "language", {
      configurable: true,
      value: "ar-SA",
    });
    expect(detectLocale()).toBe("ar");
  });

  it("does not treat other languages that start with ar as Arabic", () => {
    Object.defineProperty(navigator, "language", {
      configurable: true,
      value: "arn-CL",
    });
    expect(detectLocale()).toBe("en");
  });
});
