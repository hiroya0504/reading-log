import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BookCover, COVER_COLORS, coverColor } from "./BookCover";

describe("coverColor", () => {
  it("gives the same book the same colour every time", () => {
    expect(coverColor(7)).toBe(coverColor(7));
  });

  it("wraps around the palette instead of running off its end", () => {
    expect(coverColor(COVER_COLORS.length)).toBe(COVER_COLORS[0]);
    expect(coverColor(COVER_COLORS.length - 1)).toBe(COVER_COLORS[COVER_COLORS.length - 1]);
  });
});

describe("BookCover", () => {
  it("prints the title and author on the cover", () => {
    render(
      <BookCover book={{ id: 1, title: "リファクタリング", author: "Martin Fowler" }} size="md" />,
    );

    expect(screen.getByText("リファクタリング")).toBeInTheDocument();
    expect(screen.getByText("Martin Fowler")).toBeInTheDocument();
  });

  it("leaves the author off the small cover, where it would not fit", () => {
    render(
      <BookCover book={{ id: 1, title: "リファクタリング", author: "Martin Fowler" }} size="sm" />,
    );

    expect(screen.queryByText("Martin Fowler")).not.toBeInTheDocument();
  });
});
