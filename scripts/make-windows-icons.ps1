<#
  Draws the Windows app icons from the launch logo, transparent all the way.

  The taskbar, Start and Alt+Tab take a packaged app's icon from
  `Square44x44Logo.targetsize-N_altform-unplated.png`. With only a 24px one
  present, every other size fell back to the *plated* asset, which Windows
  draws on a tile — a white rounded square with an accent border around the
  mark. So each target size is drawn here in all three forms (plated name,
  `altform-unplated`, `altform-lightunplated`), and the exe's own
  `MoosiacRN.ico` (the title bar, and the taskbar for an unpackaged run) from
  the same source.

    powershell -ExecutionPolicy Bypass -File scripts/make-windows-icons.ps1
#>
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$source = Join-Path $root 'ios\music_app_rn\Images.xcassets\LaunchLogo.imageset\logo.png'
$images = Join-Path $root 'windows\MoosiacRN.Package\Images'
$ico = Join-Path $root 'windows\MoosiacRN\MoosiacRN.ico'

$logo = [System.Drawing.Bitmap]::FromFile($source)

# The mark's own bounds, so a 16px icon is the note and not its margin.
$minX = $logo.Width; $minY = $logo.Height; $maxX = 0; $maxY = 0
for ($y = 0; $y -lt $logo.Height; $y += 2) {
  for ($x = 0; $x -lt $logo.Width; $x += 2) {
    if ($logo.GetPixel($x, $y).A -gt 16) {
      if ($x -lt $minX) { $minX = $x }; if ($x -gt $maxX) { $maxX = $x }
      if ($y -lt $minY) { $minY = $y }; if ($y -gt $maxY) { $maxY = $y }
    }
  }
}
$side = [Math]::Max($maxX - $minX, $maxY - $minY)
$side = [int]($side * 1.06)  # a hair of breathing room
$cx = ($minX + $maxX) / 2; $cy = ($minY + $maxY) / 2
$crop = New-Object System.Drawing.RectangleF ([float]($cx - $side / 2)), ([float]($cy - $side / 2)), $side, $side

function Render([int]$size) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.Clear([System.Drawing.Color]::Transparent)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $dest = New-Object System.Drawing.RectangleF 0, 0, $size, $size
  $g.DrawImage($logo, $dest, $crop, [System.Drawing.GraphicsUnit]::Pixel)
  $g.Dispose()
  return $bmp
}

function Save([System.Drawing.Bitmap]$bmp, [string]$path) {
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
}

# Taskbar / Start / Alt+Tab, every size Windows asks for.
$targets = 16, 20, 24, 30, 32, 36, 40, 48, 60, 64, 72, 80, 96, 256
foreach ($n in $targets) {
  $bmp = Render $n
  foreach ($suffix in '', '_altform-unplated', '_altform-lightunplated') {
    Save $bmp (Join-Path $images "Square44x44Logo.targetsize-${n}${suffix}.png")
  }
  $bmp.Dispose()
}

# The plated asset at each scale, transparent too: where Windows does plate
# it, the tile is the theme's, not white baked into the file.
foreach ($scale in @(@(100, 44), @(125, 55), @(150, 66), @(200, 88), @(400, 176))) {
  $bmp = Render $scale[1]
  Save $bmp (Join-Path $images "Square44x44Logo.scale-$($scale[0]).png")
  $bmp.Dispose()
}

# MoosiacRN.ico: PNG-compressed frames, which every Windows since Vista reads.
$icoSizes = 16, 20, 24, 32, 40, 48, 64, 256
$frames = foreach ($n in $icoSizes) {
  $bmp = Render $n
  $ms = New-Object System.IO.MemoryStream
  $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  , @($n, $ms.ToArray())
}
$out = New-Object System.IO.MemoryStream
$w = New-Object System.IO.BinaryWriter $out
$w.Write([UInt16]0); $w.Write([UInt16]1); $w.Write([UInt16]$frames.Count)
$offset = 6 + 16 * $frames.Count
foreach ($f in $frames) {
  $n = $f[0]; $data = $f[1]
  $dim = if ($n -ge 256) { 0 } else { $n }
  $w.Write([byte]$dim); $w.Write([byte]$dim); $w.Write([byte]0); $w.Write([byte]0)
  $w.Write([UInt16]1); $w.Write([UInt16]32)
  $w.Write([UInt32]$data.Length); $w.Write([UInt32]$offset)
  $offset += $data.Length
}
foreach ($f in $frames) { $w.Write($f[1]) }
$w.Flush()
[System.IO.File]::WriteAllBytes($ico, $out.ToArray())

$logo.Dispose()
"Wrote $($targets.Count * 3) target-size icons, 5 scale icons and $ico"
