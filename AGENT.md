# Algorithm Visuals: agent guidance

This is the canonical guidance for this public visualization repository. Read this file and the complete target page before editing. Inspect the working tree, preserve existing visuals and learner material, and keep each change within the requested question.

## Purpose and language

- Make algorithm state visible to a beginner: what a variable refers to, what is stored in a structure, and what one line of code changes.
- Use concise Chinese explanations and controls. Keep actual variable names and code expressions from the question (for example, `curr_node` and `.next`); do not silently rename the learner's terms.
- When the learner provides a photo or sketch, use its visual vocabulary and arrangement as the primary reference. The rules below are the default shared style for new pages, not a reason to erase a requested distinction.
- Draw original diagrams. Do not publish copied course images or private notes in this public repository.

## Shared visual language

The reference is a quiet textbook drawing on paper, as in `reverse-linked-list/index.html`:

- Warm off-white background `#fffdf8`, dark ink `#272727`, structural arrows `#333`, secondary arrows and labels `#555`, light borders `#999` or `#b7b7b1`. Use color only when it carries a specific meaning; never rely on color alone.
- No gradients, shadows, glossy buttons, decorative illustrations, or bright dashboard panels. Let spacing, line weight, shape, and short text establish hierarchy.
- Use a compact sans-serif for prose and node values, monospace for variables, expressions, and step counters. Prefer regular weight. Keep the diagram larger than its heading and controls.
- Use thin, simple outlines: circles for linked-list nodes, lightly rounded rectangles for variable labels, unboxed `null`/`None`, dashed rectangles for editable fields or the current operation. Adapt the shapes to the data structure rather than forcing every algorithm into linked-list symbols.
- Draw stored links as solid dark arrows. Draw variable references as thinner gray arrows from the label to the target. Animate the variable arrow itself when its target changes; if a separate movement cue helps, make it a gray dashed curve and label its meaning.
- Give each page a stable spatial layout while stepping. Move a node only if the algorithm truly moves it; changing a reference should move its arrow, not the node. Highlight the one change made by the current code line and avoid lingering highlights that imply another change.
- Put the current code expression and a plain-language explanation in a restrained dashed callout below the diagram. Keep a short legend and an interaction hint visible without covering the drawing.
- Leave enough space between nodes, labels, and arrows to read them at phone and Notion embed widths. Use additional rows or a taller stage when a dense chain would otherwise crowd the diagram.

For new pages, use page-local CSS custom properties for the palette and common dimensions so each visual stays consistent while remaining a standalone HTML file. Treat the values above and the existing page as references, not as pixel-perfect constraints when a different structure needs more space.

## Interaction and explanation

- Show an initial state, meaningful intermediate states, and a final state. Advance by one meaningful code line or operation at a time. Show a visible step count and previous/next controls; revisiting a step restores its exact state.
- Use brief, purposeful JavaScript motion to show what changed between steps: keep nodes stationary and interpolate a variable's reference arrow itself from its old target to its new target. The step text may show the new logical state while the arrow visibly travels there. Update stored links only when the code changes `.next`; briefly emphasize the edited field or its new solid link. Never draw a cue from the old target node to the new target node that could imply a link between them. Route a switch from `None` to another head outside the chains so it never looks like a stored `.next` link. Keep transitions short, settle or cancel them on rapid input, resize, drag, or reset, and honor `prefers-reduced-motion` with an instant state change.
- Include a compact, visible explanation of the problem, the core idea, why it works, and the main solving steps below the diagram so the controls remain near the top on a phone. The current-step callout should connect the code line to the exact variable or stored link changing in the diagram. Explain important edge cases where they clarify the method.
- Distinguish references held by variables from links stored on nodes in both the drawing and explanation. State explicitly when only a variable changes and when a stored link changes.
- Where direct manipulation helps, allow dragging a source to a target. Also provide click-source-then-target operation for touch, keyboard, and embedded contexts. Show selected and available targets clearly, and explain a manual change without pretending it advanced the scripted trace.
- Use semantic buttons, visible focus, accessible names that describe the current target, and a polite live region for the step and explanation. Never make hover or drag the sole way to understand or operate the visual.
- Fit a narrow phone or Notion embed width without horizontal clipping. Keep controls and the whole diagram readable at a practical embed height.

## Files and publishing

- Put each question at `<problem-slug>/index.html` and add one descriptive link to the root `index.html`. Keep the page self-contained in HTML, CSS, and JavaScript unless a concrete need justifies another asset or build step.
- Treat everything committed here as public. GitHub Pages serves `main` from the repository root. If a task includes publishing, check the live URL after pushing. If it includes a Notion embed, add the published URL to the matching page without replacing the learner's notes, then confirm the embed loads and its controls work.
- Before completion, check JavaScript syntax, the initial/intermediate/final diagram states, keyboard and pointer paths, narrow layout, and any requested embed. Report which checks actually ran and any limitation. Do not add tests that merely repeat implementation details.
