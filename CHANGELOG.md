# Changelog

## [0.3.0](https://github.com/jalbarrang/pi-workflows/compare/v0.2.1...v0.3.0) (2026-08-05)


### ⚠ BREAKING CHANGES

* **workflows:** Remove background, tools, allowCommands, and writeScope options.

### Features

* **workflows:** enforce foreground execution ([9272e6c](https://github.com/jalbarrang/pi-workflows/commit/9272e6cccce70f0b1765fe58916d0be191a79ffb))

## [0.2.1](https://github.com/jalbarrang/pi-workflows/compare/v0.2.0...v0.2.1) (2026-07-27)


### Bug Fixes

* keep workflow child agents leaf-only ([370e640](https://github.com/jalbarrang/pi-workflows/commit/370e640cb93f2c232cc9591820804cd4157d2759))

## [0.2.0](https://github.com/jalbarrang/pi-workflows/compare/v0.1.0...v0.2.0) (2026-07-26)


### Features

* **agent:** persist full agent output and refuse oversized prompts per-call ([5d9a0d3](https://github.com/jalbarrang/pi-workflows/commit/5d9a0d3e2cc5b8c8b732978b8aba05f03aa61784))
* allow in-fence git mv and report denied commands ([5b537eb](https://github.com/jalbarrang/pi-workflows/commit/5b537ebfa0349b94e68a29b45c3925b1592915c1))
* **artifacts:** prune old workflow run directories in two tiers ([ac6c688](https://github.com/jalbarrang/pi-workflows/commit/ac6c688faefaf4f31abd633936bbf2dc23369da7))
* best-effort agents that are not reported as holes ([749fd27](https://github.com/jalbarrang/pi-workflows/commit/749fd27030100bcb02ec102d91bc118d05bc1cee))
* fenced mkdir, subtree globs, and denials that explain themselves ([a8af3b8](https://github.com/jalbarrang/pi-workflows/commit/a8af3b8e5d0f86842bc54c2532a98ec1870928fd))
* keep recorded gate results and stop silent gate skips ([02c82c6](https://github.com/jalbarrang/pi-workflows/commit/02c82c6eae7ad46faec70526072e4f5b81d13de2))
* resume a run's result as the previous global ([6b874fb](https://github.com/jalbarrang/pi-workflows/commit/6b874fbe4d85ed07c5379b99faac297d40104ff2))
* workflow orchestration extension with scoped agents ([a491f03](https://github.com/jalbarrang/pi-workflows/commit/a491f037accee7061dc8daacb473d631a1302a05))

## 0.1.0

- Initial release.
