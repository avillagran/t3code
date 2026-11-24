# o3 patch queue

This branch holds no T3 Code source. It rebuilds each upstream nightly of
[pingdotgg/t3code](https://github.com/pingdotgg/t3code) with the local patches and publishes the
result as a release of this fork.

- `patches.json` lists the patch branches (`patches/<name>`) in merge order. A patch with `base` is
  stacked on that patch.
- `.github/workflows/o3-nightly.yml` checks for a new nightly every two hours. It rebases each patch,
  merges the ones that apply into `o3/build`, typechecks the result, builds x64 and arm64 AppImages and an Android APK,
  and publishes a prerelease. The version adds one digit to the upstream run number, so
  `v0.1.12-nightly.20261124.5178` becomes `v0.1.12-nightly.20261124.51781`. The updater then treats
  it as newer than the official build and orders rebuilds after it.
- The AppImages point the desktop updater at this fork. On the developer machines, the T3 Companion
  manages updates instead: it installs each new AppImage after checking its SHA-256 digest, keeps the
  previous one for rollback, restarts T3 when no thread is working, and shows the patch report in the
  Omarchy bar. It launches T3 with `T3CODE_DISABLE_AUTO_UPDATE=1`, so the two updaters never race.
- When a patch stops applying, the run opens an issue labelled `patch-conflict`, ships the release
  without that patch, and calls the webhook in secret `O3_CONFLICT_WEBHOOK`. That webhook starts a
  T3 Code scheduled task, which rebases the branch, pushes it, closes the issue, and starts the
  workflow again with `force`.
- CI never pushes code. `GITHUB_TOKEN` cannot push commits that touch upstream workflow files. The
  patched tree moves between jobs as a git bundle, and patch branches are refreshed from a
  developer machine.

Add a patch: push `patches/<name>` based on a recent nightly tag, then add it to `patches.json`.

The APK is the `preview` variant (`com.t3tools.t3code.preview`), so it installs next to the Play
Store app. It is signed with this fork's own key (secrets `O3_ANDROID_KEYSTORE` and
`O3_ANDROID_KEYSTORE_PASSWORD`), and its over-the-air updates are off so the patched bundle stays.
An app such as Obtainium that watches this fork's releases keeps it updated on a phone.
