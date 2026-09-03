# merge_voice.ps1 — noi mp3 theo thu tu roi long vao video bang ffmpeg
# Tranh loi BOM cua concat demuxer list-file: dung filter_complex nhieu -i.
param(
  [Parameter(Mandatory=$true)] [string]$ScenarioDir,
  [Parameter(Mandatory=$true)] [string]$Video,
  [Parameter(Mandatory=$true)] [string]$Out,
  [Parameter(Mandatory=$true)] [string[]]$Order   # thu tu: intro,step1,...,hoan
)
$mp3s = $Order | ForEach-Object { Join-Path $ScenarioDir ("kb_" + $_ + ".mp3") }
$n = $mp3s.Count
$filter = "concat=n=$n:v=0:a=1[outa]"
$tmp = Join-Path $ScenarioDir 'voice_full.mp3'

# 1) Noi cac mp3 thanh 1 track
$a = @()
$mp3s | ForEach-Object { $a += '-i'; $a += $_ }
$a += '-filter_complex'; $a += $filter
$a += '-map'; $a += '[outa]'
$a += $tmp; $a += '-y'
& ffmpeg @a
if (-not (Test-Path $tmp)) { Write-Error 'concat that bai'; exit 1 }

# 2) Long voice track vao video (video goc thuong KHONG co audio -> -map 0:v -map 1:a)
$b = @('-i', $Video, '-i', $tmp, '-map', '0:v', '-map', '1:a',
       '-c:v', 'copy', '-c:a', 'libvorbis', '-shortest', '-y', $Out)
& ffmpeg @b
Remove-Item $tmp -ErrorAction SilentlyContinue
Write-Host "Xong: $Out"
