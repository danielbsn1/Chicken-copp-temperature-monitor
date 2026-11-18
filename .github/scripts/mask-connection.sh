#!/usr/bin/env bash
# Mascara usuário, senha e host da conexão: o Prisma cita o host nas mensagens
# de erro, e o GitHub só mascara o valor completo do secret.
set -euo pipefail
rest="${CONNECTION_URL#*://}"
creds="${rest%%@*}"
hostport="${rest#*@}"
hostport="${hostport%%/*}"
for part in "${creds%%:*}" "${creds#*:}" "${hostport%%:*}"; do
  [ -n "$part" ] && echo "::add-mask::$part"
done
exit 0
