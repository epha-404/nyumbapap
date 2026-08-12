$ErrorActionPreference = "Stop"
$logPath = "C:\Users\user\Desktop\denis_technologies\postgis-install.log"
try {
  $sourceDir = "C:\Users\user\Desktop\denis_technologies\postgis-bundle-pg18-3.6.2x64\postgis-bundle-pg18-3.6.2x64"
  $targetDir = "C:\Program Files\PostgreSQL\18"
  if (-not (Test-Path "$sourceDir\share\extension\postgis.control")) { throw "Verified source is missing postgis.control" }
  if (-not (Test-Path "$targetDir\bin\postgres.exe")) { throw "PostgreSQL 18 target is invalid" }
  Copy-Item -LiteralPath "$sourceDir\bin" -Destination $targetDir -Recurse -Force
  Copy-Item -LiteralPath "$sourceDir\lib" -Destination $targetDir -Recurse -Force
  Copy-Item -LiteralPath "$sourceDir\share" -Destination $targetDir -Recurse -Force
  "PostGIS files installed successfully at $(Get-Date -Format o)" | Set-Content -LiteralPath $logPath
  exit 0
} catch {
  $_ | Out-String | Set-Content -LiteralPath $logPath
  exit 1
}
