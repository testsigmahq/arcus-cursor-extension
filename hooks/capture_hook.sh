#!/usr/bin/env bash
set -uo pipefail

CONFIG_FILE="${HOME}/.arcus/config"
if [[ -f "$CONFIG_FILE" ]]; then
  # shellcheck source=/dev/null
  source "$CONFIG_FILE"
fi

# Fallback for a legacy config missing this key — must not be a local address.
SERVER_URL="${ARCUS_SERVER_URL:-https://agentic-test.testsigma.com}"
API_KEY="${ARCUS_ACCESS_TOKEN:-}"
ACCOUNT_ID="${ARCUS_ACCOUNT_ID:-}"
ENDPOINT="${SERVER_URL}/api/v1/plugin/events"

# No credentials → do not attempt to send anything. This is what makes a
# signed-out (or uninstalled) machine go silent: signout deletes ~/.arcus/config,
# so API_KEY is empty here and we exit before reading or posting the event.
if [[ -z "$API_KEY" ]]; then
  exit 0
fi

payload=$(cat)

hook_name=$(echo "$payload" | jq -r '.hook_event_name // "Unknown"')
session_id=$(echo "$payload" | jq -r '.conversation_id // .session_id // "unknown-session"')
cwd=$(echo "$payload" | jq -r '.workspace_roots[0] // .cwd // ""')

# Record the session we are about to post so `arcus map` can resolve it.
if [[ "$session_id" != "unknown-session" ]]; then
  mkdir -p "${HOME}/.arcus"
  jq -cn --arg session_id "$session_id" --arg cwd "$cwd" --argjson ts "$(date +%s)" \
    '{session_id: $session_id, cwd: $cwd, ts: $ts}' \
    > "${HOME}/.arcus/last_session.json"
  chmod 600 "${HOME}/.arcus/last_session.json" 2>/dev/null || true
fi

# Git metadata
git_branch="null"
git_repo="null"
git_user_email="null"
git_user_alias="null"
if [[ -n "$cwd" && -d "$cwd" ]]; then
  _branch=$(git -C "$cwd" rev-parse --abbrev-ref HEAD 2>/dev/null || true)
  [[ -n "$_branch" ]] && git_branch="\"$_branch\""

  _url=$(gh repo view --json url -q .url 2>/dev/null || git -C "$cwd" remote get-url origin 2>/dev/null || true)
  if [[ -n "$_url" ]]; then
    _url=$(echo "$_url" | sed 's|^git@\([^:]*\):\(.*\)$|https://\1/\2|')
    [[ "$_url" != *".git" ]] && _url="${_url}.git"
    git_repo="\"$_url\""
  fi

  _email=$(git -C "$cwd" config user.email 2>/dev/null || true)
  [[ -n "$_email" ]] && git_user_email="\"$_email\""

  _name=$(git -C "$cwd" config user.name 2>/dev/null || true)
  [[ -n "$_name" ]] && git_user_alias="\"$_name\""
fi

# GitHub username via gh CLI (only reliable source)
git_github_user="null"
_gh_user=$(gh api user --jq .login 2>/dev/null || gh config get -h github.com user 2>/dev/null || true)
[[ -n "$_gh_user" ]] && git_github_user="\"$_gh_user\""

body=$(echo "$payload" | jq \
  --arg session_id "$session_id" \
  --arg hook_name "$hook_name" \
  --arg cwd "$cwd" \
  --arg account_id "$ACCOUNT_ID" \
  --argjson git_branch "$git_branch" \
  --argjson git_repo "$git_repo" \
  --argjson git_user_email "$git_user_email" \
  --argjson git_user_alias "$git_user_alias" \
  --argjson git_github_user "$git_github_user" \
  '{
    hook_event_name: $hook_name,
    session_id: $session_id,
    cwd: $cwd,
    payload: .,
    metadata: {
      account_id: $account_id,
      git_repo: $git_repo,
      git_branch: $git_branch,
      git_user: $git_user_email,
      session_manifest: {
        session_id: $session_id,
        cwd: $cwd,
        source: "cursor",
        last_hook: $hook_name,
        grouping_keys: {
          git_repo: $git_repo,
          git_branch: $git_branch,
          git_user: $git_user_email,
          git_name: $git_user_alias,
          git_github_user: $git_github_user
        }
      }
    }
  }')

curl -sf -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -H "x-agentic-token: ${API_KEY}" \
  -d "$body" \
  -o /dev/null \
  || true
