export type BeefProduct = { name: string; url: string; kcal: number; grams: number };
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
  const terms: Record<string, string> = {
    "minced beef": "rundergehakt", "ground beef": "rundergehakt", "lean minced beef": "mager rundergehakt",
    "extra lean minced beef": "extra mager rundergehakt", "onion": "ui", "garlic": "knoflook",
    "salt": "zout", "sugar": "suiker", "olive oil": "olijfolie", "tomatoes": "tomaten",
  };
  return terms[name.toLowerCase().trim()] ?? name.trim();
}