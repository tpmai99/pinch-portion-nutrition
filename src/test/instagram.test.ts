import { describe, expect, it } from "vitest";
import { extractInstagramEmbed, instagramEmbedUrl, isInstagramLink } from "@/lib/instagram";

describe("Instagram link handling", () => {
  it("recognizes Instagram reel and post links", () => {
    expect(isInstagramLink("https://www.instagram.com/reel/DQmOahWEUoD/?xtok=abc")).toBe(true);
    expect(isInstagramLink("https://instagram.com/p/xyz/")).toBe(true);
    expect(isInstagramLink("https://notinstagram.com/reel/abc")).toBe(false);
    expect(isInstagramLink("https://instagram.com.example.org/")).toBe(false);
  });

  it("builds the no-login embed URL from any reel/post path", () => {
    expect(instagramEmbedUrl("https://www.instagram.com/reel/DQmOahWEUoD/?xtok=abc")).toBe(
      "https://www.instagram.com/reel/DQmOahWEUoD/embed/captioned/",
    );
    expect(instagramEmbedUrl("https://www.instagram.com/p/ABC123/")).toBe(
      "https://www.instagram.com/reel/ABC123/embed/captioned/",
    );
    expect(instagramEmbedUrl("https://www.instagram.com/explore/")).toBeNull();
  });

  it("extracts caption and video URL from embed page HTML", () => {
    const html = `<div class="Caption"><a href="/chef">chef</a><br /><br />Award Winning Chili<br />-1 tbsp olive oil<br />-2 lbs ground beef &amp; beans</div>`
      + `"video_url\\":\\"https:\\\\/\\\\/cdn.example.com\\\\/v\\\\/clip.mp4?_nc_cat=106\\u00253D&x=1\\"`;
    const { caption, videoUrl } = extractInstagramEmbed(html);
    expect(caption).toContain("Award Winning Chili");
    expect(caption).toContain("-2 lbs ground beef & beans");
    expect(videoUrl).toBe("https://cdn.example.com/v/clip.mp4?_nc_cat=106=&x=1");
  });

  it("returns null video URL when the embed has no video", () => {
    const { caption, videoUrl } = extractInstagramEmbed(`<div class="Caption"><a>x</a><br /><br />Just a photo</div>`);
    expect(caption).toBe("Just a photo");
    expect(videoUrl).toBeNull();
  });
});
