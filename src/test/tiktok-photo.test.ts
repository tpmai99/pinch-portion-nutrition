import { describe, expect, it } from "vitest";
import { extractTikTokPost, tiktokShortLinkFallback } from "@/lib/recipe-links";

const page = (item: unknown) => `<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">${JSON.stringify({ __DEFAULT_SCOPE__: { "webapp.reflow.video.detail": { itemInfo: { itemStruct: item } } } })}</script>`;

describe("TikTok photo posts", () => {
  it("rewrites the user's tt.site link to TikTok's short-link host", () => {
    expect(tiktokShortLinkFallback("https://www.tt.site/t/ZGdCXN7wE/")).toBe("https://vm.tiktok.com/ZGdCXN7wE/");
    expect(tiktokShortLinkFallback("https://www.tiktok.com/@a/video/1")).toBeNull();
  });
  it("returns every carousel photo and the caption", () => {
    const imgs = Array.from({ length: 5 }, (_, i) => ({ imageURL: { urlList: [`https://cdn.example/${i}.jpeg`] } }));
    const post = extractTikTokPost(page({ desc: "simple pho recipe", author: { nickname: "Carey" }, imagePost: { images: imgs } }));
    expect(post?.imageUrls).toHaveLength(5);
    expect(post?.caption).toBe("simple pho recipe");
  });
  it("returns null when the page has no post data", () => {
    expect(extractTikTokPost("<html></html>")).toBeNull();
  });
});
