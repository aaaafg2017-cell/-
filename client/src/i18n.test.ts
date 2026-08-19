import { detectLocale, isArabicLanguage, preferredLanguage } from "./i18n.ts";

describe("detectLocale", () => {
  it("uses Arabic for ar and ar-* tags", () => {
    expect(detectLocale("ar")).toBe("ar");
    expect(detectLocale("ar-SA")).toBe("ar");
    expect(detectLocale("ar_EG")).toBe("ar");
  });

  it("does not treat other languages that start with ar as Arabic", () => {
    expect(isArabicLanguage("arn-CL")).toBe(false);
    expect(detectLocale("arn-CL")).toBe("en");
  });

  it("prefers navigator.languages[0] over navigator.language", () => {
    const nav = {
      language: "en-US",
      languages: ["ar-SA", "en-US"],
    } as Pick<Navigator, "language" | "languages">;
    expect(preferredLanguage(nav)).toBe("ar-SA");
    expect(detectLocale(preferredLanguage(nav))).toBe("ar");
  });
});
