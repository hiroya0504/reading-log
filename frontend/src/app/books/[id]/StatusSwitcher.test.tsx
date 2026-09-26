import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { StatusSwitcher } from "./StatusSwitcher";
import type { BookFormAction } from "../../BookForm";

describe("StatusSwitcher", () => {
  it("marks the current status as pressed and the others as not", () => {
    render(<StatusSwitcher action={vi.fn()} current="READING" />);

    expect(screen.getByRole("button", { name: "読書中" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "読みたい" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByRole("button", { name: "読了" })).toHaveAttribute("aria-pressed", "false");
  });

  it("sends the status of the button that was pressed", async () => {
    const action = vi.fn<BookFormAction>(async () => ({ status: "success" }));
    render(<StatusSwitcher action={action} current="READING" />);

    await userEvent.click(screen.getByRole("button", { name: "読了" }));

    await waitFor(() => expect(action).toHaveBeenCalledOnce());
    expect(action.mock.calls[0][1].get("status")).toBe("DONE");
  });

  it("shows the failure message", async () => {
    const action = vi.fn<BookFormAction>(async () => ({
      status: "error",
      message: "book 7 not found",
    }));
    render(<StatusSwitcher action={action} current="READING" />);

    await userEvent.click(screen.getByRole("button", { name: "読了" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("book 7 not found");
  });
});
