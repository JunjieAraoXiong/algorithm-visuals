# Visual library guidance

This repository contains public, standalone algorithm visualizations.

- Put each visual in `<problem-slug>/index.html` and add it to the root `index.html`.
- Keep pages self-contained with HTML, CSS, and JavaScript. Avoid a build step unless a visual truly needs one.
- Make the algorithm state explicit. Distinguish variable references from links stored on nodes.
- Provide step controls and direct manipulation when it improves understanding. Keep buttons keyboard accessible.
- Match any style or interaction requested by the learner, and preserve existing visuals when adding new ones.
- Before publishing, check JavaScript syntax, the initial and final states, narrow-screen layout, and the published URL. Test a Notion embed when the visual is meant for Notion.
- Do not copy images from course material into the public site. Redraw concepts with original HTML/SVG.

GitHub Pages publishes `main` from the repository root. Treat everything committed here as publicly visible.
