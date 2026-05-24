@echo off
setlocal
cd /d "%~dp0"
dotnet run --project ".\desktop\RemoteMediaPlayer.Desktop\RemoteMediaPlayer.Desktop.csproj"
