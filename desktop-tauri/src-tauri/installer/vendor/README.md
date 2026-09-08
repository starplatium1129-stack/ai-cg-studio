# Tauri NSIS template provenance

`tauri-2.11.4.nsi` is the unmodified upstream template from the installed CLI version:

https://github.com/tauri-apps/tauri/blob/tauri-cli-v2.11.4/crates/tauri-bundler/src/bundle/windows/nsis/installer.nsi

SHA-256: `20f4ecc730defb71f1342eaeaec4021df13be3d843abba0effe88ea5835fa079`.

Tauri is dual licensed under MIT or Apache-2.0; this vendored copy is used under the MIT license in LICENSE.txt. Presentation patches are applied by scripts/maintenance/build-game-installer.js, with anchor and hash checks. On a Tauri upgrade, deliberately review a new upstream template and update the pin; do not silently regenerate from a different version.
