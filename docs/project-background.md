# Project Background

## Research Inspirations

This project is inspired by:

- **Sugarscape** (Epstein & Axtell, 1996) — agent-based modeling of emergent social behavior
- **HANDY** civilizational collapse model (Motesharrei et al., 2014) — formal modeling of collapse dynamics
- **Cliodynamics** (Turchin) — quantitative history and societal cycles

Key HANDY finding: collapse is driven by resource overexploitation combined with inequality — not scarcity alone. This is why the Gini coefficient of `resources` is tracked per tick as the primary collapse signal rather than average resources.

## Git Workflow Rationale

The project uses squash merges into `master` rather than merge commits or rebase.

**Why squash:**
- `master` reads as a narrative, not a topology — each commit is one complete piece of work
- ARD immutability is meaningful: nothing lands on `master` by accident
- Branch work can be as granular as needed without cluttering the main history
- Each squash commit is a natural unit for revert if something goes wrong

## Design Pattern Philosophy

This project deliberately explores design patterns — but only when they have a concrete job to do. Before applying a pattern, answer: *what specific problem does this solve here?* If you can't answer that concretely, don't use it.

When a pattern stops earning its place — the abstraction adds more friction than it removes, or the problem it solved no longer exists — remove it and simplify. A pattern that made sense at one stage of the project may not survive the next. That's expected, not a failure.
