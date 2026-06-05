# Research: Operationalizing Collapse vs. Thriving

Gathered to redesign `classifyOutcome` (ARD 051). The goal: ground the COLLAPSE / STRUGGLING /
STABLE / THRIVING verdict in how collapse and societal health are actually defined across the
collapse literature, rather than in the model-specific terms of any single inspiration. Sources:
Tainter, *The Collapse of Complex Societies* (1988); Turchin & Nefedov, *Secular Cycles* (2009) and
structural-demographic theory; Diamond, *Collapse* (2005); Motesharrei et al., HANDY (2014); the
*Societal collapse* literature review (Sci. Direct 2022) and standard demographic indicators.

Deliberately **not HANDY-centric** — HANDY is one of three project inspirations (Sugarscape,
cliodynamics, HANDY), and its Elite/Commoner/Nature/Wealth equations don't map onto this model.

## What "collapse" means across frameworks

- **Tainter:** collapse = a rapid, substantial loss of an established level of sociopolitical
  complexity. Empirically it co-occurs with steep **population decline** — estimates run **75–90%**
  in documented cases (e.g. the Mycenaean collapse).
- **Turchin (structural-demographic theory):** societies oscillate between an *integrative* phase
  (stability, growth, low inequality, high popular wellbeing) and a *disintegrative* phase, whose
  markers are **immiseration** (falling real wages / wellbeing), **rising inequality** ("elite
  overproduction"), **political violence/instability**, and **rising mortality / population
  decline**.
- **Diamond:** collapse is driven substantially by **ecological strain** — depletion of the
  resource base a society depends on (deforestation, soil exhaustion, overexploitation).
- **HANDY (one of several):** collapse arises from **inequality** and/or **resource
  overexploitation**; sustainability is a steady state at carrying capacity with equitable
  distribution and sustainable depletion. Useful as confirmation that inequality and ecology are
  independent collapse drivers, not for its Type-L/Type-N taxonomy.
- **Demography:** a *collapse* (vs. a blip) is a **sustained** decline, confirmed over multiple
  periods rather than a single down-tick; magnitude and persistence both matter.

**Synthesis — collapse is multi-dimensional.** The common, model-agnostic markers are: (1)
sustained population decline **from peak**, (2) immiseration (low wellbeing), (3) high inequality,
(4) ecological strain (depleted commons). No single axis is sufficient; any one strongly present
indicates disintegration.

## What "thriving" means

Across the same sources, the integrative/healthy state is the inverse on every axis: a population
**at or near its sustainable peak (not in decline)**, **low inequality**, **high wellbeing**, and a
**healthy resource base** (living within carrying capacity, not drawing the commons down). Notably,
bigger population is *not* itself thriving — overshoot that exhausts the resource base is the
prelude to collapse, not a success. So a thriving verdict must require ecological health, not just
low Gini and high happiness.

## Mapping to model quantities

The model's `TenYearSummary` already records each axis:

| Literature axis | Model quantity |
|---|---|
| Population decline from peak | `endPopulation` across `decadeHistory` → peak vs. final |
| Inequality | `avgResourceGini` |
| Wellbeing / immiseration | `avgHappiness` |
| Ecological strain | `avgNaturalResources` ÷ ceiling (commons fill fraction) |
| Political violence (deferred) | `deathsByKilling` ÷ `totalDeaths` |

The old classifier used only inequality and wellbeing, plus population measured against the
*start* — which in a boom-bust model fails to register a crash that is still above the starting
count, and never registers ecological strain.

## Design implications (→ ARD 051)

1. **Measure population decline from the peak the run reached**, not from the start. Archaeological
   collapses lose 75–90% from peak; at simulation scale a ~50% loss from peak is a strong collapse
   signal, ~25% a struggle signal. (Thresholds are calibration; values live in `Variables.ts`.)
2. **Read the decade history, not one decade**, so peak and trajectory are visible — a single
   snapshot can't tell a population at its peak from one mid-crash.
3. **Gate THRIVING on ecological health**: low Gini + high wellbeing are necessary but not
   sufficient; the population must also be near peak and the commons not drawn down. This closes
   the "overshoot reads as thriving" blind spot.
4. **Treat a depleted commons as a stress (STRUGGLING) signal** in its own right, capturing the
   pre-crash overexploitation state that Diamond/HANDY identify.
5. **Defer political-violence share** — a real Turchin signal the model could use, but noisy at
   ~100-person scale; the four core axes come first.
