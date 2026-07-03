import { describe, expect, it } from "vitest";
import { readSettingsForm } from "./settingsView.js";

function formElements(retentionDays: string, sensitivity: string, theme: string) {
  return {
    retentionDaysInput: { value: retentionDays } as HTMLInputElement,
    sensitivityInput: { value: sensitivity } as HTMLInputElement,
    themeSelect: { value: theme } as HTMLSelectElement,
  };
}

describe("readSettingsForm", () => {
  it("parses well-formed input straight through", () => {
    expect(readSettingsForm(formElements("30", "0.7", "dark"))).toEqual({
      retentionDays: 30,
      sensitivity: 0.7,
      theme: "dark",
    });
  });

  it("rounds a fractional retentionDays", () => {
    expect(readSettingsForm(formElements("30.6", "0.5", "system")).retentionDays).toBe(31);
  });

  it("clamps sensitivity above 1 down to 1", () => {
    expect(readSettingsForm(formElements("90", "1.5", "system")).sensitivity).toBe(1);
  });

  it("clamps sensitivity below 0 up to 0", () => {
    expect(readSettingsForm(formElements("90", "-0.3", "system")).sensitivity).toBe(0);
  });

  it("falls back to system for an unrecognized theme value", () => {
    expect(readSettingsForm(formElements("90", "0.5", "banana")).theme).toBe("system");
  });

  it("falls back to defaults for non-numeric input", () => {
    const result = readSettingsForm(formElements("abc", "xyz", "light"));
    expect(result.retentionDays).toBe(90);
    expect(result.sensitivity).toBe(0.5);
  });

  it("keeps a legitimate sensitivity of 0 rather than falling back to the default", () => {
    expect(readSettingsForm(formElements("90", "0", "system")).sensitivity).toBe(0);
  });

  it.each([
    "light",
    "dark",
    "system",
  ] as const)("passes through a valid theme value %s", (theme) => {
    expect(readSettingsForm(formElements("90", "0.5", theme)).theme).toBe(theme);
  });
});
