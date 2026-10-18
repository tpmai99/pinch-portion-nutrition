import { findNearbyStores, type NearbyStore } from "@/lib/stores.functions";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, ArrowRight, Check, ChefHat, ChevronDown, Film, ImagePlus, Info, Link2, Loader2, MapPin, Minus, Plus, ShoppingBag, Type, X,
} from "lucide-react";
import { parseRecipe, readRecipeVideo, type ParsedRecipe } from "@/lib/recipe.functions";
import { CART_LABEL, STORES, estimateCart, type Preference } from "@/lib/scale";
import { convertAmount, type UnitMode } from "@/lib/units";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { applyAdjustments, applyOptionalAmounts, chooseRecipe, computedNutrition, ingredientChangeLabel, nutritionWarnings, type RecipeChoice, type RecipeVersion } from "@/lib/recipe";
import { verifiedProduct } from "@/lib/grocery";
import { CookingGuide } from "@/components/CookingGuide";
import { isTikTokRecipeLink } from "@/lib/recipe-links";
import { videoUploadError } from "@/lib/video";
import { storeCoverage } from "@/lib/store-coverage";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Pinch — Scale, shop & cook any recipe" },
      { name: "description", content: "Paste a recipe, link or screenshot. Pinch scales portions, tracks macros, finds the missing groceries and guides you while cooking." },
      { property: "og:title", content: "Pinch — Scale, shop & cook any recipe" },
      { property: "og:description", content: "Recipe portion scaling, nutrition, smart grocery shopping and step-by-step cooking." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: App,
});

type Stage = "import" | "portions" | "overview" | "cook";

function App() {
  const [stage, setStage] = useState<Stage>("import");
  const [recipe, setRecipe] = useState<ParsedRecipe | null>(null);
  const [portions, setPortions] = useState(2);
  const [shopOpen, setShopOpen] = useState(false);
  const [choice, setChoice] = useState<RecipeChoice>("yummy");
  const [unitMode, setUnitMode] = useState<UnitMode>("metric");
  const [adjust, setAdjust] = useState<Record<number, number>>({});
  const [removed, setRemoved] = useState<Set<number>>(new Set());
  const [grams, setGrams] = useState<Record<number, number>>({});
  const resetAdjustments = () => { setAdjust({}); setRemoved(new Set()); setGrams({}); };
  const activeRecipe = recipe ? chooseRecipe(recipe, choice) : null;
  const amountRecipe = activeRecipe ? applyOptionalAmounts(activeRecipe, grams) : null;
  const adjustedRecipe = amountRecipe ? applyAdjustments(amountRecipe, adjust, removed) : null;

  return (
    <main className="mx-auto min-h-screen max-w-md px-5 pb-16 pt-6">
      <header className="mb-8 flex items-center justify-between">
        <button onClick={() => { setStage("import"); setRecipe(null); }} className="font-display text-3xl italic tracking-tight">
          Pinch
        </button>
        {recipe && stage !== "import" && (
          <span className="rounded-full bg-secondary px-3 py-1 text-xs text-muted-foreground">
            {portions} portion{portions > 1 ? "s" : ""}
          </span>
        )}
      </header>

      {stage === "import" && (
        <ImportStep onParsed={(r) => { setRecipe(r); setChoice("yummy"); setPortions(r.servings); resetAdjustments(); setStage("portions"); }} />
      )}
      {stage === "portions" && recipe && (
        <PortionsStep recipe={recipe} portions={portions} setPortions={setPortions}
          onBack={() => setStage("import")} onNext={() => setStage("overview")} />
      )}
      {stage === "overview" && recipe && activeRecipe && (
        <OverviewStep recipe={activeRecipe} choice={choice} onChoice={(c) => { setChoice(c); resetAdjustments(); }} original={recipe} portions={portions} onBack={() => setStage("portions")}
          onCook={() => setStage("cook")} onShop={() => setShopOpen(true)} unitMode={unitMode} onUnitMode={setUnitMode}
          adjust={adjust} removed={removed} onAdjust={(i, m) => setAdjust((a) => ({ ...a, [i]: m }))} onRemove={(i, on) => setRemoved((s) => { const n = new Set(s); on ? n.add(i) : n.delete(i); return n; })}
          grams={grams} onGrams={(i, g) => setGrams((a) => { const n = { ...a }; if (g > 0) n[i] = g; else delete n[i]; return n; })} />
      )}
      {stage === "cook" && activeRecipe && <CookingGuide recipe={activeRecipe} onBack={() => setStage("overview")} />}

      {shopOpen && recipe && adjustedRecipe && (
        <ShopSheet recipe={adjustedRecipe} original={recipe} portions={portions} onClose={() => setShopOpen(false)}
          onCook={() => { setShopOpen(false); setStage("cook"); }} unitMode={unitMode} onUnitMode={setUnitMode} />
      )}
    </main>
  );
}

/* ---------- shared bits ---------- */

function PrimaryButton({ className, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...p} className={cn(
      "tactile flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-4 text-base font-medium text-primary-foreground shadow-lift disabled:opacity-40",
      className)} />
  );
}
function GhostButton({ className, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...p} className={cn(
      "tactile flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card px-5 py-4 text-base font-medium text-foreground shadow-soft",
      className)} />
  );
}
function Back({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground">
      <ArrowLeft className="h-4 w-4" /> Back
    </button>
  );
}
function Title({ children, sub }: { children: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h1 className="font-display text-4xl leading-[1.05] tracking-tight">{children}</h1>
      {sub && <p className="mt-2 text-muted-foreground">{sub}</p>}
    </div>
  );
}

/* ---------- 1. import ---------- */

