#!/usr/bin/env bash
# Dubbelklickbar start för macOS. Gör filen körbar en gång:  chmod +x start_macos.command
cd -- "$(dirname -- "$0")" || exit 1
exec bash ./start_macos_linux.sh "$@"
