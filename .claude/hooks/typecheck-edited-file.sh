#!/bin/bash
# TypeScript type checking hook for edited files

# Read the file path from hook input
file_path=$(jq -r '.tool_input.file_path // empty')

# Only process TypeScript files
if [[ "$file_path" =~ \.(ts|tsx)$ ]] && [[ -f "$file_path" ]]; then
    echo "🔍 Type checking $file_path..."

    # Change to project directory and run TypeScript with project config
    cd "$CLAUDE_PROJECT_DIR"

    # Run full project type check but filter for only the edited file
    tsc_output=$(npx tsc --project . --noEmit 2>&1)
    file_errors=$(echo "$tsc_output" | grep "$(basename "$file_path")" | head -10)

    if [[ -n "$file_errors" ]]; then
        echo "$file_errors" >&2
        exit 2
    else
        echo "✅ No type errors found in $file_path"
    fi
fi
