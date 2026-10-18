import { findNearbyStores, type NearbyStore } from "@/lib/stores.functions";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, ArrowRight, Check, ChefHat, ImagePlus, Info, Link2, Loader2, MapPin, Minus, Plus, ShoppingBag, Type, X,
} from "lucide-react";
import { parseRecipe, type ParsedRecipe } from "@/lib/recipe.functions";
import { CART_LABEL, STORES, estimateCart, type Preference } from "@/lib/scale";
import { convertAmount, type UnitMode } from "@/lib/units";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { chooseRecipe, nutritionWarnings, type RecipeChoice, type RecipeVersion } from "@/lib/recipe";
import { jumboBeefProduct } from "@/lib/grocery";

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
  const activeRecipe = recipe ? chooseRecipe(recipe, choice) : null;

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
        <ImportStep onParsed={(r) => { setRecipe(r); setChoice("yummy"); setPortions(r.servings); setStage("portions"); }} />
      )}
      {stage === "portions" && recipe && (
        <PortionsStep recipe={recipe} portions={portions} setPortions={setPortions}
          onBack={() => setStage("import")} onNext={() => setStage("overview")} />
      )}
      {stage === "overview" && recipe && activeRecipe && (
        <OverviewStep recipe={activeRecipe} choice={choice} onChoice={setChoice} original={recipe} portions={portions} onBack={() => setStage("portions")}
          onCook={() => setStage("cook")} onShop={() => setShopOpen(true)} unitMode={unitMode} onUnitMode={setUnitMode} />
      )}
      {stage === "cook" && activeRecipe && <CookStep recipe={activeRecipe} onBack={() => setStage("overview")} />}

      {shopOpen && activeRecipe && (
        <ShopSheet recipe={activeRecipe} portions={portions} onClose={() => setShopOpen(false)}
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
  const [mode, setMode] = useState<"link" | "text" | "image">("link");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const ready = mode === "link" ? /^https?:\/\//.test(url) : mode === "text" ? text.trim().length > 20 : !!image;

  async function go() {
    setLoading(true); setError(null);
    try {
      const data = mode === "link" ? { url } : mode === "text" ? { text } : { imageDataUrl: image! };
      onParsed(await parse({ data }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally { setLoading(false); }
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
  ] as const;

  return (
    <section className="animate-rise">
      <Title sub="Paste a recipe link — TikTok, Reel or YouTube — the text itself, or a screenshot.">
        What are we <em>cooking</em> today?
      </Title>

      <div className="mb-4 grid grid-cols-3 gap-1 rounded-2xl bg-secondary p-1">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setMode(t.id)}
            className={cn("tactile flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm",
              mode === t.id ? "bg-card font-medium shadow-soft" : "text-muted-foreground")}>
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
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
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />
      </div>

      {error && <p className="mb-4 rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>}

      <PrimaryButton disabled={!ready || loading} onClick={go}>
        {loading ? (<><Loader2 className="h-5 w-5 animate-spin" /> Reading recipe…</>) : (<>Pinch it <ArrowRight className="h-5 w-5" /></>)}
      </PrimaryButton>
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

function ingredientLine(ing: ParsedRecipe["ingredients"][number], from: number, to: number, mode: UnitMode) {
  return convertAmount(ing.name, ing.quantity, ing.unit, from, to, mode);
}

function OverviewStep({ recipe, choice, onChoice, original, portions, onBack, onCook, onShop, unitMode, onUnitMode }: {
  recipe: RecipeVersion; choice: RecipeChoice; onChoice: (choice: RecipeChoice) => void; original: ParsedRecipe;
  portions: number; onBack: () => void; onCook: () => void; onShop: () => void;
  unitMode: UnitMode; onUnitMode: (m: UnitMode) => void;
}) {
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const warnings = nutritionWarnings(recipe.nutrition);
  return (
    <section className="animate-rise">
      <Back onClick={onBack} />
      <Title sub={`Scaled for ${portions} portion${portions > 1 ? "s" : ""}`}>{recipe.title}</Title>
      <div className="mb-4 grid grid-cols-2 gap-2" role="group" aria-label="Recipe version">
        <Button variant={choice === "yummy" ? "default" : "outline"} className="h-auto whitespace-normal py-3" aria-pressed={choice === "yummy"} onClick={() => { onChoice("yummy"); setChecked(new Set()); }}>Same as original · 1:1</Button>
        <Button variant={choice === "healthier" ? "default" : "outline"} className="h-auto whitespace-normal py-3" aria-pressed={choice === "healthier"} onClick={() => { onChoice("healthier"); setChecked(new Set()); }}>Modify to healthier</Button>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">{choice === "yummy"
        ? "Original ingredients and method from your source, with quantities scaled to your chosen portions. No healthier substitutions."
        : "Suggested changes by Pinch, not the original recipe. Cooking steps, estimated nutrition and shopping items reflect this version."}</p>
      {choice === "healthier" && <ul className="mb-4 list-disc space-y-1 pl-5 text-sm text-muted-foreground">{original.changes.map((change, i) => <li key={i}>{change}</li>)}</ul>}
      <MacroCard recipe={recipe} />
      <div className="mb-5 text-sm text-muted-foreground">
        <p>Estimated per portion: salt {recipe.nutrition.salt == null ? "unknown" : `${recipe.nutrition.salt.toFixed(1)} g`} · free sugars {recipe.nutrition.freeSugar == null ? "unknown" : `${recipe.nutrition.freeSugar.toFixed(1)} g`}</p>
        <p className="mt-1 text-xs">Meal planning budgets: 1.7 g salt and 8.3 g free sugars (one third of WHO adult daily guidance: less than 5 g salt; preferably 25 g free sugars at 2,000 kcal). Not official per-meal limits or personalised advice. All nutrition is estimated.</p>
        <a className="mt-1 inline-block underline" href="https://www.who.int/news-room/fact-sheets/detail/healthy-diet" target="_blank" rel="noreferrer">WHO guidance</a>
      </div>
      {(warnings.salt || warnings.freeSugar) && <div role="alert" className="mb-5 space-y-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm">
        <p>This portion is above the meal planning budget for {warnings.salt && warnings.freeSugar ? "salt and free sugars" : warnings.salt ? "salt" : "free sugars"}.</p>
        {choice === "yummy" ? <><p>Would you like to adjust this meal to a healthier version?</p><Button className="h-auto whitespace-normal" onClick={() => { onChoice("healthier"); setChecked(new Set()); }}>Adjust to healthier version</Button></> : <p>The adjusted version is still above the budget. Consider less salty sauce or added sugar, and check product labels.</p>}
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
      <ul className="mb-8 divide-y divide-border rounded-3xl border border-border bg-card shadow-soft">
        {recipe.ingredients.map((ing, i) => {
          const on = checked.has(i);
          return (
            <li key={i}>
              <button onClick={() => { const s = new Set(checked); on ? s.delete(i) : s.add(i); setChecked(s); }}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left">
                <span className={cn("grid h-6 w-6 shrink-0 place-items-center rounded-lg border",
                  on ? "border-accent bg-accent text-accent-foreground" : "border-border")}>
                  {on && <Check className="h-4 w-4" />}
                </span>
                <span className={cn("flex flex-1 flex-col gap-0.5", on && "text-muted-foreground")}>
                  <span className={cn(on && "line-through")}>{ing.name}</span>
                  {ing.changedFrom && <span className="text-xs text-accent">Changed · was: {ing.changedFrom}</span>}
                </span>
                <span className="text-sm tabular-nums text-muted-foreground">{ingredientLine(ing, recipe.servings, portions, unitMode)}</span>
              </button>
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

function ShopSheet({ recipe, portions, onClose, onCook, unitMode, onUnitMode }: {
  recipe: RecipeVersion; portions: number; onClose: () => void; onCook: () => void;
  unitMode: UnitMode; onUnitMode: (m: UnitMode) => void;
}) {
  const [step, setStep] = useState<"items" | "pref" | "stores">("items");
  const [missing, setMissing] = useState<Set<number>>(new Set());
  const [pref, setPref] = useState<Preference | null>(null);
  const [loc, setLoc] = useState("");
  const [locating, setLocating] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

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

  if (mode && store) {
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/30 backdrop-blur-sm" onClick={onClose}>
        <div onClick={(e) => e.stopPropagation()}
          className="animate-rise max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-[2rem] bg-background p-5 pb-8 shadow-lift">
          <ShopList store={store} mode={mode} loc={loc} address={nearby[store.name]?.address ?? null} items={missingItems.map((m) => ({ name: m.name, dutchName: m.dutchName, category: m.category, qty: ingredientLine(m, recipe.servings, portions, unitMode), changedFrom: m.changedFrom ?? null }))}
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
                        {ing.changedFrom && <span className="text-xs text-accent">Changed · was: {ing.changedFrom}</span>}
                      </span>
                      <span className="text-sm text-muted-foreground">{ingredientLine(ing, recipe.servings, portions, unitMode)}</span>
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
                      <button onClick={() => setSelected(s.id)}
                        className={cn("tactile flex w-full items-center justify-between rounded-2xl border p-4 text-left",
                          selected === s.id ? "border-accent bg-card shadow-lift" : "border-border bg-card")}>
                        <div className="min-w-0">
                          <div className="font-medium">{s.name}</div>
                          <div className="text-sm text-muted-foreground">{s.km != null ? `${s.km} km away` : "No store found nearby"}</div>
                          {s.address && <div className="truncate text-xs text-muted-foreground">{s.address}</div>}
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
                      </button>
                    </li>
                  ))}
                </ul>
                <p className="mb-4 text-xs text-muted-foreground">Nearest branch from Google Maps, straight-line distance. Cart prices are estimates.</p>
                {store && store.cart !== "auto" && (
                  <div className="mb-4 flex items-start gap-2 rounded-2xl border border-border bg-secondary/60 p-3 text-xs text-muted-foreground">
                    <Info className="mt-0.5 h-4 w-4 shrink-0" />
                    <span><span className="font-medium text-foreground">Before you choose: </span>{store.cartNote}</span>
                  </div>
                )}
                <PrimaryButton disabled={!selected} onClick={() => setMode("visit")}>
                  <MapPin className="h-5 w-5" /> Go there & buy
                </PrimaryButton>
                <GhostButton className="mt-3" disabled={!selected} onClick={() => setMode("online")}>
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

/* ---------- 5. cook ---------- */

function CookStep({ recipe, onBack }: { recipe: RecipeVersion; onBack: () => void }) {
  const [i, setI] = useState(0);
  const [done, setDone] = useState<Set<number>>(new Set());
  const total = recipe.steps.length;
  const finished = done.size === total;

  return (
    <section className="animate-rise">
      <Back onClick={onBack} />
      <div className="mb-3 flex items-center justify-between text-sm text-muted-foreground">
        <span>Step {i + 1} of {total}</span>
        <span>{done.size} done</span>
      </div>
      <div className="mb-6 h-1.5 overflow-hidden rounded-full bg-secondary">
        <div className="h-full bg-accent transition-all" style={{ width: `${(done.size / total) * 100}%` }} />
      </div>

      <div key={i} className="animate-rise mb-6 min-h-[16rem] rounded-[2rem] border border-border bg-card p-6 shadow-lift">
        <div className="mb-4 font-display text-6xl text-accent">{String(i + 1).padStart(2, "0")}</div>
        <p className="text-2xl leading-snug">{recipe.steps[i]}</p>
        <button onClick={() => { const s = new Set(done); s.has(i) ? s.delete(i) : s.add(i); setDone(s); }}
          className={cn("tactile mt-6 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm",
            done.has(i) ? "bg-accent text-accent-foreground" : "bg-secondary")}>
          <Check className="h-4 w-4" /> {done.has(i) ? "Done" : "Mark done"}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <GhostButton disabled={i === 0} onClick={() => setI(i - 1)}><ArrowLeft className="h-5 w-5" /> Prev</GhostButton>
        <PrimaryButton disabled={i === total - 1}
          onClick={() => { setDone(new Set(done).add(i)); setI(i + 1); }}>
          Next <ArrowRight className="h-5 w-5" />
        </PrimaryButton>
      </div>

      {finished && (
        <p className="mt-8 text-center font-display text-3xl italic">Bon appétit.</p>
      )}

      <div className="mt-8 flex flex-wrap gap-1.5">
        {recipe.steps.map((_, n) => (
          <button key={n} onClick={() => setI(n)}
            className={cn("h-8 w-8 rounded-full text-xs",
              n === i ? "bg-primary text-primary-foreground" : done.has(n) ? "bg-accent/20 text-accent" : "bg-secondary text-muted-foreground")}>
            {n + 1}
          </button>
        ))}
      </div>
    </section>
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
  item: { name: string; dutchName: string; category: string; qty: string; changedFrom: string | null }; store: (typeof STORES)[number];
  mode: "online" | "visit"; done: boolean; onToggle: () => void;
}) {
  const img = useProductImage(item.name);
  const [search, setSearch] = useState(item.dutchName);
  const [copied, setCopied] = useState(false);
  const [linkState, setLinkState] = useState<"idle" | "copied" | "manual">("idle");
  const product = store.id === "jumbo" && !/\d+(?:[.,]\d+)?\s*%/.test(item.name) ? jumboBeefProduct(search) : null;
  const productUrl = product?.url ?? store.searchUrl(search);
  return (
    <li className={cn("flex items-center gap-3 rounded-2xl border border-border bg-card p-3", done && "opacity-50")}>
      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-secondary">
        {img ? <img src={img} alt={item.name} loading="lazy" className="h-full w-full object-cover" />
          : <div className="grid h-full w-full place-items-center"><ShoppingBag className="h-5 w-5 text-muted-foreground" /></div>}
      </div>
      <div className="min-w-0 flex-1">
        <div className={cn("font-medium capitalize", done && "line-through")}>{item.name}</div>
        {item.changedFrom && <div className="text-xs text-accent">Changed · was: {item.changedFrom}</div>}
        <div className="text-xs text-muted-foreground">{item.qty} · {HOUSE_BRAND[store.id]} · {AISLE[item.category] ?? "Other"}</div>
        {mode === "online" && <>
          <input aria-label={`Dutch search for ${item.name}`} value={search} onChange={e => { setSearch(e.target.value); setCopied(false); }} className="mt-2 w-full min-w-0 rounded-md border border-border bg-background px-2 py-1 text-sm" />
          {product && <p className="mt-1 text-xs text-muted-foreground">{product.name} · {product.kcal} kcal/100 g · choose packs for your recipe amount</p>}
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
  items: { name: string; dutchName: string; category: string; qty: string }[]; onBack: () => void; onCook: () => void;
}) {
  const [done, setDone] = useState<Set<number>>(new Set());
  const sorted = [...items].sort((a, b) => a.category.localeCompare(b.category));
  const maps = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(loc)}&destination=${encodeURIComponent(address ? `${store.name}, ${address}` : `${store.name} supermarket near ${loc}`)}&travelmode=walking`;
  const [mapCopied, setMapCopied] = useState(false);
  return (
    <>
      <h2 className="mb-1 font-display text-3xl">{mode === "visit" ? `Your ${store.name} list` : `Shop ${store.name} online`}</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        {mode === "visit" ? "Sorted by aisle. Tick items off as you go." : "Your list, with a photo, name and amount for each item."}
      </p>
      {mode === "online" && (
        <div className="mb-5 flex items-start gap-2 rounded-2xl border border-border bg-secondary/60 p-3 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0 space-y-2">
            <p>{store.cartNote}</p>
            {store.id === "jumbo" && <p>Firefox security warning? Use “Copy link” on the item and paste it into the address bar of a new browser tab. Keep your browser security enabled.</p>}
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
        <p className="mb-3 text-center text-xs text-muted-foreground">Blocked? <button className="underline" onClick={async () => { try { await navigator.clipboard.writeText(maps); setMapCopied(true); } catch { window.prompt("Copy this link", maps); } }}>{mapCopied ? "Link copied" : "Copy directions link"}</button> and paste it into a new tab.</p>
        </>
      )}
      <GhostButton onClick={onCook}><ChefHat className="h-5 w-5" /> Start cooking</GhostButton>
      <button onClick={onBack} className="mt-3 w-full text-sm text-muted-foreground">Back to stores</button>
    </>
  );
}
