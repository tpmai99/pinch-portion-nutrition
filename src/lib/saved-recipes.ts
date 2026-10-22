import { supabase } from "@/integrations/supabase/client";
import type { ParsedRecipe } from "@/lib/recipe.functions";
import type { RecipeChoice } from "@/lib/recipe";
import type { Json } from "@/integrations/supabase/types";

export type SavedRecipe = {
  id: string;
  title: string;
  recipe: ParsedRecipe;
  portions: number;
  choice: RecipeChoice;
  createdAt: string;
  local: boolean;
};

const LOCAL_KEY = "pinch.savedRecipes";

function readLocal(): SavedRecipe[] {
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    return raw ? (JSON.parse(raw) as SavedRecipe[]) : [];
  } catch {
    return [];
  }
}
function writeLocal(list: SavedRecipe[]) {
  window.localStorage.setItem(LOCAL_KEY, JSON.stringify(list));
}

export async function listSaved(userId: string | null): Promise<SavedRecipe[]> {
  if (!userId) return readLocal();
  const { data, error } = await supabase
    .from("saved_recipes")
    .select("id,title,recipe,portions,choice,created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id, title: r.title, recipe: r.recipe as unknown as ParsedRecipe,
    portions: r.portions, choice: r.choice as RecipeChoice, createdAt: r.created_at, local: false,
  }));
}

export async function saveRecipe(userId: string | null, recipe: ParsedRecipe, portions: number, choice: RecipeChoice) {
  const title = recipe.title || "Untitled recipe";
  if (!userId) {
    const item: SavedRecipe = { id: crypto.randomUUID(), title, recipe, portions, choice, createdAt: new Date().toISOString(), local: true };
    writeLocal([item, ...readLocal()]);
    return;
  }
  const { error } = await supabase.from("saved_recipes").insert({
    user_id: userId, title, recipe: recipe as unknown as Json, portions, choice,
  });
  if (error) throw error;
}

export async function deleteSaved(userId: string | null, id: string) {
  if (!userId) { writeLocal(readLocal().filter((r) => r.id !== id)); return; }
  const { error } = await supabase.from("saved_recipes").delete().eq("id", id);
  if (error) throw error;
}

/** After sign-in, move recipes saved on this device into the account. */
export async function moveLocalToAccount(userId: string) {
  const local = readLocal();
  if (!local.length) return 0;
  const { error } = await supabase.from("saved_recipes").insert(local.map((r) => ({
    user_id: userId, title: r.title, recipe: r.recipe as unknown as Json, portions: r.portions, choice: r.choice,
  })));
  if (error) throw error;
  writeLocal([]);
  return local.length;
}