function ImportStep({ onParsed }: { onParsed: (r: ParsedRecipe) => void }) {
  const parse = useServerFn(parseRecipe);
  const readVideo = useServerFn(readRecipeVideo);
  const [mode, setMode] = useState<"link" | "text" | "image" | "video">("link");
  const [video, setVideo] = useState<{ dataUrl: string; name: string } | null>(null);
  const [videoText, setVideoText] = useState<string | null>(null);
  const [stage, setStage] = useState<string | null>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const ready = mode === "link" ? /^https?:\/\//.test(url) : mode === "text" ? text.trim().length > 20 : mode === "video" ? !!video : !!image;

  async function go() {
    setLoading(true); setError(null);
    try {
      if (mode === "video") {
        if (!video) return;
        if (videoText !== null) {
          setStage("Reading recipe…");
          onParsed(await parse({ data: { text: videoText } }));
          return;
        }
        setStage("Watching the video…");
        const { text: watched } = await readVideo({ data: { videoDataUrl: video.dataUrl } });
        setVideoText(watched);
        return;
      }
      if (mode === "image" && !image) return;
      const data = mode === "link" ? { url } : mode === "text" ? { text } : { imageDataUrl: image ?? undefined };
      onParsed(await parse({ data }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally { setLoading(false); setStage(null); }
  }

  function onVideo(f?: File) {
    if (!f) return;
    setVideo(null); setVideoText(null);
    const uploadError = videoUploadError(f.size, f.type);
    if (uploadError) { setError(uploadError); return; }
    setError(null);
    const r = new FileReader();
    r.onload = () => { if (typeof r.result === "string") setVideo({ dataUrl: r.result, name: f.name }); };
    r.onerror = () => setError("Couldn't open that video. Choose the file again.");
    r.readAsDataURL(f);
  }

  function onFile(f?: File) {
    if (!f) return;
    const r = new FileReader();
    r.onload = () => setImage(r.result as string);
    r.readAsDataURL(f);
  }

  const tabs = [
    { id: "link", label: "Link", icon: Link2 },
    { id: "text", label: "Text", icon: Type },
    { id: "image", label: "Photo", icon: ImagePlus },
    { id: "video", label: "Video", icon: Film },
  ] as const;

  return (
    <section className="animate-rise">
      <Title sub="Paste a recipe link — TikTok, Reel or YouTube — the text itself, a screenshot or a saved video.">
        What are we <em>cooking</em> today?
      </Title>

      <div className="mb-4 grid grid-cols-4 gap-1 rounded-2xl bg-secondary p-1">
        {tabs.map((t) => (
          <Button variant="ghost" key={t.id} disabled={loading} onClick={() => { setMode(t.id); setError(null); }}
            className={cn("tactile flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm",
              mode === t.id ? "bg-card font-medium shadow-soft" : "text-muted-foreground")}>
            <t.icon className="h-4 w-4" /> {t.label}
          </Button>
        ))}
      </div>

      <div className="mb-5 rounded-3xl border border-border bg-card p-4 shadow-soft">
        {mode === "link" && (
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="TikTok, Reel or YouTube link…"
            className="w-full bg-transparent py-2 text-base outline-none placeholder:text-muted-foreground" />
        )}
        {mode === "text" && (
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={9}
            placeholder={"Creamy tomato pasta — serves 4\n400g penne\n2 cloves garlic\n…"}
            className="w-full resize-none bg-transparent text-base outline-none placeholder:text-muted-foreground" />
        )}
        {mode === "image" && (
          <button onClick={() => fileRef.current?.click()}
            className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl bg-muted text-muted-foreground">
            {image ? <img src={image} alt="Recipe upload" className="h-full w-full object-cover" />
              : (<><ImagePlus className="h-7 w-7" /><span className="text-sm">Tap to upload a screenshot</span></>)}
          </button>
        )}
        {mode === "video" && (
          <div className="space-y-3">
            {video ? <><video src={video.dataUrl} controls playsInline className="aspect-[4/3] w-full rounded-lg bg-muted object-contain" /><p className="break-all text-sm text-muted-foreground">{video.name}</p></> : null}
            <Button variant="outline" className="w-full" disabled={loading} onClick={() => videoRef.current?.click()}><Film className="h-4 w-4" />{video ? "Choose another video" : "Upload saved reel"}</Button>
            <p className="text-xs text-muted-foreground">MP4, MOV or WebM · up to 25 MB</p>
            {videoText !== null && <div className="space-y-2"><label htmlFor="video-transcript" className="text-sm font-medium">Extracted recipe</label><textarea id="video-transcript" value={videoText} disabled={loading} onChange={(e) => setVideoText(e.target.value)} rows={14} className="w-full resize-y rounded-lg border border-border bg-background p-3 text-sm" /></div>}
          </div>
        )}
        <input ref={videoRef} type="file" accept="video/*" hidden disabled={loading} onChange={(e) => { onVideo(e.target.files?.[0]); e.target.value = ""; }} />
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />
      </div>

      {error && <p className="mb-4 rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>}
      {error && mode === "link" && isTikTokRecipeLink(url) && <Button variant="outline" className="mb-4 w-full" onClick={() => { setMode("video"); setError(null); }}><Film className="h-4 w-4" /> Upload saved video instead</Button>}

      <Button className="h-auto w-full whitespace-normal py-4 text-base" disabled={!ready || loading || (mode === "video" && videoText !== null && !videoText.trim())} onClick={go}>
        {loading ? (<><Loader2 className="h-5 w-5 animate-spin" /> {stage ?? "Reading recipe…"}</>) : (<>{mode === "video" ? videoText === null ? "Analyze video" : "Use this recipe" : "Pinch it"} <ArrowRight className="h-5 w-5" /></>)}
      </Button>
    </section>
  );
}

/* ---------- 2. portions ---------- */

function PortionsStep({ recipe, portions, setPortions, onBack, onNext }: {
  recipe: ParsedRecipe; portions: number; setPortions: (n: number) => void; onBack: () => void; onNext: () => void;
}) {
  return (
    <section className="animate-rise">
      <Back onClick={onBack} />
      <p className="mb-1 text-sm uppercase tracking-widest text-muted-foreground">{recipe.title}</p>
      <Title sub="How many portions do you want to make?">
        This recipe makes <em className="text-accent">{recipe.servings}</em> portion{recipe.servings > 1 ? "s" : ""}.
      </Title>

      <div className="mb-6 flex items-center justify-between rounded-3xl border border-border bg-card p-3 shadow-soft">
        <button aria-label="Fewer" onClick={() => setPortions(Math.max(1, portions - 1))}
          className="tactile grid h-14 w-14 place-items-center rounded-2xl bg-secondary"><Minus /></button>
        <div className="text-center">
          <div className="font-display text-6xl leading-none">{portions}</div>
          <div className="mt-1 text-xs text-muted-foreground">portions</div>
        </div>
        <button aria-label="More" onClick={() => setPortions(Math.min(24, portions + 1))}
          className="tactile grid h-14 w-14 place-items-center rounded-2xl bg-secondary"><Plus /></button>
      </div>

      <div className="mb-8 grid grid-cols-4 gap-2">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
          <button key={n} onClick={() => setPortions(n)}
            className={cn("tactile rounded-xl py-3 text-sm font-medium",
              n === portions ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground",
              n === recipe.servings && n !== portions && "ring-1 ring-accent")}>
            {n === 8 ? "8+" : n}
          </button>
        ))}
      </div>

      <PrimaryButton onClick={onNext}>
        {portions === recipe.servings ? "Keep original" : `Scale to ${portions}`} <ArrowRight className="h-5 w-5" />
      </PrimaryButton>
    </section>
  );
}

/* ---------- 3. overview ---------- */

function MacroCard({ recipe }: { recipe: RecipeVersion }) {
  const n = recipe.nutrition;
  const items = [
    { k: "kcal", v: Math.round(n.kcal), u: "" },
    { k: "protein", v: Math.round(n.protein), u: "g" },
    { k: "carbs", v: Math.round(n.carbs), u: "g" },
    { k: "fat", v: Math.round(n.fat), u: "g" },
  ];
  return (
    <div className="mb-6 rounded-3xl bg-primary p-5 text-primary-foreground shadow-lift">
      <p className="mb-3 text-xs uppercase tracking-widest opacity-60">Per portion</p>
      <div className="grid grid-cols-4 gap-2">
        {items.map((i) => (
          <div key={i.k}>
            <div className="font-display text-3xl leading-none">{i.v}<span className="text-base">{i.u}</span></div>
            <div className="mt-1 text-xs opacity-60">{i.k}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ingredientLine(ing: ParsedRecipe["ingredients"][number], from: number, to: number, mode: UnitMode, multiplier = 1) {
  const q = ing.quantity == null ? null : ing.quantity * multiplier;
  return convertAmount(ing.name, q, ing.unit, from, to, mode);
}

function OverviewStep({ recipe, choice, onChoice, original, portions, onBack, onCook, onShop, unitMode, onUnitMode,
  adjust, removed, onAdjust, onRemove, grams, onGrams }: {
  recipe: RecipeVersion; choice: RecipeChoice; onChoice: (choice: RecipeChoice) => void; original: ParsedRecipe;
  portions: number; onBack: () => void; onCook: () => void; onShop: () => void;
  unitMode: UnitMode; onUnitMode: (m: UnitMode) => void;
  adjust: Record<number, number>; removed: Set<number>;
  onAdjust: (i: number, m: number) => void; onRemove: (i: number, on: boolean) => void;
  grams: Record<number, number>; onGrams: (i: number, g: number) => void;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const withGrams = applyOptionalAmounts(recipe, grams);
  const shown = applyAdjustments(withGrams, adjust, removed);
  const nutrition = computedNutrition(shown);
  const warnings = nutritionWarnings(nutrition);
  const tweaked = removed.size > 0 || Object.values(adjust).some((m) => m !== 1);
  return (
    <section className="animate-rise">
      <Back onClick={onBack} />
      <Title sub={`Scaled for ${portions} portion${portions > 1 ? "s" : ""}`}>{recipe.title}</Title>
      <div className="mb-4 grid grid-cols-2 gap-2" role="group" aria-label="Recipe version">
        <Button variant={choice === "yummy" ? "default" : "outline"} className="h-auto whitespace-normal py-3" aria-pressed={choice === "yummy"} onClick={() => { onChoice("yummy"); setOpen(null); }}>Same as original · 1:1</Button>
        <Button variant={choice === "healthier" ? "default" : "outline"} className="h-auto whitespace-normal py-3" aria-pressed={choice === "healthier"} onClick={() => { onChoice("healthier"); setOpen(null); }}>Modify to healthier</Button>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">{choice === "yummy"
        ? "Original ingredients and method from your source, with quantities scaled to your chosen portions. No healthier substitutions."
        : "Suggested changes by Pinch, not the original recipe. Cooking steps, estimated nutrition and shopping items reflect this version."}</p>
      {choice === "healthier" && <ul className="mb-4 list-disc space-y-1 pl-5 text-sm text-muted-foreground">{original.changes.map((change, i) => <li key={i}>{change}</li>)}</ul>}
      <MacroCard recipe={{ ...recipe, nutrition }} />
      {tweaked && <p className="-mt-3 mb-4 text-xs text-muted-foreground">Nutrition includes your ingredient changes. Unknown salt or free sugars cannot be recalculated; re-import older recipes for ingredient estimates.</p>}
      <div className="mb-5 text-sm text-muted-foreground">
        <p>Estimated per portion: salt {nutrition.salt == null ? "unknown" : `${nutrition.saltAtLeast ? "at least " : ""}${nutrition.salt.toFixed(1)} g`} · free sugars {nutrition.freeSugar == null ? "unknown" : `${nutrition.freeSugarAtLeast ? "at least " : ""}${nutrition.freeSugar.toFixed(1)} g`}</p>
        {(nutrition.saltAtLeast || nutrition.freeSugarAtLeast) && <p className="mt-1 text-xs">“At least” means some ingredients have no estimate, so the real amount may be higher.</p>}
        <p className="mt-1 text-xs">Meal planning budgets: 1.7 g salt and 8.3 g free sugars (one third of WHO adult daily guidance: less than 5 g salt; preferably 25 g free sugars at 2,000 kcal). Not official per-meal limits or personalised advice. All nutrition is estimated.</p>
        <a className="mt-1 inline-block underline" href="https://www.who.int/news-room/fact-sheets/detail/healthy-diet" target="_blank" rel="noreferrer">WHO guidance</a>
      </div>
      {(warnings.salt || warnings.freeSugar) && <div role="alert" className="mb-5 space-y-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm">
        <p>This portion is above the meal planning budget for {warnings.salt && warnings.freeSugar ? "salt and free sugars" : warnings.salt ? "salt" : "free sugars"}.</p>
        {choice === "yummy" ? <><p>Would you like to adjust this meal to a healthier version?</p><Button className="h-auto whitespace-normal" onClick={() => { onChoice("healthier"); setOpen(null); }}>Adjust to healthier version</Button></> : <p>The adjusted version is still above the budget. Consider less salty sauce or added sugar, and check product labels.</p>}
      </div>}

      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Amounts in</p>
        <div className="flex rounded-full bg-secondary p-1" role="group" aria-label="Measurement unit">
          {([["metric", "g / ml"], ["cups", "Cups"]] as const).map(([m, label]) => (
            <button key={m} aria-pressed={unitMode === m} onClick={() => onUnitMode(m)}
              className={cn("rounded-full px-3 py-1 text-xs font-medium",
                unitMode === m ? "bg-card text-foreground shadow-soft" : "text-muted-foreground")}>
              {label}
            </button>
          ))}
        </div>
      </div>
      {unitMode === "cups" && <p className="mb-3 text-xs text-muted-foreground">Cup amounts are approximate conversions; grams follow the recipe exactly.</p>}
      <p className="mb-3 text-xs text-muted-foreground">Estimated ingredient kcal per portion</p>
      <ul className="mb-8 divide-y divide-border rounded-3xl border border-border bg-card shadow-soft">
        {recipe.ingredients.map((ing, i) => {
          const isRemoved = removed.has(i);
          const m = adjust[i] ?? 1;
          const ingA = withGrams.ingredients[i] ?? ing;
          const changeLabel = ingredientChangeLabel(ing, recipe, original, portions);
          return (
            <li key={i} className={cn(isRemoved && "opacity-60")}>
              <button onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left">
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className={cn(isRemoved && "text-muted-foreground line-through")}>
                    {ing.name}
                    {ingA.optional && <span className="ml-2 rounded-full bg-secondary px-2 py-0.5 align-middle text-[10px] uppercase tracking-wide text-muted-foreground">Optional</span>}
                  </span>
                  {changeLabel && <span className="text-xs text-accent">{changeLabel}</span>}
                  {isRemoved && <span className="text-xs text-destructive">Removed from this meal</span>}
                  {m !== 1 && !isRemoved && <span className="text-xs text-accent">Amount × {m === 0.5 ? "½" : m === 1.5 ? "1½" : m}</span>}
                </span>
                <span className="flex shrink-0 flex-col items-end gap-0.5 tabular-nums">
                  <span className="text-sm text-muted-foreground">{ingredientLine(ingA, recipe.servings, portions, unitMode, m)}</span>
                  <span className="text-xs font-medium text-foreground">{isRemoved ? "0 kcal" : Number.isFinite(ingA.nutrition?.kcal) ? `≈ ${Math.round(ingA.nutrition.kcal * m / Math.max(1, recipe.servings))} kcal` : "kcal unknown"}</span>
                </span>
                <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open === i && "rotate-180")} />
              </button>
              {open === i && (
                <div className="border-t border-border px-4 py-3">
                  <p className="mb-2 text-xs text-muted-foreground">How much do you want to eat?</p>
                  <div className="mb-3 flex flex-wrap gap-2">
                    {[0.5, 1, 1.5, 2].map((v) => (
                      <button key={v} aria-pressed={m === v} onClick={() => onAdjust(i, v)}
                        className={cn("rounded-full border px-3 py-1 text-xs",
                          m === v ? "border-accent bg-accent text-accent-foreground" : "border-border text-muted-foreground")}>
                        ×{v === 0.5 ? "½" : v === 1.5 ? "1½" : v}
                      </button>
                    ))}
                  </div>
                  {ingA.quantity == null && (
                    <div className="mb-3">
                      <label htmlFor={`grams-${i}`} className="mb-1 block text-xs text-muted-foreground">Add an amount in grams (optional)</label>
                      <div className="flex items-center gap-2">
                        <input id={`grams-${i}`} type="number" min={1} inputMode="decimal" placeholder="e.g. 100"
                          value={grams[i] ?? ""} onChange={(e) => onGrams(i, Number(e.target.value.replace(",", ".")))}
                          className="w-24 rounded-lg border border-border bg-background px-3 py-2 text-sm tabular-nums" />
                        <span className="text-sm text-muted-foreground">g</span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">Kcal and macros update from the amount you add.</p>
                    </div>
                  )}
                  <button onClick={() => onRemove(i, !isRemoved)} className="text-xs text-muted-foreground underline">
                    {isRemoved ? "Add back to this meal" : "I'll skip this ingredient"}
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <p className="mb-4 text-center font-display text-2xl">Do you already have all these ingredients?</p>
      <div className="space-y-3">
        <PrimaryButton onClick={onCook}><ChefHat className="h-5 w-5" /> Yes, I have everything</PrimaryButton>
        <GhostButton onClick={onShop}><ShoppingBag className="h-5 w-5" /> No, I'm missing some items</GhostButton>
      </div>
    </section>
  );
}

/* ---------- 4. shop sheet ---------- */

function ShopSheet({ recipe, original, portions, onClose, onCook, unitMode, onUnitMode }: {
  recipe: RecipeVersion; original: RecipeVersion; portions: number; onClose: () => void; onCook: () => void;
  unitMode: UnitMode; onUnitMode: (m: UnitMode) => void;
}) {
  const [step, setStep] = useState<"items" | "pref" | "stores">("items");
  const [missing, setMissing] = useState<Set<number>>(new Set());
  const [pref, setPref] = useState<Preference | null>(null);
  const [loc, setLoc] = useState("");
  const [locating, setLocating] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);

  const missingItems = recipe.ingredients.filter((_, i) => missing.has(i));
  const [nearby, setNearby] = useState<Record<string, NearbyStore>>({});
  const [lookup, setLookup] = useState<"idle" | "loading" | "error">("idle");
  const [lookupError, setLookupError] = useState("");
  useEffect(() => {
    const q = loc.trim();
    if (!pref || !/^(\d{4}\s?[A-Z]{2}|-?\d{1,2}\.\d+,\s?-?\d{1,3}\.\d+)$/i.test(q)) { setNearby({}); setLookup("idle"); return; }
    let live = true;
    setLookup("loading");
    const t = setTimeout(() => {
      findNearbyStores({ data: { loc: q, stores: STORES.filter((s) => s.tier === pref).map((s) => s.name) } })
        .then((r) => { if (live) { setNearby(Object.fromEntries(r.stores.map((x) => [x.name, x]))); setLookup("idle"); } })
        .catch((e) => { if (live) { setLookupError(e instanceof Error ? e.message : "Lookup failed"); setLookup("error"); } });
    }, 500);
    return () => { live = false; clearTimeout(t); };
  }, [loc, pref]);
  const stores = useMemo(() => {
    if (!loc || !pref || lookup === "loading") return [];
    return STORES.filter((s) => s.tier === pref)
      .map((s) => ({ ...s, km: nearby[s.name]?.km ?? null, address: nearby[s.name]?.address ?? null, cost: estimateCart(missingItems.map((m) => m.category), s) }))
      .sort((a, b) => (a.km ?? 999) - (b.km ?? 999));
  }, [loc, pref, missingItems, nearby, lookup]);

  function useGps() {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => { setLoc(`${p.coords.latitude.toFixed(5)},${p.coords.longitude.toFixed(5)}`); setLocating(false); },
      () => setLocating(false),
    );
  }

  const [mode, setMode] = useState<"online" | "visit" | null>(null);
  const store = STORES.find((x) => x.id === selected);
  const coverage = store ? storeCoverage(store.id, missingItems) : null;
  useEffect(() => { setSelected(null); setAcknowledged(false); }, [loc, pref]);

  if (mode && store) {
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/30 backdrop-blur-sm" onClick={onClose}>
        <div onClick={(e) => e.stopPropagation()}
          className="animate-rise max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-[2rem] bg-background p-5 pb-8 shadow-lift">
          <ShopList store={store} mode={mode} loc={loc} address={nearby[store.name]?.address ?? null} items={missingItems.map((m) => ({ name: m.name, dutchName: m.dutchName, category: m.category, qty: ingredientLine(m, recipe.servings, portions, unitMode), changeLabel: ingredientChangeLabel(m, recipe, original, portions) ?? null }))}
            onBack={() => setMode(null)} onCook={onCook} />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/30 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="animate-rise max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-[2rem] bg-background p-5 pb-8 shadow-lift">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex gap-1.5">
            {["items", "pref", "stores"].map((s) => (
              <span key={s} className={cn("h-1.5 w-8 rounded-full", s === step ? "bg-accent" : "bg-border")} />
            ))}
          </div>
          <button aria-label="Close" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-secondary"><X className="h-4 w-4" /></button>
        </div>

        {step === "items" && (
          <>
            <h2 className="mb-1 font-display text-3xl">What do you need to buy?</h2>
            <p className="mb-3 text-sm text-muted-foreground">Select only the missing items.</p>
            <p className="mb-3 text-xs text-muted-foreground">Estimated ingredient kcal per portion</p>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Amounts in</p>
              <div className="flex rounded-full bg-secondary p-1" role="group" aria-label="Measurement unit">
                {([["metric", "g / ml"], ["cups", "Cups"]] as const).map(([m, label]) => (
                  <button key={m} aria-pressed={unitMode === m} onClick={() => onUnitMode(m)}
                    className={cn("rounded-full px-3 py-1 text-xs font-medium",
                      unitMode === m ? "bg-card text-foreground shadow-soft" : "text-muted-foreground")}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <ul className="mb-6 space-y-2">
              {recipe.ingredients.map((ing, i) => {
                const on = missing.has(i);
                const changeLabel = ingredientChangeLabel(ing, recipe, original, portions);
                return (
                  <li key={i}>
                    <button onClick={() => { const s = new Set(missing); on ? s.delete(i) : s.add(i); setMissing(s); }}
                      className={cn("tactile flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left",
                        on ? "border-accent bg-card shadow-soft" : "border-border")}>
                      <span className={cn("grid h-6 w-6 shrink-0 place-items-center rounded-lg border",
                        on ? "border-accent bg-accent text-accent-foreground" : "border-border")}>
                        {on && <Check className="h-4 w-4" />}
                      </span>
                      <span className="flex flex-1 flex-col gap-0.5">
                        <span>{ing.name}</span>
                        {changeLabel && <span className="text-xs text-accent">{changeLabel}</span>}
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-0.5 tabular-nums">
                        <span className="text-sm text-muted-foreground">{ingredientLine(ing, recipe.servings, portions, unitMode)}</span>
                        <span className="text-xs font-medium text-foreground">{Number.isFinite(ing.nutrition?.kcal) ? `≈ ${Math.round(ing.nutrition.kcal / Math.max(1, recipe.servings))} kcal` : "kcal unknown"}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <PrimaryButton disabled={!missing.size} onClick={() => setStep("pref")}>
              Continue with {missing.size} item{missing.size === 1 ? "" : "s"} <ArrowRight className="h-5 w-5" />
            </PrimaryButton>
          </>
        )}

        {step === "pref" && (
          <>
            <h2 className="mb-5 font-display text-3xl">What is your shopping preference?</h2>
            <div className="mb-6 space-y-3">
              {([
                { id: "cheap", t: "Cheapest as possible", d: "Budget stores & store brands — Lidl, Aldi, Dirk" },
                { id: "quality", t: "Branded / Higher quality", d: "Premium chains & name brands — Albert Heijn, Jumbo" },
              ] as const).map((o) => (
                <button key={o.id} onClick={() => setPref(o.id)}
                  className={cn("tactile w-full rounded-3xl border p-5 text-left",
                    pref === o.id ? "border-accent bg-card shadow-lift" : "border-border bg-card shadow-soft")}>
                  <div className="font-medium">{o.t}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{o.d}</div>
                </button>
              ))}
            </div>
            <PrimaryButton disabled={!pref} onClick={() => setStep("stores")}>Find stores <ArrowRight className="h-5 w-5" /></PrimaryButton>
            <button onClick={() => setStep("items")} className="mt-3 w-full text-sm text-muted-foreground">Back</button>
          </>
        )}

        {step === "stores" && (
          <>
            <h2 className="mb-5 font-display text-3xl">Nearby supermarkets</h2>
            <p className="mb-4 text-sm text-muted-foreground">Nearby options, not confirmed one-stop shops. Live stock is not connected; check every missing item before travelling.</p>
            <div className="mb-5 flex gap-2">
              <input value={loc} onChange={(e) => setLoc(e.target.value.toUpperCase())} placeholder="Postal code, e.g. 1012 AB"
                className="flex-1 rounded-2xl border border-border bg-card px-4 py-3 outline-none focus:border-accent" />
              <button onClick={useGps} aria-label="Use my location"
                className="tactile grid w-12 place-items-center rounded-2xl bg-secondary">
                {locating ? <Loader2 className="h-5 w-5 animate-spin" /> : <MapPin className="h-5 w-5" />}
              </button>
            </div>

            {lookup === "loading" && <p className="mb-4 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Finding the nearest stores…</p>}
            {lookup === "error" && <p className="mb-4 text-sm text-destructive">{lookupError}</p>}
            {stores.length > 0 && (
              <>
                <ul className="mb-3 space-y-2">
                  {stores.map((s) => (
                    <li key={s.id}>
                      <Button variant="outline" onClick={() => { setSelected(s.id); setAcknowledged(false); }} aria-pressed={selected === s.id}
                        className={cn("tactile flex h-auto w-full items-center justify-between whitespace-normal rounded-2xl border p-4 text-left",
                          selected === s.id ? "border-accent bg-card shadow-lift" : "border-border bg-card")}>
                        <div className="min-w-0">
                          <div className="font-medium">{s.name}</div>
                          <div className="text-sm text-muted-foreground">{s.km != null ? `${s.km} km away` : "No store found nearby"}</div>
                          {s.address && <div className="truncate text-xs text-muted-foreground">{s.address}</div>}
                          <div className="mt-2 text-xs text-foreground">{storeCoverage(s.id, missingItems).matched}/{missingItems.length} saved product matches</div>
                          <div className="text-xs text-destructive">{missingItems.length}/{missingItems.length} items: local stock unverified</div>
                          <span className={cn("mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px]",
                            s.cart === "auto" ? "bg-accent/15 text-accent" : "bg-secondary text-muted-foreground")}>
                            {s.cart === "auto" ? <Check className="h-3 w-3" /> : <Info className="h-3 w-3" />}
                            {CART_LABEL[s.cart]}
                          </span>
                        </div>
                        <div className="text-right">
                          <div className="font-display text-2xl">€{s.cost.toFixed(2)}</div>
                          <div className="text-xs text-muted-foreground">est. cart</div>
                        </div>
                      </Button>
                    </li>
                  ))}
                </ul>
                <p className="mb-4 text-xs text-muted-foreground">Nearest branch from Google Maps, straight-line distance. Cart prices are estimates.</p>
                {store && coverage && <section aria-label={`${store.name} shopping coverage`} className="mb-4 border-y border-border py-4">
                  <h3 className="font-medium">Check your whole list at {store.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{coverage.matched} saved product match{coverage.matched === 1 ? "" : "es"} · {coverage.unmatched} without a verified product match. Neither confirms stock at this branch.</p>
                  <ul className="my-3 divide-y divide-border">
                    {coverage.products.map((item, i) => <li key={i} className="flex items-start gap-3 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{item.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{item.product ? `Saved match: ${item.product.name}` : "No verified product match — check the store"}</p>
                        <p className="mt-1 text-xs text-destructive">Local stock unverified</p>
                      </div>
                      <Button asChild size="sm" variant="outline" className="shrink-0"><a href={item.product?.url ?? store.searchUrl(item.dutchName)} target="_blank" rel="noopener noreferrer">{item.product ? "Product" : "Search"}</a></Button>
                    </li>)}
                  </ul>
                  <label className="flex items-start gap-3 text-sm">
                    <input type="checkbox" checked={acknowledged} onChange={e => setAcknowledged(e.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-primary" />
                    <span>I understand the full list is not confirmed in stock and I may need another store.</span>
                  </label>
                </section>}
                {store && store.cart !== "auto" && (
                  <div className="mb-4 flex items-start gap-2 rounded-2xl border border-border bg-secondary/60 p-3 text-xs text-muted-foreground">
                    <Info className="mt-0.5 h-4 w-4 shrink-0" />
                    <span><span className="font-medium text-foreground">Before you choose: </span>{store.cartNote}</span>
                  </div>
                )}
                <PrimaryButton disabled={!selected || !acknowledged} onClick={() => setMode("visit")}>
                  <MapPin className="h-5 w-5" /> Go there & buy
                </PrimaryButton>
                <GhostButton className="mt-3" disabled={!selected || !acknowledged} onClick={() => setMode("online")}>
                  <ShoppingBag className="h-5 w-5" /> Fill online cart
                </GhostButton>
                <GhostButton className="mt-3" onClick={onCook}><ChefHat className="h-5 w-5" /> Start cooking</GhostButton>
              </>
            )}
            <button onClick={() => setStep("pref")} className="mt-3 w-full text-sm text-muted-foreground">Back</button>
          </>
        )}
      </div>
    </div>
  );
}

/* ---------- shopping list (visit / online) ---------- */

const HOUSE_BRAND: Record<string, string> = {
  lidl: "Lidl own brand", aldi: "Aldi own brand", dirk: "1 de Beste", ah: "AH Excellent / A-brand",
  jumbo: "Jumbo / A-brand", ekoplaza: "Ekoplaza Bio",
};
const AISLE: Record<string, string> = {
  produce: "Fruit & veg", dairy: "Dairy & eggs", meat: "Meat", fish: "Fish", pantry: "Pantry",
  bakery: "Bakery", spices: "Herbs & spices", frozen: "Frozen", other: "Other",
};

function useProductImage(name: string) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    const q = name.toLowerCase().replace(/\b(fresh|chopped|minced|large|small|ground|dried)\b/g, "").trim();
    fetch(`https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrsearch=${encodeURIComponent(q + " food")}&gsrlimit=1&prop=pageimages&piprop=thumbnail&pithumbsize=200`)
      .then((r) => r.json())
      .then((j) => {
        const page = j?.query?.pages && (Object.values(j.query.pages)[0] as { thumbnail?: { source: string } });
        if (alive) setSrc(page?.thumbnail?.source ?? null);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [name]);
  return src;
}

function ProductRow({ item, store, mode, done, onToggle }: {
  item: { name: string; dutchName: string; category: string; qty: string; changeLabel: string | null }; store: (typeof STORES)[number];
  mode: "online" | "visit"; done: boolean; onToggle: () => void;
}) {
  const img = useProductImage(item.name);
  const [search, setSearch] = useState(item.dutchName);
  const [copied, setCopied] = useState(false);
  const [linkState, setLinkState] = useState<"idle" | "copied" | "manual">("idle");
  const product = /\d+(?:[.,]\d+)?\s*%/.test(item.name) ? null : verifiedProduct(store.id, item.name);
  const productUrl = product?.url ?? store.searchUrl(search);
  return (
    <li className={cn("flex items-center gap-3 rounded-2xl border border-border bg-card p-3", done && "opacity-50")}>
      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-secondary">
        {img ? <img src={img} alt={item.name} loading="lazy" className="h-full w-full object-cover" />
          : <div className="grid h-full w-full place-items-center"><ShoppingBag className="h-5 w-5 text-muted-foreground" /></div>}
      </div>
      <div className="min-w-0 flex-1">
        <div className={cn("font-medium capitalize", done && "line-through")}>{item.name}</div>
        {item.changeLabel && <div className="text-xs text-accent">{item.changeLabel}</div>}
        <div className="text-xs text-muted-foreground">{item.qty} · {HOUSE_BRAND[store.id]} · {AISLE[item.category] ?? "Other"}</div>
        <p className="mt-1 text-xs text-destructive">{product ? "Saved product match · local stock unverified" : "No verified product match · local stock unverified"}</p>
        {mode === "online" && <>
          <input aria-label={`Dutch search for ${item.name}`} value={search} onChange={e => { setSearch(e.target.value); setCopied(false); }} className="mt-2 w-full min-w-0 rounded-md border border-border bg-background px-2 py-1 text-sm" />
          {product && <p className="mt-1 text-xs text-muted-foreground">Saved match: {product.name}{product.kcal != null ? ` · ${product.kcal} kcal/100 g` : ""} · choose packs for your recipe amount</p>}
          <Button size="sm" variant="ghost" className="mt-1" onClick={async () => { try { await navigator.clipboard.writeText(search); setCopied(true); } catch { setCopied(false); } }}>{copied ? "Copied" : "Copy Dutch name"}</Button>
          {store.id === "jumbo" && <>
            <Button size="sm" variant="ghost" className="mt-1" onClick={async () => { try { await navigator.clipboard.writeText(productUrl); setLinkState("copied"); } catch { setLinkState("manual"); } }}>{linkState === "copied" ? "Link copied" : "Copy link"}</Button>
            {linkState === "manual" && <input aria-label={`Jumbo link for ${item.name}`} readOnly value={productUrl} onFocus={e => e.currentTarget.select()} className="mt-1 w-full min-w-0 rounded-md border border-border bg-background px-2 py-1 text-xs" />}
          </>}
        </>}
      </div>
      {mode === "visit" ? (
        <button onClick={onToggle} aria-label="Mark as bought"
          className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg border", done ? "border-accent bg-accent text-accent-foreground" : "border-border")}>
          {done && <Check className="h-4 w-4" />}
        </button>
      ) : (
        <Button asChild size="sm" className="shrink-0"><a href={productUrl} target="_blank" rel="noopener noreferrer">{product ? "Product" : "Find"}</a></Button>
      )}
    </li>
  );
}

function ShopList({ store, mode, loc, address, items, onBack, onCook }: {
  store: (typeof STORES)[number]; mode: "online" | "visit"; loc: string; address: string | null;
  items: { name: string; dutchName: string; category: string; qty: string; changeLabel: string | null }[]; onBack: () => void; onCook: () => void;
}) {
  const [done, setDone] = useState<Set<number>>(new Set());
  const sorted = [...items].sort((a, b) => a.category.localeCompare(b.category));
  const maps = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(loc)}&destination=${encodeURIComponent(address ? `${store.name}, ${address}` : `${store.name} supermarket near ${loc}`)}&travelmode=walking`;
  const [mapCopied, setMapCopied] = useState(false);
  const [embedded, setEmbedded] = useState(false);
  useEffect(() => { try { setEmbedded(window.self !== window.top); } catch { setEmbedded(true); } }, []);
  return (
    <>
      <h2 className="mb-1 font-display text-3xl">{mode === "visit" ? `Your ${store.name} list` : `Shop ${store.name} online`}</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        {mode === "visit" ? "Sorted by aisle. Tick items off as you go." : "Your list, with a photo, name and amount for each item."}
      </p>
      <p role="alert" className="mb-4 text-sm text-destructive">This store is not confirmed to have your full list. Local stock is unverified for all {items.length} items; check with the branch before travelling.</p>
      {mode === "online" && (
        <div className="mb-5 flex items-start gap-2 rounded-2xl border border-border bg-secondary/60 p-3 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0 space-y-2">
            <p>{store.cartNote}</p>
            {store.id === "jumbo" && <p>Firefox security warning? Use “Copy link”, then open a brand-new tab yourself (Cmd/Ctrl + T) and paste it there. Pasting into the blocked tab doesn't work, because that tab keeps the block.</p>}
            {embedded && <PreviewBlockNote />}
            {store.id === "jumbo" && <Button asChild size="sm" variant="outline" className="h-auto whitespace-normal"><a href="https://www.jumbo.com/producten/" target="_blank" rel="noreferrer">Open Jumbo catalogue</a></Button>}
          </div>
        </div>
      )}
      <ul className="mb-6 space-y-2">
        {sorted.map((it, i) => (
          <ProductRow key={i} item={it} store={store} mode={mode} done={done.has(i)}
            onToggle={() => { const s = new Set(done); s.has(i) ? s.delete(i) : s.add(i); setDone(s); }} />
        ))}
      </ul>
      {mode === "visit" && (
        <>
        <a href={maps} target="_blank" rel="noopener noreferrer"
          className="tactile mb-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-4 font-medium text-primary-foreground shadow-lift">
          <MapPin className="h-5 w-5" /> Directions to {store.name}
        </a>
        <p className="mb-3 text-center text-xs text-muted-foreground">Blocked? <button className="underline" onClick={async () => { try { await navigator.clipboard.writeText(maps); setMapCopied(true); } catch { window.prompt("Copy this link", maps); } }}>{mapCopied ? "Link copied" : "Copy directions link"}</button> then open a brand-new tab (Cmd/Ctrl + T) and paste it there, not in the blocked tab.</p>
        {embedded && <div className="mb-3 text-xs text-muted-foreground"><PreviewBlockNote /></div>}
        </>
      )}
      <GhostButton onClick={onCook}><ChefHat className="h-5 w-5" /> Start cooking</GhostButton>
      <button onClick={onBack} className="mt-3 w-full text-sm text-muted-foreground">Back to stores</button>
    </>
  );
}

/** Links opened from the Lovable preview window inherit its restrictions, so Firefox blocks
 *  sites like Jumbo and Google Maps even after pasting into that same tab. A tab the user opens
 *  themselves has no such restriction. */
function PreviewBlockNote() {
  const [copied, setCopied] = useState(false);
  const url = "https://pinch-portion-nutrition.lovable.app";
  return (
    <p>You're using Pinch inside a preview window, so Firefox blocks shop and map pages opened from here. Open a brand-new tab (Cmd/Ctrl + T) and go to{" "}
      <button className="underline" onClick={async () => { try { await navigator.clipboard.writeText(url); setCopied(true); } catch { window.prompt("Copy this address", url); } }}>{copied ? "address copied" : "pinch-portion-nutrition.lovable.app"}</button>
      {" "}(after publishing), or paste the copied shop link there. Links then open normally.</p>
  );
}
