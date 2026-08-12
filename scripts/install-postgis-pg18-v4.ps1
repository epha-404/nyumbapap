$ErrorActionPreference = "Stop"
$logPath = "C:\Users\user\Desktop\denis_technologies\postgis-install.log"
$sourceDir = "C:\Users\user\Desktop\denis_technologies\postgis-bundle-pg18-3.6.2x64\postgis-bundle-pg18-3.6.2x64"
$targetDir = "C:\Program Files\PostgreSQL\18"
try {
  if (-not (Test-Path "$sourceDir\share\extension\postgis.control")) { throw "Verified source is missing postgis.control" }
  if (-not (Test-Path "$targetDir\bin\postgres.exe")) { throw "PostgreSQL 18 target is invalid" }
  & robocopy "$sourceDir\bin" "$targetDir\bin" /E /XC /XN /XO /R:0 /W:0 | Out-Null
  if ($LASTEXITCODE -gt 7) { throw "PostGIS bin copy failed with robocopy code $LASTEXITCODE" }
  & robocopy "$sourceDir\lib" "$targetDir\lib" /E /XC /XN /XO /R:0 /W:0 | Out-Null
  if ($LASTEXITCODE -gt 7) { throw "PostGIS lib copy failed with robocopy code $LASTEXITCODE" }
  & robocopy "$sourceDir\share" "$targetDir\share" /E /XC /XN /XO /R:0 /W:0 | Out-Null
  if ($LASTEXITCODE -gt 7) { throw "PostGIS share copy failed with robocopy code $LASTEXITCODE" }
  if (-not (Test-Path "$targetDir\share\extension\postgis.control")) { throw "postgis.control was not installed" }
  "PostGIS files installed successfully at $(Get-Date -Format o)" | Set-Content -LiteralPath $logPath
  exit 0
} catch { $_ | Out-String | Set-Content -LiteralPath $logPath; exit 1 }
