import { describe, expect, it } from "vitest";
import { signMobileToken, verifyMobileToken } from "./mobile-token";

describe("mobile-token", () => {
  it("signs and verifies a doctor token", () => {
    const token = signMobileToken({
      userId: 7,
      name: "Dr Demo",
      role: "doctor",
    });
    const payload = verifyMobileToken(token);
    expect(payload?.userId).toBe(7);
    expect(payload?.role).toBe("doctor");
    expect(payload?.name).toBe("Dr Demo");
  });

  it("rejects tampered tokens", () => {
    const token = signMobileToken({
      userId: 1,
      name: "X",
      role: "admin",
    });
    expect(verifyMobileToken(token + "x")).toBeNull();
    expect(verifyMobileToken("mh1.abc.def")).toBeNull();
  });
});
