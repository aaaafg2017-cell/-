import "@testing-library/jest-dom/vitest";

Object.defineProperty(navigator, "language", {
  configurable: true,
  get: () => "en-US",
});
