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