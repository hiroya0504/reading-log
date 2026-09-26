import type { BookStatus } from "@/lib/api/books";

/** In the order the shelf filter and the status switcher show them. */
export const STATUSES: BookStatus[] = ["READING", "WANT_TO_READ", "DONE"];

export const STATUS_LABELS: Record<BookStatus, string> = {
  WANT_TO_READ: "読みたい",
  READING: "読書中",
  DONE: "読了",
};

export const STATUS_CHIP_CLASSES: Record<BookStatus, string> = {
  WANT_TO_READ: "bg-chip-want text-on-chip-want",
  READING: "bg-chip-reading text-on-chip-reading",
  DONE: "bg-ink text-paper",
};

/** In reading order, for the switcher on a book's page. */
export const STATUS_FLOW: BookStatus[] = ["WANT_TO_READ", "READING", "DONE"];
