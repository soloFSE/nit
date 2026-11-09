#!/bin/bash
# Автоустановка игрового сервера «Нити» на Oracle Cloud (Ubuntu). Вставляется в поле «Cloud-init script» при создании сервера —
# после первого запуска сервер сам поставит всё нужное. Через 3–5 минут адрес будет таким: https://<IP-через-дефисы>.sslip.io
# (например, для IP 130.61.5.9 → https://130-61-5-9.sslip.io, в игре — wss://130-61-5-9.sslip.io)
set -e
export DEBIAN_FRONTEND=noninteractive
exec > /var/log/nit-setup.log 2>&1

apt-get update -y
apt-get install -y curl git ca-certificates gnupg debian-keyring debian-archive-keyring apt-transport-https iptables-persistent

# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Caddy (сам получает бесплатный сертификат HTTPS)
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt-get update -y
apt-get install -y caddy

# Сам игровой сервер
rm -rf /opt/nit && git clone --depth 1 https://github.com/soloFSE/nit.git /opt/nit
cd /opt/nit/gameserver && npm install --omit=dev

cat > /etc/systemd/system/nit-games.service <<'UNIT'
[Unit]
Description=Nit game server
After=network.target
[Service]
WorkingDirectory=/opt/nit/gameserver
Environment=PORT=8080
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=2
[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload && systemctl enable --now nit-games

# Адрес вида 130-61-5-9.sslip.io (sslip.io сам отвечает адресом из имени — свой домен не нужен)
IP=$(curl -s https://api.ipify.org)
HOST=$(echo "$IP" | tr . -).sslip.io
cat > /etc/caddy/Caddyfile <<CADDY
$HOST {
  reverse_proxy 127.0.0.1:8080
}
CADDY
systemctl restart caddy

# Порты 80 и 443 в брандмауэре самой машины
iptables -I INPUT -p tcp --dport 80 -j ACCEPT
iptables -I INPUT -p tcp --dport 443 -j ACCEPT
netfilter-persistent save

echo "ГОТОВО: wss://$HOST" > /var/log/nit-url.txt
