#!/usr/bin/env pwsh
# Script para limpiar rutas de tipos generados en tsconfig.json y eliminar archivos rotos en .next/dev/types
$tsconfig = "tsconfig.json"
$content = Get-Content $tsconfig -Raw
$content = $content -replace '\.next/types/\*\*/\*.ts,?', ''
$content = $content -replace '\.next/dev/types/\*\*/\*.ts,?', ''
$content = $content -replace '\.next/types/\*\*/\*.ts"', '"'
$content = $content -replace '\.next/dev/types/\*\*/\*.ts"', '"'
Set-Content $tsconfig $content

# Eliminar archivos rotos en .next/dev/types
$brokenTypes = Get-ChildItem .next/dev/types -Filter *.ts -Recurse -ErrorAction SilentlyContinue
foreach ($file in $brokenTypes) {
    Remove-Item $file.FullName -Force
}
Write-Host "Rutas eliminadas de tsconfig.json y archivos rotos borrados en .next/dev/types."
