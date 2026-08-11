import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BookForm } from "./BookForm";
import type { CreateBookState } from "./create-book-state";

/**
 * The real action is server-only, so a stub stands in. That is the reason `BookForm` takes the
 * action as a prop instead of importing it.
 */
function stubAction(result: CreateBookState) {
  // Parameters are declared so the recorded call is typed and `calls[0][1]` is the FormData.
  return vi.fn(async (_previous: CreateBookState, _formData: FormData) => result);
}

describe("BookForm", () => {
  it("submits what the user typed", async () => {
    const action = stubAction({ status: "success" });
    render(<BookForm action={action} />);

    await userEvent.type(screen.getByLabelText("書名"), "リファクタリング");
    await userEvent.type(screen.getByLabelText("著者"), "Martin Fowler");
    await userEvent.type(screen.getByLabelText("総ページ数"), "480");
    await userEvent.selectOptions(screen.getByLabelText("状態"), "READING");
    await userEvent.click(screen.getByRole("button", { name: "登録する" }));

    await waitFor(() => expect(action).toHaveBeenCalledOnce());
    const formData = action.mock.calls[0][1] as FormData;
    expect(formData.get("title")).toBe("リファクタリング");
    expect(formData.get("author")).toBe("Martin Fowler");
    expect(formData.get("totalPages")).toBe("480");
    expect(formData.get("status")).toBe("READING");
  });

  it("shows the message the action came back with", async () => {
    render(
      <BookForm action={stubAction({ status: "error", message: "title: title is required" })} />,
    );

    await userEvent.click(screen.getByRole("button", { name: "登録する" }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("title: title is required"),
    );
  });

  it("shows no alert before anything is submitted", () => {
    render(<BookForm action={stubAction({ status: "success" })} />);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("confirms a successful submit so the user does not file the book twice", async () => {
    render(<BookForm action={stubAction({ status: "success" })} />);

    await userEvent.click(screen.getByRole("button", { name: "登録する" }));

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("登録しました。"));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("clears a previous error once a later submit succeeds", async () => {
    const action = vi
      .fn<(previous: CreateBookState, formData: FormData) => Promise<CreateBookState>>()
      .mockResolvedValueOnce({ status: "error", message: "title: title is required" })
      .mockResolvedValueOnce({ status: "success" });
    render(<BookForm action={action} />);

    await userEvent.click(screen.getByRole("button", { name: "登録する" }));
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: "登録する" }));

    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    expect(screen.getByRole("status")).toHaveTextContent("登録しました。");
  });

  it("does not block submission client-side, leaving validation to the backend", async () => {
    const action = stubAction({ status: "error", message: "title: title is required" });
    render(<BookForm action={action} />);

    // Title left empty on purpose: the request must still reach the action.
    await userEvent.click(screen.getByRole("button", { name: "登録する" }));

    await waitFor(() => expect(action).toHaveBeenCalledOnce());
  });
});
