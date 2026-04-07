import {
  flagUnhealthyUrl,
  isUrlUnhealthy,
  getUnhealthyReason,
  clearUnhealthyUrl,
  getUnhealthyCacheSize,
  cleanupExpiredUrlHealth,
} from "@/lib/agent/urlHealthCache";

describe("URL Health Cache", () => {
  const url1 = "https://twitch.tv/deaduser";
  const url2 = "https://youtube.com/@deleted";
  const url3 = "https://tiktok.com/@gone";

  beforeEach(() => {
    clearUnhealthyUrl(url1);
    clearUnhealthyUrl(url2);
    clearUnhealthyUrl(url3);
  });

  it("returns false for a URL that was never flagged", () => {
    expect(isUrlUnhealthy(url1)).toBe(false);
  });

  it("returns true after flagging a URL", () => {
    flagUnhealthyUrl(url1, "twitch_user_not_found");
    expect(isUrlUnhealthy(url1)).toBe(true);
  });

  it("is case-insensitive", () => {
    flagUnhealthyUrl("https://Twitch.TV/DeadUser", "not_found");
    expect(isUrlUnhealthy("https://twitch.tv/deaduser")).toBe(true);
  });

  it("returns the correct reason", () => {
    flagUnhealthyUrl(url1, "twitch_not_affiliate_partner");
    expect(getUnhealthyReason(url1)).toBe("twitch_not_affiliate_partner");
  });

  it("returns null reason for unflagged URL", () => {
    expect(getUnhealthyReason(url1)).toBeNull();
  });

  it("clearUnhealthyUrl removes a flagged URL", () => {
    flagUnhealthyUrl(url1, "test");
    clearUnhealthyUrl(url1);
    expect(isUrlUnhealthy(url1)).toBe(false);
    expect(getUnhealthyReason(url1)).toBeNull();
  });

  it("tracks multiple URLs independently", () => {
    flagUnhealthyUrl(url1, "reason1");
    flagUnhealthyUrl(url2, "reason2");
    expect(isUrlUnhealthy(url1)).toBe(true);
    expect(isUrlUnhealthy(url2)).toBe(true);
    expect(isUrlUnhealthy(url3)).toBe(false);
  });

  it("getUnhealthyCacheSize returns correct count", () => {
    const before = getUnhealthyCacheSize();
    flagUnhealthyUrl(url1, "test");
    flagUnhealthyUrl(url2, "test");
    expect(getUnhealthyCacheSize()).toBe(before + 2);
  });

  it("handles empty string URL gracefully", () => {
    flagUnhealthyUrl("", "test");
    expect(isUrlUnhealthy("")).toBe(false);
  });

  it("cleanupExpiredUrlHealth returns 0 for fresh entries", () => {
    flagUnhealthyUrl(url1, "test");
    expect(cleanupExpiredUrlHealth()).toBe(0);
  });

  it("overwriting a flagged URL updates the reason", () => {
    flagUnhealthyUrl(url1, "old_reason");
    flagUnhealthyUrl(url1, "new_reason");
    expect(getUnhealthyReason(url1)).toBe("new_reason");
  });
});
