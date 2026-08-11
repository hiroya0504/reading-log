import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HealthBadge } from "./HealthBadge";

describe("HealthBadge", () => {
  it("reports a reachable API", () => {
    render(<HealthBadge status="ok" />);

    expect(screen.getByRole("status")).toHaveTextContent("API 接続 OK");
  });

  it("reports an unreachable API", () => {
    render(<HealthBadge status="unreachable" />);

    expect(screen.getByRole("status")).toHaveTextContent("API に接続できません");
  });
});
