# NOTICE

This project, **xpi-rtk**, is a [pi coding agent](https://github.com/earendil-works/pi) extension
that delegates to the external [`rtk`](https://github.com/rtk-ai/rtk) CLI (Rust Token Killer).

xpi-rtk does **not** bundle, copy, or modify rtk source code. It invokes the `rtk`
binary as a separate subprocess (`rtk rewrite` / `rtk gain` / `rtk --version`).

- rtk is licensed under the **Apache License 2.0** — see
  <https://github.com/rtk-ai/rtk> for the upstream project and its license.
- xpi-rtk itself is licensed under the **MIT License** — see `LICENSE`.
