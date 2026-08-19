import { detectLocale, isArabicLanguage, normalizeForSearch, preferredLanguage } from "./i18n.ts";

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

describe("normalizeForSearch", () => {
  it("matches Arabic alef and tashkeel variants", () => {
    expect(normalizeForSearch("أحمد")).toBe(normalizeForSearch("احمد"));
    expect(normalizeForSearch("مَرْحَبًا")).toBe(normalizeForSearch("مرحبا"));
  });

  it("matches hamza on waw/yeh and extra spaces", () => {
    expect(normalizeForSearch("سؤال")).toBe(normalizeForSearch("سوال"));
    expect(normalizeForSearch("مسائل")).toBe(normalizeForSearch("مسايل"));
    expect(normalizeForSearch("hello  world")).toBe(normalizeForSearch("hello world"));
  });

  it("is case-insensitive for Latin letters", () => {
    expect(normalizeForSearch("School")).toBe(normalizeForSearch("school"));
    expect(normalizeForSearch("I")).toBe("i");
  });

  it("matches Farsi yeh/kaf, Arabic-Indic digits, and zero-width characters", () => {
    expect(normalizeForSearch("جديد")).toBe(normalizeForSearch("جدید"));
    expect(normalizeForSearch("كتاب")).toBe(normalizeForSearch("کتاب"));
    expect(normalizeForSearch("٢٠٢٤")).toBe(normalizeForSearch("2024"));
    expect(normalizeForSearch("۲۰۲۴")).toBe(normalizeForSearch("2024"));
    expect(normalizeForSearch("مر\u200cحبا")).toBe(normalizeForSearch("مرحبا"));
  });
});
