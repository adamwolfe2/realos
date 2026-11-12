import { describe, expect, it } from "vitest";
import { classifySource } from "@/lib/attribution/source-taxonomy";

const ref = (url: string) => classifySource(null, url).id;
const utm = (s: string, m?: string) => classifySource(s, null, m).id;

// Every case here is a real hostname / tag that must NOT be credited to a
// platform it merely contains as a substring. A false channel is worse than
// "Referral": operators make spend decisions on these labels.
describe("classifySource never credits the wrong platform", () => {
  it("referrer hosts match on domain boundaries, not substrings", () => {
    expect(ref("https://www.pinterest.com/pin/1")).toBe("pinterest"); // contains "t.co", must not be X
    expect(ref("https://www.dropbox.com/s/x")).toBe("referral"); // contains "x.com"
    expect(ref("https://www.student.com/us/berkeley")).toBe("referral"); // contains "t.co"
    expect(ref("https://www.fbcdn.example.org/")).toBe("referral");
    expect(ref("https://t.co/abc")).toBe("x_twitter");
    expect(ref("https://x.com/home")).toBe("x_twitter");
    expect(ref("https://www.zillow.com/homedetails/1")).toBe("zillow");
    expect(ref("https://www.google.com/")).toBe("google_organic");
    expect(ref("https://www.google.co.uk/")).toBe("google_organic");
    expect(ref("https://l.instagram.com/?u=x")).toBe("instagram");
    expect(ref("https://lm.facebook.com/l.php")).toBe("facebook");
    expect(ref("https://www.rent.com/california")).toBe("rent_com");
  });

  it("webmail is Email, not Google / Yahoo search", () => {
    expect(ref("https://mail.google.com/mail/u/0/")).toBe("email");
    expect(ref("https://outlook.live.com/mail/")).toBe("email");
  });

  it("utm tags match whole tokens, not fragments", () => {
    expect(utm("digital")).not.toBe("instagram"); // contains "ig"
    expect(utm("bigsale")).not.toBe("instagram");
    expect(utm("webinar")).not.toBe("bing_organic");
    expect(utm("ig")).toBe("instagram");
    expect(utm("ig_story")).toBe("instagram");
    expect(utm("fb")).toBe("facebook");
    expect(utm("chatgpt.com")).toBe("chatgpt");
    expect(utm("zillow")).toBe("zillow");
    expect(utm("Zillow")).toBe("zillow");
    expect(utm("apartments.com")).toBe("apartments_com");
    expect(utm("google", "cpc")).toBe("google_ads");
    expect(utm("google")).toBe("google_organic");
    expect(utm("facebook", "paid_social")).toBe("meta_ads");
  });
});

describe("referrers seen in real SG traffic (PopupEvent, 2026-11-12)", () => {
  it("email apps and link scanners are Email, never Google search", () => {
    expect(ref("android-app://com.google.android.gm/")).toBe("email");
    expect(ref("https://link.edgepilot.com/s/abc")).toBe("email");
    expect(ref("https://nam12.safelinks.protection.outlook.com/?url=x")).toBe("email");
    expect(ref("https://mail.yahoo.com/d/folders/1")).toBe("email");
  });
  it("the Google app is Google search", () => {
    expect(ref("android-app://com.google.android.googlequicksearchbox/")).toBe("google_organic");
  });
  it("named sources", () => {
    expect(ref("https://och.berkeley.edu/listings/1")).toBe("uc_berkeley");
    expect(ref("https://www.pinterest.com/pin/1")).toBe("pinterest");
    expect(ref("https://www.yelp.com/biz/the-lair")).toBe("yelp");
    expect(ref("https://nextdoor.com/p/x")).toBe("nextdoor");
    expect(ref("https://yandex.com/search")).toBe("yandex");
    expect(ref("https://www.baidu.com/s?wd=x")).toBe("baidu");
    expect(ref("https://search.yahoo.com/search?p=x")).toBe("yahoo");
  });
});
