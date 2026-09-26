/**
 * Class strings shared by every screen, so a button or field looks the same wherever it is used.
 * Colours come from the tokens in globals.css.
 */
export const buttonPrimary =
  "inline-flex h-11 items-center justify-center rounded bg-accent px-5 text-[15px] font-medium text-on-accent hover:bg-accent-strong disabled:opacity-50";

export const buttonSecondary =
  "inline-flex h-10 items-center justify-center rounded border border-line bg-transparent px-4 text-sm text-ink hover:bg-card disabled:opacity-50";

export const fieldLabel = "flex flex-col gap-1.5 text-[13px] text-muted";

export const fieldInput =
  "h-11 rounded border border-line bg-field px-3 text-base text-ink focus:border-accent focus:outline-none";

export const sectionHeading = "font-serif text-xl font-bold";

export const card = "rounded-md border border-line bg-card";
