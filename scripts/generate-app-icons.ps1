param(
    [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

function Save-Png {
    param(
        [System.Drawing.Image]$Image,
        [string]$DestPath
    )

    $dir = Split-Path $DestPath -Parent
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }

    $Image.Save($DestPath, [System.Drawing.Imaging.ImageFormat]::Png)
}

function New-SquareIconPng {
    param(
        [string]$SrcPath,
        [string]$DestPath,
        [int]$Size = 1024,
        [string]$Background = "#3E3E3E",
        [double]$Scale = 0.88
    )

    $src = [System.Drawing.Image]::FromFile($SrcPath)
    $bmp = New-Object System.Drawing.Bitmap $Size, $Size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.Clear([System.Drawing.ColorTranslator]::FromHtml($Background))
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    $fitScale = [Math]::Min($Size / $src.Width, $Size / $src.Height) * $Scale
    $w = [int]($src.Width * $fitScale)
    $h = [int]($src.Height * $fitScale)
    $x = [int](($Size - $w) / 2)
    $y = [int](($Size - $h) / 2)
    $g.DrawImage($src, $x, $y, $w, $h)

    Save-Png -Image $bmp -DestPath $DestPath

    $g.Dispose()
    $bmp.Dispose()
    $src.Dispose()
}

$brandDir = Join-Path $RepoRoot "assets\brand"
$fullColorJpg = Join-Path $brandDir "full-logo.jpg"
$transparentPng = Join-Path $brandDir "full-logo-transparent.png"

if (-not (Test-Path $fullColorJpg)) {
    throw "Missing brand asset: $fullColorJpg"
}
if (-not (Test-Path $transparentPng)) {
    throw "Missing brand asset: $transparentPng"
}

$targets = @(
    (Join-Path $RepoRoot "public\app-logo.png"),
    (Join-Path $RepoRoot "web\public\sabbathcue-logo.png")
)

foreach ($target in $targets) {
    Copy-Item -Path $transparentPng -Destination $target -Force
}

$iconTargets = @(
    (Join-Path $RepoRoot "public\app-icon.png"),
    (Join-Path $RepoRoot "web\public\sabbathcue-icon.png"),
    (Join-Path $RepoRoot "web\app\icon.png"),
    (Join-Path $RepoRoot "assets\brand\app-icon-source.png")
)

foreach ($target in $iconTargets) {
    New-SquareIconPng -SrcPath $fullColorJpg -DestPath $target -Size 1024
}

Write-Host "Generated app icons from assets/brand/full-logo.jpg"
