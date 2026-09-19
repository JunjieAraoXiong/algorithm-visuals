# Algorithm Visuals: agent guidance

This is the canonical guidance for this public visualization repository. Read this file and the complete target page before editing. Inspect the working tree, preserve existing visuals and learner material, and keep each change within the requested question.

## Purpose and language

- Make algorithm state visible to a beginner: what a variable refers to, what is stored in a structure, and what one line of code changes.
- Use concise Chinese explanations and controls. Keep actual variable names and code expressions from the question (for example, `curr_node` and `.next`); do not silently rename the learner's terms.
- Use one bilingual policy across a guide: pair an English problem name with its Chinese name, but make controls Chinese-first (`← 上一步`, `下一步 →`, `跳到步骤`). Use the static back-link label `← Algo Visual / 返回目录` everywhere.
- When the learner provides a photo or sketch, use its visual vocabulary and arrangement as the primary reference. The rules below are the default shared style for new pages, not a reason to erase a requested distinction.
- Draw original diagrams. Do not publish copied course images or private notes in this public repository.

## Shared visual language

The reference is a quiet textbook drawing on paper, as in `reverse-linked-list/index.html`:

- Warm off-white background `#fffdf8`, dark ink `#272727`, structural arrows `#333`, secondary arrows and labels `#555`, light borders `#999` or `#b7b7b1`. Use color only when it carries a specific meaning; never rely on color alone.
- No gradients, shadows, glossy buttons, decorative illustrations, or bright dashboard panels. Let spacing, line weight, shape, and short text establish hierarchy.
- Use a compact sans-serif for prose and node values, monospace for variables, expressions, and step counters. Prefer regular weight. Keep the diagram larger than its heading and controls.
- Use thin, simple outlines: circles for linked-list nodes, lightly rounded rectangles for variable labels, unboxed `null`/`None`, dashed rectangles for editable fields or the current operation. Adapt the shapes to the data structure rather than forcing every algorithm into linked-list symbols.
- Draw stored links as solid dark arrows. Draw variable references as thinner gray arrows from the label to the target. Keep a variable label near its current target so the reference stays short; offset labels when two variables share a node or occupy nearby positions. Animate the label and its short reference together when the target changes; if a separate movement cue helps, make it a gray dashed curve and label its meaning.
- Give each page a stable spatial layout while stepping. Move a node only if the algorithm truly moves it; changing a reference should move its arrow, not the node. Highlight the one change made by the current code line and avoid lingering highlights that imply another change.
- Put the current code expression and a plain-language explanation in a restrained dashed callout below the diagram. Keep that step-specific teaching visible. Do not add a generic legend or a paragraph explaining obvious controls; label any non-obvious visual distinction directly where it appears.
- Leave enough space between nodes, labels, and arrows to read them at phone and Notion embed widths. Use additional rows or a taller stage when a dense chain would otherwise crowd the diagram.

Use page-local CSS custom properties for diagram-specific palette values and dimensions. On core-backed pages, shared shell, control, code-panel, and positioning rules belong in `assets/visual.css`; treat the values above and the existing page as references, not as pixel-perfect constraints when a different structure needs more space.

## Content hierarchy

- The root catalog is navigation, not an essay: show the title, category names, and question cards. Do not add a manifesto, usage instructions, attribution copy, originality claims, or generic category prose.
- A guide leads with its title/problem, animation, controls, current-step explanation, and synchronized complete implementation. Keep why-it-works, edge cases, variants, and causal reasoning visible below; do not replace them with generic summaries.
- Say each idea once. Delete prose that merely restates a visible control, code line, diagram label, section title, or explanation already present on the page. Detail is valuable when it explains cause, invariants, tradeoffs, or an otherwise invisible state change; repetition is not.
- Do not add generic visual legends or interaction-instruction sections. Controls must be self-explanatory, keyboard/pointer accessible, and carry concise accessible names. If a visual encoding would otherwise be ambiguous, label it in the diagram or in the relevant live step rather than adding a separate help block.
- Remove throat-clearing such as “in this guide,” “use the controls,” “as shown above/below,” and claims about what the page will teach. Start with the problem or the state that matters.
- Keep bilingual text concise. Translate substantive teaching, not filler; never duplicate a generic sentence in two languages merely to fill space.
- Do not duplicate a miniature code block when the synchronized complete-code panel already contains that source. Keep a helper trace only when it teaches a distinct animation or retains a live current-line callout.
- End every guide with compact `相关题目` links to existing visual routes and the catalog (`../`); never invent routes.

