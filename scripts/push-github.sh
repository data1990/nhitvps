#!/usr/bin/env bash
set -Eeuo pipefail

REPO_URL="${REPO_URL:-${1:-}}"
BRANCH="${BRANCH:-main}"

die() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

[[ -n "$REPO_URL" ]] || die "Usage: REPO_URL=https://github.com/data1990/nhitvps.git ./scripts/push-github.sh"
command -v git >/dev/null 2>&1 || die "git is required"

if [[ ! -d .git ]]; then
  git init
fi

git branch -M "$BRANCH"

if git remote get-url origin >/dev/null 2>&1; then
  git remote set-url origin "$REPO_URL"
else
  git remote add origin "$REPO_URL"
fi

git add .

if git diff --cached --quiet; then
  printf 'No staged changes to commit.\n'
else
  git commit -m "Initial NhiTVPS source"
fi

git push -u origin "$BRANCH"
