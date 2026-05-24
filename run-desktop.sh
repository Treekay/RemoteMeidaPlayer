#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"
dotnet run --project "./desktop/RemoteMediaPlayer.Desktop/RemoteMediaPlayer.Desktop.csproj"