## Interaction and explanation

- Show an initial state, meaningful intermediate states, and a final state. Advance by one meaningful code line or operation at a time. Show a visible step count and previous/next controls; revisiting a step restores its exact state.
- On wide screens, use the available viewport as a two-column learning workspace: keep the interactive animation and its controls on the left, and the complete implementation on the right. Use stable hooks such as `data-learning-layout`, `data-animation-panel`, and `data-code-panel`. The code panel should remain easy to consult while stepping (sticky when practical), while the page must collapse to one readable column before either side becomes cramped. Give grid children `min-width: 0`, keep long code scrolling inside its own `pre`, and do not create page-level horizontal scrolling.
- Synchronize the right-hand implementation with every scripted step. Give source lines stable IDs and store those IDs on the frame; never locate a line by display text or a numeric array index that shifts when comments change. Highlight the exact executable line or small group of lines represented by the current step, expose each active line with `aria-current="step"`, and keep it visible by scrolling only the code container, never the whole page. Initial, condition, early-return, and final-return frames also need an explicit mapping. Core-backed traces reject missing or duplicate source-line keys when frames are installed. A manual manipulation may clear the scripted highlight or label it as practice, but it must not pretend that the scripted trace advanced.
- Use `data-action="previous"` / `data-action="next"`, `data-count`, and (when a page offers direct frame navigation) `data-step-select` as the shared trace hooks. ArrowLeft/ArrowRight and Home/End must work when focus is inside the animation or its controls, without stealing native keyboard behavior from selects, text-entry fields, or the code scroller.
- Let `assets/core.js` own those hooks on core-backed pages. It provides the `#step=N` permalink, a copy-link control, and last-step restoration; do not duplicate hash, storage, button, code-scroll, or keyboard handlers in a page adapter.
- Use brief, purposeful JavaScript motion to show what changed between steps: keep nodes stationary and interpolate a variable's label and short reference to the new target. The step text may show the new logical state while the reference visibly moves there. Update stored links only when the code changes `.next`; briefly emphasize the edited field or its new solid link. Never draw a cue from the old target node to the new target node that could imply a link between them. For a distant row change or a switch from `None` to another head, briefly retract/fade the reference and reposition the label instead of stretching an arrow across the diagram. Keep transitions short, settle or cancel them on rapid input, resize, drag, or reset, and honor `prefers-reduced-motion` with an instant state change.
- Include a compact, visible explanation of the problem, the core idea, why it works, and the main solving steps below the diagram so the controls remain near the top on a phone. The current-step callout should connect the code line to the exact variable or stored link changing in the diagram. Explain important edge cases where they clarify the method.
- Distinguish references held by variables from links stored on nodes in both the drawing and explanation. State explicitly when only a variable changes and when a stored link changes.
- Where direct manipulation helps, allow dragging a source to a target. Also provide click-source-then-target operation for touch, keyboard, and embedded contexts. Show selected and available targets clearly, and report the resulting manual change without pretending it advanced the scripted trace. Do not add a separate paragraph explaining standard drag/click mechanics.
- Use semantic buttons, visible focus, accessible names that describe the current target, and a polite live region for the step and explanation. Never make hover or drag the sole way to understand or operate the visual.
- Fit a narrow phone or Notion embed width without horizontal clipping. Keep controls and the whole diagram readable at a practical embed height.

## Files and publishing

- Put each question at `<problem-slug>/index.html` and add one descriptive link to the root `index.html`. Keep the site build-free: new or migrated pages load `../assets/visual.css` and `../assets/core.js` for the shared visual contract, then keep their algorithm frames, layout, drawing, and mutation semantics in their local adapter. Do not add a bundler, framework runtime, or network dependency.
- Give every question page a visible, keyboard-focusable `<a href="../">` link back to the root visual catalog. Keep it near the page title so a learner never has to use browser history to return; do not substitute `history.back()` or a site-root `/` URL.
- Treat everything committed here as public. GitHub Pages serves `main` from the repository root. If a task includes publishing, check the live URL after pushing. If it includes a Notion embed, add the published URL to the matching page without replacing the learner's notes, then confirm the embed loads and its controls work.
- Before completion, check JavaScript syntax, the initial/intermediate/final diagram states, keyboard and pointer paths, narrow layout, and any requested embed. Report which checks actually ran and any limitation. Do not add tests that merely repeat implementation details.
