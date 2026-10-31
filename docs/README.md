# Docs map

Start here to find the right doc for a question. `CLAUDE.md` at the repo root has the process rules and the current research state.

| I want to know | Read |
|---|---|
| What an event computes: formulas, gates, tick order | [odd-protocol.md](odd-protocol.md) (§7 Submodels, §3 Process overview and scheduling) |
| Why a subsystem works the way it does | [model-reference.md](model-reference.md), then the ARD it cites |
| The full argument for one decision, including what was rejected | [decisions/](decisions/README.md): the index lists every ARD with its status |
| How to run a sweep, which metrics to trust, what tuning cannot fix | [calibration-guide.md](calibration-guide.md) |
| What was measured, and whether it still stands | [studies.md](studies.md): every `research-*.md` with its finding and status |
| What real-world data a constant is based on | The "Real-world anchors" table in [studies.md](studies.md) |
| A mechanism that might be worth building | [future-ideas.md](future-ideas.md) |
| Where the project's inspirations and philosophy come from | [project-background.md](project-background.md) |

## Reading order for a new task

1. `CLAUDE.md`, including its "Research state" section, before you interpret any result.
2. The row for your topic above. For a result, check its status in [studies.md](studies.md) before relying on it.
3. The ARD behind any constant or mechanic you plan to change. Do not change a design choice without reading why it was made.

## Keeping this folder in order

The rules live in `CLAUDE.md` under "Keeping the docs in order". In short: each fact has one home and other docs link to it, every new study gets a row in [studies.md](studies.md) in the same commit, and a study whose result is contradicted gets a status banner at the top.
