#!/usr/bin/env bash
# Rebases every patch branch onto an upstream tag and merges the ones that apply into o3/build.
# Usage: apply-patches.sh <patches.json> <upstream-tag> <report.json>
# Run inside a clone whose `origin` is the fork and that already has the tag fetched.
# A patch that conflicts is left untouched on the fork and reported; its dependents are skipped.
set -uo pipefail

manifest=$1
tag=$2
report=$3
git config rerere.enabled true

declare -A status head old_head
entries=()

record() { # name status head files
  entries+=("$(jq -cn --arg name "$1" --arg status "$2" --arg head "$3" --arg files "$4" \
    '{name: $name, status: $status, head: $head, files: ($files | split("\n") | map(select(. != "")))}')")
}

for name in $(jq -r '.patches[].name' "$manifest"); do
  old_head[$name]=$(git rev-parse --verify -q "origin/patches/$name") || true
done

for name in $(jq -r '.patches[].name' "$manifest"); do
  base=$(jq -r --arg n "$name" '.patches[] | select(.name == $n) | .base // empty' "$manifest")
  old=${old_head[$name]:-}
  if [[ -z $old ]]; then
    status[$name]=missing
    record "$name" missing "" ""
    continue
  fi

  if [[ -n $base ]]; then
    if [[ ${status[$base]:-} != ok ]]; then
      status[$name]=skipped
      record "$name" skipped "$old" "base patch $base did not apply"
      continue
    fi
    onto=${head[$base]}
    previous=${old_head[$base]}
    git merge-base --is-ancestor "$previous" "$old" || previous=$(git merge-base "$old" "$onto")
  else
    onto=$tag
    previous=$(git merge-base "$old" "$tag")
  fi

  git checkout -q -B "patches/$name" "$old"
  if git merge-base --is-ancestor "$onto" "$old"; then
    : # Already based on the target.
  elif ! git -c core.hooksPath=/dev/null rebase -q --onto "$onto" "$previous" >/dev/null 2>&1; then
    files=$(git diff --name-only --diff-filter=U)
    # rerere may have resolved every file already.
    while [[ -z $files ]] && git rev-parse -q --verify REBASE_HEAD >/dev/null; do
      git add -A
      GIT_EDITOR=true git -c core.hooksPath=/dev/null rebase --continue >/dev/null 2>&1 && break
      files=$(git diff --name-only --diff-filter=U)
    done
    if [[ -n $files ]]; then
      git rebase --abort
      git checkout -q -B "patches/$name" "$old"
      status[$name]=conflict
      record "$name" conflict "$old" "$files"
      continue
    fi
  fi
  head[$name]=$(git rev-parse HEAD)
  status[$name]=ok
done

git checkout -q -B o3/build "$tag"
for name in $(jq -r '.patches[].name' "$manifest"); do
  [[ ${status[$name]} == ok ]] || continue
  if git -c core.hooksPath=/dev/null merge -q --no-edit -m "merge patches/$name" "patches/$name" >/dev/null 2>&1; then
    record "$name" ok "${head[$name]}" ""
  else
    files=$(git diff --name-only --diff-filter=U)
    if [[ -z $files ]]; then
      git -c core.hooksPath=/dev/null commit -q --no-edit && { record "$name" ok "${head[$name]}" ""; continue; }
    fi
    git merge --abort
    status[$name]=merge-conflict
    record "$name" merge-conflict "${head[$name]}" "$files"
  fi
done

printf '%s\n' "${entries[@]}" | jq -s --arg tag "$tag" --arg build "$(git rev-parse HEAD)" \
  '{tag: $tag, build: $build, patches: .}' >"$report"
cat "$report"
