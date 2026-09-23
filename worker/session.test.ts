import { describe, expect, it } from "vitest";
import { escapeHtml, parseAdminEmails, signedInDocument, signInConfirmPage } from "./session";

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

describe("signInConfirmPage", () => {
  it("posts the token and does not sign in by itself", () => {
    const page = signInConfirmPage(
      "https://greek.titusmurphy.com/api/auth/verify",
      "abc123",
      "a@example.com"
    );
    expect(page).toContain('method="post"');
    expect(page).toContain('name="token" value="abc123"');
    expect(page).toContain("a@example.com");
    expect(page).not.toContain("Set-Cookie");
  });

  it("escapes the address and the token", () => {
    expect(escapeHtml(`a<b>"&'`)).toBe("a&lt;b&gt;&quot;&amp;&#39;");
    const page = signInConfirmPage(
      "https://greek.titusmurphy.com/api/auth/verify",
      `"><script>`,
      `a<b>@example.com`
    );
    expect(page).not.toContain(`"><script>`);
    expect(page).toContain("&lt;script&gt;");
    expect(page).toContain("a&lt;b&gt;@example.com");
  });

  it("embeds the Turnstile widget when a site key is set", () => {
    const page = signInConfirmPage(
      "https://greek.titusmurphy.com/api/auth/verify",
      "abc123",
      "a@example.com",
      "site-key"
    );
    expect(page).toContain('data-sitekey="site-key"');
    expect(page).toContain('data-action="signin"');
    expect(page).toContain("disabled");
  });
});

describe("signedInDocument", () => {
  it("sends the browser to the site root", () => {
    const page = signedInDocument("https://greek.titusmurphy.com/");
    expect(page).toContain('url=https://greek.titusmurphy.com/"');
    expect(page).toContain('location.replace("https://greek.titusmurphy.com/")');
    expect(page).not.toContain("/api/");
  });
});
