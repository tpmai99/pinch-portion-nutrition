export type BeefProduct = { name: string; url: string; kcal: number; grams: number };
export function splitIngredientName(name: string) {
  const match = name.match(/[,;]\s*(?=(?:cut|chopped|sliced|diced|minced|grated|peeled|crushed|whites?|greens?|finely|roughly|gesneden|gehakt|geraspt)\b)/i);
  if (match?.index == null) return { name: name.trim(), preparation: "" };
  return { name: name.slice(0, match.index).trim(), preparation: name.slice(match.index + 1).trim() };
}
// Product pages and label values checked on 18 October 2026. No stock guarantee.
const BEEF: Record<"regular" | "lean" | "extraLean", BeefProduct> = {
  regular: { name: "Jumbo Rundergehakt 500 g", url: "https://www.jumbo.com/producten/jumbo-rundergehakt-500-g-131278BAK", kcal: 244, grams: 500 },
  lean: { name: "Jumbo Rund Mager Gehakt 400 g", url: "https://www.jumbo.com/producten/jumbo-rund-mager-gehakt-400-g-716180TRA", kcal: 201, grams: 400 },
  extraLean: { name: "Jumbo Gehakt Extra Mager Rund 300 g", url: "https://www.jumbo.com/producten/jumbo-gehakt-extra-mager-rund-300-g-771112TRA", kcal: 161, grams: 300 },
};
export function jumboBeefProduct(name: string): BeefProduct | null {
  if (/vegan|vegetar|plant|pork|varken|half.om.half|chicken|kip|turkey|kalkoen/i.test(name)) return null;
  if (!/(?:minced|ground).*beef|beef.*(?:mince|ground)|rundergehakt|rund.*gehakt|gehakt.*rund/i.test(name)) return null;
  const fatLimit = name.match(/(\d+(?:[.,]\d+)?)\s*%/);
  // The verified extra-lean product has 9.4 g fat/100 g, not 5%.
  if (fatLimit?.[1] && Number(fatLimit[1].replace(",", ".")) < 9.4) return null;
  if (/extra[ -]?(?:lean|mager)/i.test(name)) return BEEF.extraLean;
  return /lean|mager/i.test(name) ? BEEF.lean : BEEF.regular;
}
export function dutchGroceryTerm(name: string) {
  const simple = splitIngredientName(name).name;
  const terms: Record<string, string> = {
    "minced beef": "rundergehakt", "ground beef": "rundergehakt", "lean minced beef": "mager rundergehakt",
    "extra lean minced beef": "extra mager rundergehakt", "onion": "ui", "garlic": "knoflook",
    "salt": "zout", "sugar": "suiker", "olive oil": "olijfolie", "tomatoes": "tomaten",
    "spring onions": "bosui", "spring onion": "bosui", "scallions": "bosui", "green onions": "bosui",
  };
  return terms[simple.toLowerCase()] ?? simple;
}