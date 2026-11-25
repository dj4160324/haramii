# Local-only static server. Uses Windows PowerShell/.NET; no Python or Node install.
# TCP loopback avoids HttpListener URL reservation/admin requirements.
$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot "dist"))
$listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback,0)
$listener.Start()
$port = $listener.LocalEndpoint.Port
$url = "http://127.0.0.1:$port/"
Write-Host "Haramii CP-SAT: $url"
Write-Host 'Keep this window open. Close it to stop the local server.'
Start-Process $url
try {
 while ($true) {
  $client = $listener.AcceptTcpClient()
  try {
   $client.ReceiveTimeout=3000; $client.SendTimeout=15000
   $stream=$client.GetStream()
   $reader=[IO.StreamReader]::new($stream,[Text.Encoding]::ASCII,$false,4096,$true)
   $request=$reader.ReadLine();$headers=0
   while (($line=$reader.ReadLine()) -and $headers -lt 100) {$headers++}
   $parts=$request -split ' '
   $method=$parts[0]
   $path=[Uri]::UnescapeDataString(($parts[1] -split '\?')[0])
   if($path -eq '/') {$path='/index.html'}
   $file=[IO.Path]::GetFullPath([IO.Path]::Combine($root,$path.TrimStart('/').Replace('/',[IO.Path]::DirectorySeparatorChar)))
   $valid=($path -in @('/index.html','/isolation-bootstrap.js','/isolation-sw.js','/qa/runtime-check.html','/qa/synthetic-gate.json') -or $path.StartsWith('/assets/')) -and !$path.Contains('..') -and !$path.Contains('\') -and $file.StartsWith($root+[IO.Path]::DirectorySeparatorChar) -and [IO.File]::Exists($file)
   $status='200 OK';$type='application/octet-stream';$body=[byte[]]@()
   if($method -ne 'GET' -and $method -ne 'HEAD') {$status='405 Method Not Allowed'}
   elseif(!$valid) {$status='404 Not Found'}
   else {
    $body=[IO.File]::ReadAllBytes($file)
    switch ([IO.Path]::GetExtension($file)) {
     '.html' {$type='text/html; charset=utf-8'}
     '.mjs' {$type='text/javascript; charset=utf-8'}
     '.js' {$type='text/javascript; charset=utf-8'}
     '.wasm' {$type='application/wasm'}
    }
   }
   $response="HTTP/1.1 $status`r`nContent-Type: $type`r`nContent-Length: $($body.Length)`r`nCross-Origin-Opener-Policy: same-origin`r`nCross-Origin-Embedder-Policy: require-corp`r`nCross-Origin-Resource-Policy: same-origin`r`nCache-Control: no-store`r`nX-Content-Type-Options: nosniff`r`nConnection: close`r`n`r`n"
   $bytes=[Text.Encoding]::ASCII.GetBytes($response);$stream.Write($bytes,0,$bytes.Length)
   if($method -ne 'HEAD' -and $body.Length) {$stream.Write($body,0,$body.Length)}
   $stream.Flush()
  } catch {Write-Warning $_.Exception.Message}
  finally {$client.Close()}
 }
} finally {$listener.Stop()}
