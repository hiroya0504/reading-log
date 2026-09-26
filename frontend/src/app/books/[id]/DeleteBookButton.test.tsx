import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DeleteBookButton } from "./DeleteBookButton";

describe("DeleteBookButton", () => {
  it("does not delete on the first click", async () => {
    const action = vi.fn();
    render(<DeleteBookButton action={action} />);

    await userEvent.click(screen.getByRole("button", { name: "削除する" }));

    expect(action).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "本当に削除する" })).toBeInTheDocument();
  });

  it("deletes once the user confirms", async () => {
    const action = vi.fn().mockResolvedValue({ status: "success" });
    render(<DeleteBookButton action={action} />);

    await userEvent.click(screen.getByRole("button", { name: "削除する" }));
    await userEvent.click(screen.getByRole("button", { name: "本当に削除する" }));

    await waitFor(() => expect(action).toHaveBeenCalledOnce());
  });

  it("backs out without deleting", async () => {
    const action = vi.fn();
    render(<DeleteBookButton action={action} />);

    await userEvent.click(screen.getByRole("button", { name: "削除する" }));
    await userEvent.click(screen.getByRole("button", { name: "やめる" }));

    expect(action).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "削除する" })).toBeInTheDocument();
  });

  it("shows the failure when the delete does not go through", async () => {
    const action = vi.fn().mockResolvedValue({ status: "error", message: "削除に失敗しました。" });
    render(<DeleteBookButton action={action} />);

    await userEvent.click(screen.getByRole("button", { name: "削除する" }));
    await userEvent.click(screen.getByRole("button", { name: "本当に削除する" }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("削除に失敗しました。"),
    );
  });
});
