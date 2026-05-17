# ARD 038: Handlebars HTML Generation

**Status:** Accepted
**Date:** 2026-05-17

## Context
The `writeReportHTML` function in `src/Helpers/ReportWriter.ts` currently generates the end-of-simulation HTML report by concatenating large string templates. As the report has grown in complexity (adding new charts, dynamic data integration, and conditional formatting like the EXTINCTION color), the inline string manipulation has become unwieldy and prone to syntax errors. The HTML structure is interleaved with JavaScript logic, making it difficult to maintain or modify the report layout.

## Decision
We will introduce `handlebars` (as a `devDependency`, preserving the rule of no production dependencies) to manage the HTML template generation. The inline HTML string in `ReportWriter.ts` will be extracted into a separate `.hbs` template file. `ReportWriter.ts` will load this template, compile it using `handlebars`, and pass the processed data context to generate the final HTML output.

## Reasoning
We considered extracting the HTML logic into helper functions that return smaller string templates. However, this rejected alternative still interleaves HTML with JavaScript and does not resolve the poor readability of inline syntax. `handlebars` enforces a clean separation between the template structure and the data preparation logic. It allows us to keep the HTML readable and maintainable while adhering to the project constraint of having only `devDependencies` (since the report generation runs entirely in the local Node environment).

## Consequences
- The `handlebars` and `@types/handlebars` packages must be added to `devDependencies`.
- The existing HTML string in `src/Helpers/ReportWriter.ts` will be moved to a template file (e.g., `src/Helpers/report-template.hbs`).
- `ReportWriter.ts` will read this template from the file system and compile it.
- Existing tests for `ReportWriter.ts` may need to be updated to account for reading the external template file.
