---
"linear-cli": patch
---

Add `@aliou/biome-plugins` and fix all inline import violations. Converts dynamic `await import()` calls inside functions to static imports and removes `.js` extensions from import paths.
