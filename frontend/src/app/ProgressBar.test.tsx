import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProgressBar, progressPercent } from "./ProgressBar";

describe("progressPercent", () => {
  it("is the share of pages read", () => {
    expect(progressPercent(120, 300)).toBe(40);
  });

  it("rounds down so an unfinished book never reads as 100%", () => {
    expect(progressPercent(299, 300)).toBe(99);
  });

  it("is 100 only on the last page", () => {
    expect(progressPercent(300, 300)).toBe(100);
  });

  it("caps at 100 even if the page somehow exceeds the total", () => {
    expect(progressPercent(400, 300)).toBe(100);
  });
});

describe("ProgressBar", () => {
  it("exposes the percentage to assistive technology and as text", () => {
    render(<ProgressBar currentPage={120} totalPages={300} label="本の進捗" />);

    expect(screen.getByRole("progressbar", { name: "本の進捗" })).toHaveAttribute(
      "aria-valuenow",
      "40",
    );
    expect(screen.getByText("40%")).toBeInTheDocument();
  });
});
