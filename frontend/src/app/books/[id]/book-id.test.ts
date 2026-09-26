import { describe, expect, it } from "vitest";
import { parseBookId } from "./book-id";

describe("parseBookId", () => {
  it.each([
    ["42", 42],
    ["0", 0],
  ])("reads %j as the id %d", (raw, id) => {
    expect(parseBookId(raw)).toBe(id);
  });

  // Each is something `Number()` would have turned into a plausible id.
  it.each(["", "abc", "1e3", "-1", "1.5", " 1", "0x10"])("rejects %j", (raw) => {
    expect(parseBookId(raw)).toBeUndefined();
  });
});
