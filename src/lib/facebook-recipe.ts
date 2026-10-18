export function isFacebookRecipeLink(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === "facebook.com" || host.endsWith(".facebook.com") || host === "fb.watch";
  } catch { return false; }
}

/** Read complete post message strings, not the truncated og:description or page chrome. */
export function extractFacebookRecipe(html: string): string | null {
  const candidates: string[] = [];
  for (const script of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
    for (const match of script[1].matchAll(/"text"\s*:\s*("(?:[^"\\]|\\.)*")/g)) {
      try {
        const text: unknown = JSON.parse(match[1]);
        if (typeof text !== "string") continue;
        if (!/\bingredients\s*:/i.test(text) || !/\b(?:directions|instructions|method)\s*:/i.test(text)) continue;
        candidates.push(text);
      } catch { /* Ignore unrelated or malformed embedded data. */ }
    }
  }
  candidates.sort((a, b) => b.length - a.length);
  return candidates[0] ?? null;
}

export const FACEBOOK_RECIPE_ACCESS_MESSAGE = "Pinch couldn't read the complete recipe from this Facebook post. Paste the full post text or upload screenshots; if the ingredients are inside a video, upload the saved video instead.";