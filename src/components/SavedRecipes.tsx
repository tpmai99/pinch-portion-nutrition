import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, Trash2 } from "lucide-react";
import { deleteSaved, listSaved, type SavedRecipe } from "@/lib/saved-recipes";

export function SavedRecipes({ userId, onOpen, onBack }: {
  userId: string | null; onOpen: (r: SavedRecipe) => void; onBack: () => void;
}) {
  const [items, setItems] = useState<SavedRecipe[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    listSaved(userId).then(setItems).catch((e) => setError(e.message ?? "Could not load recipes"));
  }, [userId]);

  return (
    <section>
      <button onClick={onBack} className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>
      <h1 className="mb-2 font-display text-4xl leading-[1.05] tracking-tight">Saved recipes</h1>
      {!userId && <p className="mb-4 text-sm text-muted-foreground">Saved on this device only. Sign in to keep them on every device.</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
      {!items && !error && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
      {items?.length === 0 && <p className="text-muted-foreground">No saved recipes yet. Import one and tap Save.</p>}
      <ul className="space-y-2">
        {items?.map((r) => (
          <li key={r.id} className="flex items-center gap-2 rounded-2xl border border-border bg-card p-4 shadow-soft">
            <button className="flex-1 text-left" onClick={() => onOpen(r)}>
              <div className="font-medium">{r.title}</div>
              <div className="text-xs text-muted-foreground">
                {r.portions} portion{r.portions > 1 ? "s" : ""} · {r.choice === "yummy" ? "Original" : "Healthier"} · {new Date(r.createdAt).toLocaleDateString()}
              </div>
            </button>
            <button aria-label="Delete" className="p-2 text-muted-foreground"
              onClick={async () => { await deleteSaved(userId, r.id); setItems((l) => l?.filter((x) => x.id !== r.id) ?? null); }}>
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
