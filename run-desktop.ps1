$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root
dotnet run --project ".\desktop\RemoteMediaPlayer.Desktop\RemoteMediaPlayer.Desktop.csproj"
