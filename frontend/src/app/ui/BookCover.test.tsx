import { isInaccessible, render, screen } from "@testing-library/react";
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
      <BookCover
        book={{ id: 1, title: "リファクタリング", author: "Martin Fowler", coverUrl: null }}
        size="md"
      />,
    );

    expect(screen.getByText("リファクタリング")).toBeInTheDocument();
    expect(screen.getByText("Martin Fowler")).toBeInTheDocument();
  });

  // The title is always printed beside the cover or named by the link around it.
  it("is hidden from assistive technology so the title is not read twice", () => {
    render(
      <BookCover
        book={{ id: 1, title: "リファクタリング", author: null, coverUrl: null }}
        size="md"
      />,
    );

    expect(isInaccessible(screen.getByText("リファクタリング"))).toBe(true);
  });

  it("leaves the author off the small cover, where it would not fit", () => {
    render(
      <BookCover
        book={{ id: 1, title: "リファクタリング", author: "Martin Fowler", coverUrl: null }}
        size="sm"
      />,
    );

    expect(screen.queryByText("Martin Fowler")).not.toBeInTheDocument();
  });

  it("shows the real cover instead of drawing one when the book has it", () => {
    render(
      <BookCover
        book={{
          id: 1,
          title: "リファクタリング",
          author: "Martin Fowler",
          coverUrl: "https://books.google.com/t",
        }}
        size="md"
      />,
    );

    expect(
      screen.getByRole("img", { hidden: true, name: "リファクタリング の表紙" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("リファクタリング")).not.toBeInTheDocument();
  });

  it("hides the real cover from assistive technology too", () => {
    render(
      <BookCover
        book={{ id: 1, title: "t", author: null, coverUrl: "https://books.google.com/t" }}
        size="sm"
      />,
    );

    expect(isInaccessible(screen.getByRole("img", { hidden: true, name: "t の表紙" }))).toBe(true);
  });
});
