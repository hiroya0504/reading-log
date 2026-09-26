import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ProgressForm } from "./ProgressForm";
import type { Book } from "@/lib/api/books";

function book(overrides: Partial<Book> = {}): Book {
  return {
    id: 1,
    title: "t",
    author: null,
    isbn: null,
    totalPages: 300,
    currentPage: 120,
    status: "READING",
    ...overrides,
  };
}

describe("ProgressForm", () => {
  it("starts from the recorded page and shows the progress against the total", () => {
    render(<ProgressForm action={vi.fn()} book={book()} />);

    expect(screen.getByLabelText("今読んでいるページ")).toHaveValue(120);
    expect(screen.getByText("/ 300 ページ")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "40");
  });

  it("explains the missing bar when there is no total", () => {
    render(<ProgressForm action={vi.fn()} book={book({ totalPages: null })} />);

    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.getByText(/総ページ数を登録すると/)).toBeInTheDocument();
  });

  it("submits the entered page", async () => {
    const action = vi.fn().mockResolvedValue({ status: "success" });
    render(<ProgressForm action={action} book={book()} />);

    const input = screen.getByLabelText("今読んでいるページ");
    await userEvent.clear(input);
    await userEvent.type(input, "150");
    await userEvent.click(screen.getByRole("button", { name: "記録する" }));

    await waitFor(() => expect(action).toHaveBeenCalledOnce());
    const formData = action.mock.calls[0][1] as FormData;
    expect(formData.get("currentPage")).toBe("150");
    expect(await screen.findByRole("status")).toHaveTextContent("記録しました。");
  });

  it("shows the failure message", async () => {
    const action = vi.fn().mockResolvedValue({
      status: "error",
      message: "currentPage must not exceed totalPages (300)",
    });
    render(<ProgressForm action={action} book={book()} />);

    await userEvent.click(screen.getByRole("button", { name: "記録する" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("must not exceed totalPages");
  });
});
