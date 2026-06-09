# hooks/capture_hook.test.sh
set -uo pipefail
THIS_DIR="$(cd "$(dirname "$0")" && pwd)"
TMP_HOME="$(mktemp -d)"
export HOME="$TMP_HOME"
mkdir -p "$HOME/.arcus"
# Provide a token so the hook does not early-exit.
printf 'ARCUS_SERVER_URL=http://127.0.0.1:9\nARCUS_ACCESS_TOKEN=tok\nARCUS_ACCOUNT_ID=acct\n' > "$HOME/.arcus/config"

echo '{"hook_event_name":"PreToolUse","conversation_id":"sess-abc","workspace_roots":["/tmp"]}' \
  | bash "$THIS_DIR/capture_hook.sh"

MARKER="$HOME/.arcus/last_session.json"
if [[ ! -f "$MARKER" ]]; then echo "FAIL: marker not written"; rm -rf "$TMP_HOME"; exit 1; fi
GOT=$(jq -r '.session_id' "$MARKER")
if [[ "$GOT" != "sess-abc" ]]; then echo "FAIL: session_id=$GOT"; rm -rf "$TMP_HOME"; exit 1; fi
echo "PASS"
rm -rf "$TMP_HOME"
