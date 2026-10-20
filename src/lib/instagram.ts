/** Instagram reel/post handling via the public embed page, which needs no login. */

export function isInstagramLink(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === "instagram.com" || host.endsWith(".instagram.com");
  } catch {
    return false;
  }
}

/** Extracts the reel/post id from any Instagram URL shape (/reel/, /p/, /reels/). */
export function instagramEmbedUrl(url: string): string | null {
  try {
    const id = new URL(url).pathname.match(/\/(?:reel|reels|p)\/([A-Za-z0-9_-]+)/)?.[1];
    return id ? `https://www.instagram.com/reel/${id}/embed/captioned/` : null;
  } catch {
    return null;
  }
}

export type InstagramEmbed = { caption: string; videoUrl: string | null };

/** Reads caption and the direct mp4 link from the embed page's HTML. */
export function extractInstagramEmbed(html: string): InstagramEmbed {
  const unescape = (s: string) =>
    s
      .replace(/\\u00253D/gi, "=")
      .replace(/\\u0026/gi, "&")
      .replace(/\\\//g, "/")
      .replace(/\\u0025/gi, "%");
  const videoMatch = html.match(/"video_url\\?":\\?"(https?:[^"]+?\.mp4[^"]*?)\\?"/)?.[1];
  const videoUrl = videoMatch ? unescape(videoMatch) : null;
  const captionMatch = html.match(/class="Caption"[\s\S]*?<a[^>]*>[^<]*<\/a><br\s*\/?><br\s*\/?>([\s\S]*?)<\/div>/)?.[1];
  const caption = captionMatch
    ? captionMatch
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<[^>]+>/g, "")
        .replace(/&amp;/g, "&")
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .trim()
    : "";
  return { caption, videoUrl };
}

export const INSTAGRAM_ACCESS_MESSAGE =
  "Pinch couldn't read this Instagram link. Save the reel (share arrow → Download) and upload it under Video, or paste the recipe text.";
