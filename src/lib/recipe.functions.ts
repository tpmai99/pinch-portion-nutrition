import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({
  text: z.string().max(40000).optional(),
  url: z.string().url().optional(),
  imageDataUrl: z.string().max(12_000_000).optional(),
});

export type ParsedRecipe = {
  title: string;
  servings: number;
  ingredients: { name: string; quantity: number | null; unit: string; category: string }[];
  steps: string[];
  nutrition: { kcal: number; protein: number; carbs: number; fat: number };
};

const recipeSchema = z.object({
  title: z.string(),
  servings: z.number(),
  ingredients: z.array(
    z.object({
      name: z.string(),
      quantity: z.number().nullable(),
      unit: z.string(),
      category: z.string(),
    }),
  ),
  steps: z.array(z.string()),
  nutrition: z.object({ kcal: z.number(), protein: z.number(), carbs: z.number(), fat: z.number() }),
});

function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, (m) => (m.includes("Recipe") ? m : " "))
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

async function textFromUrl(url: string): Promise<string> {
  const host = new URL(url).hostname.replace(/^www\./, "");
  if (host === "youtube.com" || host === "m.youtube.com" || host === "youtu.be") {
    let parts: string[] = [];
    // oEmbed always works and gives title + channel.
    try {
      const oe = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
      if (oe.ok) {
        const j = (await oe.json()) as { title?: string; author_name?: string };
        if (j.title) parts.push(`YouTube video "${j.title}" by ${j.author_name ?? "creator"}`);
      }
    } catch { /* fall through to description */ }
    // The watch page's description meta usually holds the recipe text.
    try {
      const r = await fetch(url.replace("youtu.be/", "www.youtube.com/watch?v="), {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; PinchBot/1.0)", Accept: "text/html", "Accept-Language": "en" },
      });
      if (r.ok) {
        const html = await r.text();
        const desc =
          html.match(/"shortDescription":"((?:[^"\\]|\\.)*)"/)?.[1] ??
          html.match(/<meta[^>]+(?:property|name)="(?:og:)?description"[^>]+content="([^"]*)"/i)?.[1] ?? "";
        if (desc) parts.push("Video description:\n" + desc.replace(/\\"/g, '"').replace(/\\n/g, "\n").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&"));
      }
    } catch { /* title alone may be enough */ }
    if (parts.length) return parts.join("\n\n");
    throw new Error("Couldn't read that YouTube video. Try pasting the recipe text instead.");
  }
  if (host.includes("tiktok.com")) {
    const r = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`);
    if (r.ok) {
      const j = (await r.json()) as { title?: string; author_name?: string };
      if (j.title) return `TikTok caption by ${j.author_name ?? "creator"}:\n${j.title}`;
    }
  }
  const r = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; PinchBot/1.0)", Accept: "text/html" },
  });
  if (!r.ok) throw new Error(`Couldn't open that link (status ${r.status}). Try pasting the recipe text instead.`);
  const html = await r.text();
  const og = html.match(/<meta[^>]+(?:property|name)="(?:og:)?description"[^>]+content="([^"]*)"/i)?.[1] ?? "";
  return `${og}\n\n${stripHtml(html)}`.slice(0, 30000);
}

export const parseRecipe = createServerFn({ method: "POST" })
  .validator((d: unknown) => Input.parse(d))
  .handler(async ({ data }): Promise<ParsedRecipe> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured.");
    const { createOpenAI } = await import("@ai-sdk/openai");
    const { streamText, Output, NoObjectGeneratedError } = await import("ai");

    let source = data.text ?? "";
    if (data.url) source = `${await textFromUrl(data.url)}\n\n${source}`;
    if (!source.trim() && !data.imageDataUrl) throw new Error("Add a recipe first.");

    const provider = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey,
      headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    });

    const content: Array<{ type: "text"; text: string } | { type: "image"; image: string }> = [
      {
        type: "text",
        text:
          "Extract the recipe below. Quantities must be numbers (convert fractions, e.g. 1/2 -> 0.5); use null when no amount is given (e.g. 'salt to taste'). Use metric-friendly short units (g, ml, tbsp, tsp, pc, clove, etc.; empty string if none). category is one of: produce, dairy, meat, fish, pantry, bakery, spices, frozen, other. Steps are concise, one action each. Estimate nutrition PER PORTION (kcal, protein g, carbs g, fat g) if not stated. If servings unknown, estimate.\n\n" +
          (source || "(see image)"),
      },
    ];
    if (data.imageDataUrl) content.push({ type: "image", image: data.imageDataUrl });

    const result = streamText({
      model: provider.responses("openai/gpt-6-astra"),
      messages: [{ role: "user", content }],
      output: Output.object({ schema: recipeSchema }),
      providerOptions: {
        openai: {
          forceReasoning: true,
          reasoningEffort: "low",
          reasoningSummary: "auto",
          store: false,
          include: ["reasoning.encrypted_content"],
          strictJsonSchema: true,
        },
      },
    });
    let parsed: ParsedRecipe;
    try {
      parsed = (await result.output) as ParsedRecipe;
    } catch (e) {
      if (NoObjectGeneratedError.isInstance(e) && e.text) {
        parsed = recipeSchema.parse(JSON.parse(e.text));
      } else {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes("402")) throw new Error("AI credits are used up for this workspace.");
        if (msg.includes("429")) throw new Error("Too many requests — wait a moment and try again.");
        throw new Error("Couldn't read that recipe. Try pasting the text directly.");
      }
    }
    if (!parsed.ingredients.length) throw new Error("No ingredients found in that source.");
    parsed.servings = Math.max(1, Math.round(parsed.servings || 2));
    return parsed;
  });
