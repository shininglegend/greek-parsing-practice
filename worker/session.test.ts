import { describe, expect, it } from "vitest";
import { parseAdminEmails } from "./session";

describe("parseAdminEmails", () => {
  it("reads a comma-separated string", () => {
    expect(parseAdminEmails("a@example.com, B@example.com")).toEqual([
      "a@example.com",
      "b@example.com",
    ]);
  });

  it("reads a list", () => {
    expect(parseAdminEmails(["Jvctext@gmail.com"])).toEqual(["jvctext@gmail.com"]);
  });

  it("reads a JSON list stored as a string", () => {
    expect(parseAdminEmails('["jvctext@gmail.com"]')).toEqual(["jvctext@gmail.com"]);
  });
});
