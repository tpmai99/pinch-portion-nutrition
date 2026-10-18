/** Shared-link aliases must never fall through to importing a social site's page chrome. */
export function isTikTokRecipeLink(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === "tt.site" || host.endsWith(".tt.site") || host === "tiktok.com" || host.endsWith(".tiktok.com");
  } catch { return false; }
}

/** Metadata is not a transcript: only pass captions with concrete recipe detail to import. */
export function hasRecipeCaption(text: string): boolean {
  return text.trim().length >= 80 && /(?:\b\d+(?:[.,/]\d+)?\s*(?:g|kg|ml|l|cups?|tbsp|tsp|tablespoons?|teaspoons?|oz|lbs?|cloves?)\b|\bingredients\s*:)/i.test(text);
}

export const TIKTOK_RECIPE_ACCESS_MESSAGE = "Pinch couldn't access the recipe from this TikTok link. Link import reads the post caption, not text inside the video or its narration. Save the video from TikTok and upload it using Video to read the on-screen ingredients and instructions, or paste the recipe text.";

/** tt.site short links often fail upstream; the same code resolves through TikTok's own short-link host. */
export function tiktokShortLinkFallback(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (!(host === "tt.site" || host.endsWith(".tt.site"))) return null;
    const code = u.pathname.match(/^\/t\/([A-Za-z0-9_-]+)/)?.[1];
    return code ? `https://vm.tiktok.com/${code}/` : null;
  } catch { return null; }
}

export type TikTokPost = { caption: string; author: string | null; imageUrls: string[] };

/** Reads caption and photo-carousel images from a TikTok page's embedded data; photo posts keep the recipe in the images. */
export function extractTikTokPost(html: string, maxImages = 10): TikTokPost | null {
  const raw = html.match(/<script[^>]*id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/)?.[1];
  if (!raw) return null;
  let item: { desc?: string; author?: { uniqueId?: string; nickname?: string }; imagePost?: { images?: Array<{ imageURL?: { urlList?: string[] } }> } } | undefined;
  try {
    item = JSON.parse(raw)?.__DEFAULT_SCOPE__?.["webapp.reflow.video.detail"]?.itemInfo?.itemStruct
      ?? JSON.parse(raw)?.__DEFAULT_SCOPE__?.["webapp.video-detail"]?.itemInfo?.itemStruct;
  } catch { return null; }
  if (!item) return null;
  const imageUrls = (item.imagePost?.images ?? [])
    .map((i) => i.imageURL?.urlList?.find((u) => /^https:\/\//.test(u)))
    .filter((u): u is string => !!u)
    .slice(0, maxImages);
  return { caption: (item.desc ?? "").trim(), author: item.author?.nickname || item.author?.uniqueId || null, imageUrls };
}
