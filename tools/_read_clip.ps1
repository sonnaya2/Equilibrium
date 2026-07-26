Add-Type -AssemblyName System.Windows.Forms
$outDir = Join-Path $env:TEMP "grok-clip"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$formats = [System.Windows.Forms.Clipboard]::GetDataObject()
if ($null -eq $formats) {
  Write-Output "NO_CLIPBOARD"
  exit 0
}
Write-Output ("FORMATS: " + ($formats.GetFormats() -join ", "))

$text = [System.Windows.Forms.Clipboard]::GetText()
if ($text -and $text.Length -gt 0) {
  $textPath = Join-Path $outDir "clip.txt"
  [System.IO.File]::WriteAllText($textPath, $text)
  Write-Output ("TEXT_LEN=" + $text.Length)
  Write-Output ("TEXT_PATH=" + $textPath)
  Write-Output "---TEXT_HEAD---"
  if ($text.Length -gt 4000) { Write-Output $text.Substring(0, 4000) } else { Write-Output $text }
} else {
  Write-Output "TEXT_EMPTY"
}

if ([System.Windows.Forms.Clipboard]::ContainsImage()) {
  $img = [System.Windows.Forms.Clipboard]::GetImage()
  $imgPath = Join-Path $outDir "clip.png"
  $img.Save($imgPath, [System.Drawing.Imaging.ImageFormat]::Png)
  Write-Output ("IMAGE=" + $imgPath + " " + $img.Width + "x" + $img.Height)
}
