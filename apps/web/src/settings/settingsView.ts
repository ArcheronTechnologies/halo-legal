import type { Settings } from "@halo-pulse/types";

export interface SettingsScreenElements {
  retentionDaysInput: HTMLInputElement;
  sensitivityInput: HTMLInputElement;
  themeSelect: HTMLSelectElement;
  saveBtn: HTMLButtonElement;
  saveStatus: HTMLElement;
  exportJsonBtn: HTMLButtonElement;
  exportCsvBtn: HTMLButtonElement;
  deleteAllBtn: HTMLButtonElement;
  revokeConsentBtn: HTMLButtonElement;
}

export function getSettingsScreenElements(root: ParentNode): SettingsScreenElements {
  const retentionDaysInput = root.querySelector<HTMLInputElement>("#retentionDaysInput");
  const sensitivityInput = root.querySelector<HTMLInputElement>("#sensitivityInput");
  const themeSelect = root.querySelector<HTMLSelectElement>("#themeSelect");
  const saveBtn = root.querySelector<HTMLButtonElement>("#settingsSaveBtn");
  const saveStatus = root.querySelector<HTMLElement>("#settingsSaveStatus");
  const exportJsonBtn = root.querySelector<HTMLButtonElement>("#exportJsonBtn");
  const exportCsvBtn = root.querySelector<HTMLButtonElement>("#exportCsvBtn");
  const deleteAllBtn = root.querySelector<HTMLButtonElement>("#deleteAllBtn");
  const revokeConsentBtn = root.querySelector<HTMLButtonElement>("#revokeConsentBtn");
  if (
    !retentionDaysInput ||
    !sensitivityInput ||
    !themeSelect ||
    !saveBtn ||
    !saveStatus ||
    !exportJsonBtn ||
    !exportCsvBtn ||
    !deleteAllBtn ||
    !revokeConsentBtn
  ) {
    throw new Error(
      "getSettingsScreenElements: settings screen markup is missing an expected element",
    );
  }
  return {
    retentionDaysInput,
    sensitivityInput,
    themeSelect,
    saveBtn,
    saveStatus,
    exportJsonBtn,
    exportCsvBtn,
    deleteAllBtn,
    revokeConsentBtn,
  };
}

export function renderSettingsForm(elements: SettingsScreenElements, settings: Settings): void {
  elements.retentionDaysInput.value = String(settings.retentionDays);
  elements.sensitivityInput.value = String(settings.sensitivity);
  elements.themeSelect.value = settings.theme;
}

/** Reads the form back into a settings patch — pure enough to unit test without touching the DOM
 * event wiring, which stays in main.ts alongside every other screen's button handlers. */
export function readSettingsForm(
  elements: Pick<SettingsScreenElements, "retentionDaysInput" | "sensitivityInput" | "themeSelect">,
): Pick<Settings, "retentionDays" | "sensitivity" | "theme"> {
  const theme = elements.themeSelect.value;
  return {
    retentionDays: Math.max(1, Math.round(Number(elements.retentionDaysInput.value) || 90)),
    sensitivity: Math.min(1, Math.max(0, Number(elements.sensitivityInput.value) || 0.5)),
    theme: theme === "light" || theme === "dark" ? theme : "system",
  };
}
