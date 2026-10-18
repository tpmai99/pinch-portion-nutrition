import { useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, ChefHat, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cookingSections, type CookingSection } from "@/lib/cooking";
import type { RecipeVersion } from "@/lib/recipe";
import { cn } from "@/lib/utils";

export function CookingGuide({ recipe, onBack }: { recipe: RecipeVersion; onBack: () => void }) {
  const sections = useMemo(() => cookingSections(recipe), [recipe]);
  const [active, setActive] = useState<CookingSection["id"] | null>(null);
  const [done, setDone] = useState<Set<number>>(new Set());
  const [skippedPrep, setSkippedPrep] = useState(false);
  const [details, setDetails] = useState<Set<number>>(new Set());
  const sectionRefs = useRef<Partial<Record<CookingSection["id"], HTMLElement | null>>>({});
  const tasks = sections.flatMap(section => section.tasks);
  const finished = tasks.length > 0 && sections.every(section =>
    (section.id === "preparation" && skippedPrep) || section.tasks.every(task => done.has(task.id)));

  function start(id: CookingSection["id"]) {
    setActive(id);
    if (id === "preparation") setSkippedPrep(false);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    sectionRefs.current[id]?.scrollIntoView({ behavior: reduced ? "instant" : "smooth", block: "start" });
  }

  return (
    <section className="animate-rise">
      <Button variant="ghost" size="sm" className="mb-4 -ml-3 text-muted-foreground" onClick={onBack}>
        <ArrowLeft className="h-4 w-4" /> Back to recipe
      </Button>
      <p className="mb-2 text-sm text-muted-foreground">{recipe.title}</p>
      <h1 className="mb-3 font-display text-4xl leading-tight">Let’s cook.</h1>
      <div className="mb-6 flex items-center gap-2 text-sm text-muted-foreground" aria-live="polite">
        <ChefHat className="h-4 w-4" />
        <span>{done.size} of {tasks.length} tasks done{skippedPrep ? " · Preparation skipped" : ""}</span>
      </div>

      <div className="divide-y divide-border border-y border-border">
        {sections.map((section, index) => {
          const expanded = active === section.id;
          const completed = section.tasks.length > 0 && section.tasks.every(task => done.has(task.id));
          const skipped = section.id === "preparation" && skippedPrep;
          return (
            <section key={section.id} ref={el => { sectionRefs.current[section.id] = el; }} className="scroll-mt-5 py-6">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="font-display text-2xl">{index + 1}. {section.title}</h2>
                <span className="shrink-0 text-xs text-muted-foreground">{skipped ? "Skipped" : completed ? "Complete" : `${section.tasks.length} tasks`}</span>
              </div>
              {!section.tasks.length ? (
                <p className="text-sm text-muted-foreground">{section.id === "preparation" ? "No separate preparation instructions in this recipe." : "No cooking instructions in this recipe."}</p>
              ) : (
                <>
                  {!expanded && <ul className="mb-4 space-y-2 text-sm text-muted-foreground">
                    {section.tasks.map(task => <li key={task.id} className="flex items-start gap-2">
                      <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-accent" />
                      <span className="line-clamp-2">{task.summary}</span>
                    </li>)}
                  </ul>}
                  <div className="flex flex-wrap items-center gap-2">
                    <Button variant={expanded ? "outline" : "default"} aria-expanded={expanded} aria-controls={`${section.id}-tasks`}
                      onClick={() => expanded ? setActive(null) : start(section.id)}>
                      {expanded ? "Close details" : completed || skipped ? `Review ${section.title.toLowerCase()}` : `Start ${section.title.toLowerCase()}`}
                      <ChevronDown className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")} />
                    </Button>
                    {section.id === "preparation" && !skipped && !completed && <Button variant="ghost" size="sm" onClick={() => { setSkippedPrep(true); start("cooking"); }}>Skip preparation <ArrowRight className="h-4 w-4" /></Button>}
                  </div>
                  {expanded && <ol id={`${section.id}-tasks`} className="mt-5 divide-y divide-border">
                    {section.tasks.map((task, i) => {
                      const checked = done.has(task.id);
                      const open = details.has(task.id);
                      return <li key={task.id} className="py-4">
                        <div className="flex items-start gap-3">
                          <Button variant={checked ? "default" : "outline"} size="icon" className="h-8 w-8 shrink-0" aria-label={`Mark ${section.title.toLowerCase()} task ${i + 1} ${checked ? "not done" : "done"}`} aria-pressed={checked}
                            onClick={() => setDone(previous => { const next = new Set(previous); checked ? next.delete(task.id) : next.add(task.id); return next; })}>
                            {checked ? <Check className="h-4 w-4" /> : <span className="text-xs">{i + 1}</span>}
                          </Button>
                          <div className="min-w-0 flex-1">
                            <p className={cn("text-base leading-relaxed", checked && "text-muted-foreground line-through")}>{open ? task.instruction : task.summary}</p>
                            {task.summary !== task.instruction && <Button variant="ghost" size="sm" className="mt-1 -ml-3 text-muted-foreground" aria-expanded={open}
                              onClick={() => setDetails(previous => { const next = new Set(previous); open ? next.delete(task.id) : next.add(task.id); return next; })}>
                              {open ? "Less detail" : "Full instructions"} <ChevronDown className={cn("h-3 w-3", open && "rotate-180")} />
                            </Button>}
                          </div>
                        </div>
                      </li>;
                    })}
                  </ol>}
                </>
              )}
            </section>
          );
        })}
      </div>
      {finished && <p role="status" className="mt-8 text-center font-display text-3xl italic">Bon appétit.</p>}
    </section>
  );
}