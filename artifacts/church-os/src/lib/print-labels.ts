export type CheckInLabel = {
  childName: string;
  classroom: string | null;
  allergyInformation: string | null;
  medicalNotes: string | null;
  hasSpecialNeeds: boolean;
  pickupCode: string;
  checkinTime: string;
};

export type LabelSize = {
  id: string;
  label: string;
  width: string;
  height: string;
};

// Common label stock for the printers churches usually buy (DYMO, Brother, Zebra/Rollo).
export const LABEL_SIZES: LabelSize[] = [
  { id: "2.25x1.25in", label: "2.25 × 1.25 in (DYMO 30334, Zebra)", width: "2.25in", height: "1.25in" },
  { id: "3.5x1.125in", label: "3.5 × 1.125 in (DYMO 30252 address)", width: "3.5in", height: "1.125in" },
  { id: "62x29mm", label: "62 × 29 mm (Brother DK-1209)", width: "62mm", height: "29mm" },
  { id: "4x2in", label: "4 × 2 in (Zebra, Rollo)", width: "4in", height: "2in" },
];

const LABEL_SIZE_STORAGE_KEY = "churchos_label_size";

export function getSavedLabelSize(): LabelSize {
  try {
    const saved = localStorage.getItem(LABEL_SIZE_STORAGE_KEY);
    return LABEL_SIZES.find((size) => size.id === saved) ?? LABEL_SIZES[0];
  } catch {
    return LABEL_SIZES[0];
  }
}

export function saveLabelSize(sizeId: string) {
  try {
    localStorage.setItem(LABEL_SIZE_STORAGE_KEY, sizeId);
  } catch {
    // Storage can be unavailable (private mode); the default size still works.
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function labelDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function labelsHtml(label: CheckInLabel, size: LabelSize) {
  const alerts = [
    label.allergyInformation ? `Allergies: ${label.allergyInformation}` : null,
    label.medicalNotes ? `Medical: ${label.medicalNotes}` : null,
  ].filter((alert): alert is string => alert !== null);
  const date = labelDate(label.checkinTime);
  const name = escapeHtml(label.childName);
  const code = escapeHtml(label.pickupCode);

  // One child name tag and one matching parent stub, each on its own label.
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Check-in labels</title>
<style>
  @page { size: ${size.width} ${size.height}; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; color: #000; }
  .label { width: ${size.width}; height: ${size.height}; padding: 0.06in 0.09in; overflow: hidden;
    display: flex; flex-direction: column; justify-content: space-between; page-break-after: always; break-after: page; }
  .label:last-child { page-break-after: auto; break-after: auto; }
  .row { display: flex; justify-content: space-between; align-items: baseline; gap: 0.06in; }
  .name { font-size: 15pt; font-weight: 700; line-height: 1.05; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .meta { font-size: 7pt; }
  .alert { font-size: 7pt; font-weight: 700; background: #000; color: #fff; padding: 1px 3px;
    -webkit-print-color-adjust: exact; print-color-adjust: exact; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .flag { font-size: 7pt; font-weight: 700; border: 1px solid #000; padding: 0 3px; }
  .code { font-family: "Courier New", monospace; font-size: 13pt; font-weight: 700; letter-spacing: 1px; }
  .code-large { font-family: "Courier New", monospace; font-size: 22pt; font-weight: 700; letter-spacing: 3px; text-align: center; }
  .stub-title { font-size: 8pt; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; }
</style></head>
<body>
  <div class="label">
    <div class="name">${name}</div>
    <div>
      ${alerts.map((alert) => `<div class="alert">${escapeHtml(alert)}</div>`).join("")}
    </div>
    <div class="row">
      <span class="meta">${escapeHtml(label.classroom ?? "No classroom")} · ${escapeHtml(date)}</span>
      ${label.hasSpecialNeeds ? `<span class="flag">CARE</span>` : ""}
      <span class="code">${code}</span>
    </div>
  </div>
  <div class="label">
    <div class="row"><span class="stub-title">Parent pickup</span><span class="meta">${escapeHtml(date)}</span></div>
    <div class="code-large">${code}</div>
    <div class="meta">Show this to pick up ${name}</div>
  </div>
</body></html>`;
}

/** Prints the child name tag and parent pickup stub through a hidden iframe. */
export function printCheckInLabels(label: CheckInLabel, size: LabelSize = getSavedLabelSize()) {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.position = "fixed";
  frame.style.right = "0";
  frame.style.bottom = "0";
  frame.style.width = "0";
  frame.style.height = "0";
  frame.style.border = "0";
  document.body.appendChild(frame);

  const frameDocument = frame.contentDocument;
  const frameWindow = frame.contentWindow;
  if (!frameDocument || !frameWindow) {
    frame.remove();
    throw new Error("Printing is not available in this browser.");
  }

  frameDocument.open();
  frameDocument.write(labelsHtml(label, size));
  frameDocument.close();

  const cleanup = () => setTimeout(() => frame.remove(), 1000);
  frameWindow.addEventListener("afterprint", cleanup, { once: true });
  setTimeout(() => {
    frameWindow.focus();
    frameWindow.print();
    // Some browsers never fire afterprint; remove the frame regardless.
    setTimeout(() => frame.remove(), 60_000);
  }, 150);
}
