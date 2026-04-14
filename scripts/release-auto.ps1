param(
  [string]$Remote = "origin",
  [string]$CommitPrefix = "chore(auto): full save and deploy"
)

$ErrorActionPreference = "Stop"

function Run-Step {
  param(
    [string]$Name,
    [scriptblock]$Action
  )

  Write-Host ""
  Write-Host "==> $Name"
  & $Action

  if ($LASTEXITCODE -ne 0) {
    throw "Step failed: $Name"
  }
}

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $projectRoot

$branch = (& git rev-parse --abbrev-ref HEAD).Trim()
if (-not $branch -or $branch -eq "HEAD") {
  throw "Cannot run auto release on detached HEAD. Checkout a branch first."
}

Run-Step -Name "Staging all changes" -Action {
  git add -A
}

git diff --cached --quiet
if ($LASTEXITCODE -eq 1) {
  $stamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  $commitMessage = "$CommitPrefix - $stamp"

  Run-Step -Name "Creating commit" -Action {
    git commit -m $commitMessage
  }
} elseif ($LASTEXITCODE -ne 0) {
  throw "Unable to evaluate staged changes state."
} else {
  Write-Host ""
  Write-Host "==> No staged changes to commit. Continuing with current HEAD."
}

$shortCommit = (& git rev-parse --short HEAD).Trim()
if (-not $shortCommit) {
  throw "Could not resolve current commit hash."
}

Run-Step -Name "Running local production build" -Action {
  npm run build
}

Run-Step -Name "Deploying to VPS" -Action {
  npm run deploy:vps
}

$tagName = "restore-point-" + (Get-Date -Format "yyyy-MM-dd-HHmmss")

Run-Step -Name "Creating restore tag $tagName" -Action {
  git tag -a $tagName -m "Auto restore point after successful deploy ($shortCommit)"
}

Run-Step -Name "Pushing branch to remote" -Action {
  git push $Remote $branch
}

Run-Step -Name "Pushing restore tag to remote" -Action {
  git push $Remote $tagName
}

Write-Host ""
Write-Host "Auto release completed."
Write-Host "Branch: $branch"
Write-Host "Commit: $shortCommit"
Write-Host "Restore tag: $tagName"
