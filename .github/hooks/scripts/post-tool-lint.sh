#!/bin/bash
set -e

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.toolName')
RESULT_TYPE=$(echo "$INPUT" | jq -r '.toolResult.resultType')

if [ "$RESULT_TYPE" != "success" ]; then exit 0; fi
if [ "$TOOL_NAME" != "edit" ] && [ "$TOOL_NAME" != "create" ]; then exit 0; fi

FILE_PATH=$(echo "$INPUT" | jq -r '.toolArgs' | jq -r '.path // empty')
if [ -z "$FILE_PATH" ]; then exit 0; fi

# Only validate TypeScript / JavaScript / CSS files
case "$FILE_PATH" in
  *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs|*.css) ;;
  *) exit 0 ;;
esac

# Skip auto-generated icon files
case "$FILE_PATH" in
  *packages/filigran-icon/src/*) exit 0 ;;
esac

# Determine workspace from file path
WORKSPACE=""
case "$FILE_PATH" in
  *packages/filigran-ui/*) WORKSPACE="packages/filigran-ui" ;;
  *packages/filigran-chatbot/*) WORKSPACE="packages/filigran-chatbot" ;;
  *packages/filigran-icon/*) WORKSPACE="packages/filigran-icon" ;;
  *projects/filigran-website/*) WORKSPACE="projects/filigran-website" ;;
  *projects/filigran-chat-playground/*) WORKSPACE="projects/filigran-chat-playground" ;;
esac

# 1. Prettier check on the changed file
npx prettier --check "$FILE_PATH" 2>&1 || true

# 2. ESLint on the changed file (only workspaces that have it)
case "$FILE_PATH" in
  *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs)
    case "$WORKSPACE" in
      packages/filigran-chatbot|projects/filigran-website)
        npx eslint --no-warn-ignored --quiet "$FILE_PATH" 2>&1 || true
        ;;
    esac
    ;;
esac

# 3. Type-check the affected workspace
if [ -n "$WORKSPACE" ] && [ -f "$WORKSPACE/tsconfig.json" ]; then
  (cd "$WORKSPACE" && npx tsc --noEmit 2>&1) || true
fi
