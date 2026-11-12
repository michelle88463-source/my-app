# 컴퓨터에서 앱을 미리 보는 작은 서버 (미리보기 전용, 앱에는 쓰이지 않아요)
# 실행: PowerShell에서  .\preview-server.ps1   → 브라우저에서 http://localhost:8080/
param([int]$Port = 8080)
$root = $PSScriptRoot
$types = @{
  '.html' = 'text/html; charset=utf-8'; '.css' = 'text/css; charset=utf-8'
  '.js' = 'text/javascript; charset=utf-8'; '.webmanifest' = 'application/manifest+json'
  '.png' = 'image/png'; '.json' = 'application/json'; '.svg' = 'image/svg+xml'
}
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "미리보기 서버가 켜졌어요: http://localhost:$Port/  (끄려면 Ctrl+C)"
while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  $rel = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath.TrimStart('/'))
  if ($rel -eq '') { $rel = 'index.html' }
  $file = [IO.Path]::GetFullPath((Join-Path $root $rel))
  $res = $ctx.Response
  if ($file.StartsWith($root) -and (Test-Path $file -PathType Leaf) -and ($rel -notmatch '\.(ps1|md)$')) {
    $bytes = [IO.File]::ReadAllBytes($file)
    $ext = [IO.Path]::GetExtension($file)
    $res.ContentType = if ($types[$ext]) { $types[$ext] } else { 'application/octet-stream' }
    $res.Headers.Add('Cache-Control', 'no-cache')
    $res.OutputStream.Write($bytes, 0, $bytes.Length)
  } else {
    $res.StatusCode = 404
  }
  $res.Close()
}
