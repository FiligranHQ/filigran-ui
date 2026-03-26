$ErrorActionPreference = "Stop"

try {
    $input = [Console]::In.ReadToEnd() | ConvertFrom-Json
    $toolName = $input.toolName
    $resultType = $input.toolResult.resultType

    if ($resultType -ne "success") { exit 0 }
    if ($toolName -ne "edit" -and $toolName -ne "create") { exit 0 }

    $toolArgs = $input.toolArgs | ConvertFrom-Json
    $filePath = $toolArgs.path
    if (-not $filePath) { exit 0 }

    # Only validate TypeScript / JavaScript / CSS files
    if ($filePath -notmatch '\.(ts|tsx|js|jsx|mjs|cjs|css)$') { exit 0 }

    # Skip auto-generated icon files
    if ($filePath -match 'packages[\\/]filigran-icon[\\/]src[\\/]') { exit 0 }

    # Determine workspace from file path
    $workspace = $null
    if ($filePath -match 'packages[\\/]filigran-ui[\\/]') { $workspace = "packages/filigran-ui" }
    elseif ($filePath -match 'packages[\\/]filigran-chatbot[\\/]') { $workspace = "packages/filigran-chatbot" }
    elseif ($filePath -match 'packages[\\/]filigran-icon[\\/]') { $workspace = "packages/filigran-icon" }
    elseif ($filePath -match 'projects[\\/]filigran-website[\\/]') { $workspace = "projects/filigran-website" }
    elseif ($filePath -match 'projects[\\/]filigran-chat-playground[\\/]') { $workspace = "projects/filigran-chat-playground" }

    # 1. Prettier check on the changed file
    try { npx prettier --check $filePath 2>&1 } catch {}

    # 2. ESLint on the changed file (only workspaces that have it)
    if ($filePath -match '\.(ts|tsx|js|jsx|mjs|cjs)$') {
        if ($workspace -eq "packages/filigran-chatbot" -or $workspace -eq "projects/filigran-website") {
            try { npx eslint --no-warn-ignored --quiet $filePath 2>&1 } catch {}
        }
    }

    # 3. Type-check the affected workspace
    if ($workspace -and (Test-Path "$workspace/tsconfig.json")) {
        try {
            Push-Location $workspace
            npx tsc --noEmit 2>&1
            Pop-Location
        } catch { Pop-Location }
    }
} catch {
    exit 0
}
