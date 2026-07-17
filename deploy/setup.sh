#!/usr/bin/env bash
# Разовая настройка KatoVape на VPS. Запускать на сервере от root после того,
# как код залит в /opt/katovape (см. DEPLOY.md). Идемпотентно.
set -euo pipefail

ROOT=/opt/katovape
NODE_VER=v22.20.0            # изолированный Node 22 (в системе Node 20 для mcr-bot — не трогаем)
NODE_DIR=$ROOT/node

echo "== каталоги =="
mkdir -p "$ROOT/data" "$ROOT/site" "$ROOT/server"

echo "== node 22 (изолированно) =="
if [ ! -x "$NODE_DIR/bin/node" ]; then
  TARBALL="node-$NODE_VER-linux-x64"
  curl -fsSL "https://nodejs.org/dist/$NODE_VER/$TARBALL.tar.xz" -o /tmp/node.tar.xz
  rm -rf "$NODE_DIR" && mkdir -p "$NODE_DIR"
  tar -xJf /tmp/node.tar.xz -C "$NODE_DIR" --strip-components=1
  rm -f /tmp/node.tar.xz
fi
"$NODE_DIR/bin/node" -v

echo "== .env =="
if [ ! -f "$ROOT/.env" ]; then
  cp "$ROOT/server/deploy/.env.example" "$ROOT/.env" 2>/dev/null || cp "$ROOT/.env.example" "$ROOT/.env"
  chmod 600 "$ROOT/.env"
  echo ">> Заполни $ROOT/.env (токен бота, PUBLIC_URL, MINIAPP_URL) и запусти снова."
fi

echo "== systemd =="
cp "$ROOT/server/deploy/katovape-api.service" /etc/systemd/system/ 2>/dev/null || cp "$ROOT/deploy/katovape-api.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable katovape-api
systemctl restart katovape-api
sleep 1
systemctl --no-pager --lines=8 status katovape-api || true

echo "== nginx =="
echo ">> Проверь /etc/nginx/sites-available/katovape (замени SUBDOMAIN), затем:"
echo "   ln -sf /etc/nginx/sites-available/katovape /etc/nginx/sites-enabled/katovape"
echo "   nginx -t && systemctl reload nginx && certbot --nginx -d SUBDOMAIN"
echo "== готово =="
