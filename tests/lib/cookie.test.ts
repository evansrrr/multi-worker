import { describe, expect, it } from "vitest";

import {
  buildClearSessionCookie,
  buildSessionCookie,
  getSessionIdFromCookie,
} from "../../functions/lib/cookie";

function request(url: string, cookie?: string): Request {
  const headers = new Headers();
  if (cookie !== undefined) headers.set("Cookie", cookie);
  return new Request(url, { headers });
}

const HTTPS = "https://tool.example.com/api/accounts";
const HTTP = "http://localhost:8788/api/accounts";

describe("getSessionIdFromCookie", () => {
  it("extracts the session id from a single cookie", () => {
    expect(getSessionIdFromCookie(request(HTTP, "session=abc123"))).toBe(
      "abc123"
    );
  });

  it("extracts the session id when other cookies are present", () => {
    expect(
      getSessionIdFromCookie(
        request(HTTP, "theme=dark; session=abc123; lang=zh")
      )
    ).toBe("abc123");
  });

  it("handles extra whitespace around cookie pairs", () => {
    expect(
      getSessionIdFromCookie(request(HTTP, "  session=abc123 ;  theme=dark "))
    ).toBe("abc123");
  });

  it("ignores cookies whose name merely starts with 'session'", () => {
    expect(
      getSessionIdFromCookie(request(HTTP, "sessionid=xyz; session=abc123"))
    ).toBe("abc123");
  });

  it("returns undefined when the Cookie header is absent", () => {
    expect(getSessionIdFromCookie(request(HTTP))).toBeUndefined();
  });

  it("returns undefined when no session cookie is present", () => {
    expect(getSessionIdFromCookie(request(HTTP, "theme=dark"))).toBeUndefined();
  });

  it("returns undefined for an empty session value", () => {
    expect(getSessionIdFromCookie(request(HTTP, "session="))).toBeUndefined();
    expect(
      getSessionIdFromCookie(request(HTTP, "session=; theme=dark"))
    ).toBeUndefined();
  });

  it("returns undefined for an empty Cookie header", () => {
    expect(getSessionIdFromCookie(request(HTTP, ""))).toBeUndefined();
  });

  // Documents current behaviour: the value is split on "=" and only the first
  // segment is kept, so base64 padding ("=") in a session id is truncated.
  it("truncates session ids that contain '=' (current behaviour)", () => {
    expect(getSessionIdFromCookie(request(HTTP, "session=ab=cd"))).toBe("ab");
  });
});

describe("buildSessionCookie", () => {
  it("emits HttpOnly / Path / Max-Age / SameSite for http dev", () => {
    const cookie = buildSessionCookie("abc123", request(HTTP));
    expect(cookie).toBe(
      "session=abc123; HttpOnly; Path=/; Max-Age=86400; SameSite=Lax"
    );
  });

  it("adds Secure over https", () => {
    const cookie = buildSessionCookie("abc123", request(HTTPS));
    expect(cookie).toContain("; Secure");
    expect(cookie.startsWith("session=abc123;")).toBe(true);
    expect(cookie).toContain("Max-Age=86400");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Path=/");
  });

  it("omits Secure on plain http so localhost dev keeps the cookie", () => {
    expect(buildSessionCookie("abc123", request(HTTP))).not.toContain("Secure");
  });

  it("round-trips through getSessionIdFromCookie", () => {
    const cookie = buildSessionCookie("sess-42", request(HTTPS));
    const parsed = getSessionIdFromCookie(request(HTTPS, cookie));
    expect(parsed).toBe("sess-42");
  });
});

describe("buildClearSessionCookie", () => {
  it("clears the cookie with Max-Age=0 and an empty value", () => {
    expect(buildClearSessionCookie(request(HTTP))).toBe(
      "session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax"
    );
  });

  it("adds Secure over https", () => {
    expect(buildClearSessionCookie(request(HTTPS))).toBe(
      "session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax; Secure"
    );
  });

  it("matches the attributes of the session cookie (same Path/SameSite/Secure)", () => {
    for (const url of [HTTP, HTTPS]) {
      const set = buildSessionCookie("x", request(url));
      const clear = buildClearSessionCookie(request(url));
      const attributes = (c: string) => c.split(";").slice(1).join(";").trim();
      // Same attributes apart from Max-Age, which is what actually clears it.
      expect(attributes(clear)).toBe(
        attributes(set).replace("Max-Age=86400", "Max-Age=0")
      );
    }
  });
});
