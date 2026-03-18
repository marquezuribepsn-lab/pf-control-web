#!/usr/bin/env pwsh
# Script para limpiar rutas de tipos generados en tsconfig.json
$tsconfig = "tsconfig.json"
$content = Get-Content $tsconfig -Raw
$content = $content -replace '\.next/types/\*\*/\*.ts,?', ''
$content = $content -replace '\.next/dev/types/\*\*/\*.ts,?', ''
$content = $content -replace '\.next/types/\*\*/\*.ts"', '"'
$content = $content -replace '\.next/dev/types/\*\*/\*.ts"', '"'
Set-Content $tsconfig $content
Write-Host "Rutas de tipos generados eliminadas de tsconfig.json."
