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
- The AppImages set the desktop updater to this fork, so an installed build updates from these
  releases.
- When a patch stops applying, the run opens an issue labelled `patch-conflict` and the release ships
  without that patch. Fix the branch, push it, then start the workflow with `force` set.

Add a patch: push `patches/<name>` based on a recent nightly tag, then add it to `patches.json`.

The APK is the `preview` variant (`com.t3tools.t3code.preview`), so it installs next to the Play
Store app. It is signed with this fork's own key (secrets `O3_ANDROID_KEYSTORE` and
`O3_ANDROID_KEYSTORE_PASSWORD`), and its over-the-air updates are off so the patched bundle stays.
An app such as Obtainium that watches this fork's releases keeps it updated on a phone.
