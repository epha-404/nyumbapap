$ErrorActionPreference = "Stop"
$sourceDir = (Resolve-Path "C:\Users\user\Desktop\denis_technologies\postgis-bundle-pg18-3.6.2x64\postgis-bundle-pg18-3.6.2x64").Path
$targetDir = (Resolve-Path "C:\Program Files\PostgreSQL\18").Path
if ($sourceDir -notlike "C:\Users\user\Desktop\denis_technologies\postgis-bundle-pg18-3.6.2x64*") { throw "Unexpected PostGIS source" }
if ($targetDir -ne "C:\Program Files\PostgreSQL\18") { throw "Unexpected PostgreSQL target" }
Copy-Item -Path "$sourceDir\*" -Destination $targetDir -Recurse -Force
if (-not (Test-Path "$targetDir\share\extension\postgis.control")) { throw "postgis.control was not installed" }
if (-not (Test-Path "$targetDir\share\extension\postgis_topology.control")) { throw "postgis_topology.control was not installed" }
