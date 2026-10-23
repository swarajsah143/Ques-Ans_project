#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
cd "$PROJECT_DIR"

OLLAMA_PID=""
OLLAMA_LOG="${TMPDIR:-/tmp}/stillwater-ollama.log"

cleanup() {
  if [[ -n "$OLLAMA_PID" ]] && kill -0 "$OLLAMA_PID" 2>/dev/null; then
    kill "$OLLAMA_PID" 2>/dev/null || true
  fi
}

trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

for command_name in node npm python3 ollama curl; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    printf 'Missing required command: %s\n' "$command_name" >&2
    exit 1
  fi
done

if [[ ! -x ".venv/bin/python" ]]; then
  printf 'Creating project Python environment...\n'
  python3 -m venv .venv
fi

if ! .venv/bin/python -c 'import ollama, google.genai' >/dev/null 2>&1; then
  printf 'Installing Python requirements...\n'
  .venv/bin/python -m pip install -r GenAI/requirements.txt
fi

if [[ ! -x "node_modules/.bin/vite" ]]; then
  printf 'Installing Node.js requirements...\n'
  npm install
fi

if ! curl --silent --fail --max-time 2 http://127.0.0.1:11434/api/tags >/dev/null; then
  printf 'Starting Ollama...\n'
  ollama serve >"$OLLAMA_LOG" 2>&1 &
  OLLAMA_PID=$!

  for _ in $(seq 1 30); do
    if curl --silent --fail --max-time 2 http://127.0.0.1:11434/api/tags >/dev/null; then
      break
    fi
    if ! kill -0 "$OLLAMA_PID" 2>/dev/null; then
      printf 'Ollama failed to start. Log: %s\n' "$OLLAMA_LOG" >&2
      exit 1
    fi
    sleep 1
  done

  if ! curl --silent --fail --max-time 2 http://127.0.0.1:11434/api/tags >/dev/null; then
    printf 'Ollama did not become ready. Log: %s\n' "$OLLAMA_LOG" >&2
    exit 1
  fi
fi

if ! ollama list | awk 'NR > 1 { print $1 }' | grep --quiet --line-regexp 'gemma3:1b'; then
  printf 'Downloading gemma3:1b model...\n'
  ollama pull gemma3:1b
fi

export PYTHON_EXECUTABLE="$PROJECT_DIR/.venv/bin/python"
printf '\nStarting Stillwater. Open http://127.0.0.1:5173\nPress Ctrl+C to stop.\n\n'
npm run dev
