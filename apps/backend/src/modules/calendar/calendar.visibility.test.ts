import { describe, expect, it } from "vitest";
import { visibilityFilter } from "./calendar.visibility.js";

describe("visibilityFilter", () => {
  it("admins see every note", () => {
    expect(visibilityFilter("admin", true)).toEqual({});
  });

  it("others see company notes, their own, and ones shared with them", () => {
    expect(visibilityFilter("u1", false)).toEqual({
      OR: [{ visibility: "COMPANY" }, { createdBy: "u1" }, { assignees: { some: { userId: "u1" } } }],
    });
  });
});
