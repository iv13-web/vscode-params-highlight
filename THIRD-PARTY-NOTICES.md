# Third-Party Notices

This extension is distributed as a single bundled JavaScript file (`out/extension.js`) produced by esbuild. The bundle includes code from third-party open-source projects listed below. The original license texts are reproduced verbatim in the [notices/](notices/) directory of this repository and shipped inside the `.vsix` package.

---

## Bundled at runtime

### TypeScript

- **Project**: [microsoft/TypeScript](https://github.com/microsoft/TypeScript)
- **Used for**: parsing TypeScript / JavaScript source via `ts.createSourceFile` and AST traversal at runtime.
- **License**: Apache License 2.0
- **Copyright**: Copyright (c) Microsoft Corporation. All rights reserved.
- **License text**: [notices/typescript-LICENSE.txt](notices/typescript-LICENSE.txt)
- **Upstream third-party notices**: [notices/typescript-ThirdPartyNoticeText.txt](notices/typescript-ThirdPartyNoticeText.txt) — TypeScript itself incorporates code/data from DefinitelyTyped, Unicode, W3C DOM, WebGL, and others. Their notices are forwarded verbatim per Apache 2.0 §4(d).

The bundled extension preserves TypeScript's `/*! Copyright (c) Microsoft Corporation ... */` legal header inline (esbuild `legalComments: 'eof'`).

---

## Build-time tooling (not bundled)

### esbuild

- **Project**: [evanw/esbuild](https://github.com/evanw/esbuild)
- **Used for**: bundling and minifying the extension at build time. esbuild's own code is **not** included in the distributed `.vsix`.
- **License**: MIT License
- **Copyright**: Copyright (c) 2020 Evan Wallace
- **License text**: [notices/esbuild-LICENSE.md](notices/esbuild-LICENSE.md)

Acknowledged here as a courtesy; the MIT license does not require attribution for tools whose output, but not source, is redistributed.
