# Игровой сервер на Oracle Cloud (бесплатный «вечный» сервер)

Oracle даёт бесплатный настоящий сервер (VPS), который никогда не засыпает. Минусы: при регистрации нужна банковская карта
(с неё снимут и сразу вернут 1 доллар для проверки; из России такие карты часто не принимаются), а пинг определяется
расстоянием до сервера — как и у любого другого варианта. Перед переездом сравните скорость в игре (кнопка «Проверить скорость серверов»).

## Шаги (около 20 минут)
1. Зайдите на https://www.oracle.com/cloud/free/ → **Start for free**, зарегистрируйтесь (через VPN).
   Регион при регистрации выбирайте **ближе к вашему VPN**: Frankfurt (Германия) или Amsterdam. Поменять его потом нельзя.
2. В консоли: **Compute → Instances → Create instance**.
   - Image: **Ubuntu 22.04**; Shape: **VM.Standard.E2.1.Micro** (или Ampere A1 — тоже бесплатный).
   - Networking: оставьте «Assign a public IPv4 address».
   - SSH keys: «Generate a key pair» (скачайте ключи на всякий случай).
   - Нажмите **Show advanced options → Management** и в поле **Cloud-init script** вставьте всё содержимое файла `cloud-init.sh` из этой папки.
3. Нажмите **Create**. Подождите, пока статус станет **Running**, и скопируйте **Public IP address** (например, `130.61.5.9`).
4. Откройте порты: **Networking → Virtual Cloud Networks → ваша сеть → Security Lists → Default Security List → Add Ingress Rules**:
   дважды (порты **80** и **443**): Source CIDR `0.0.0.0/0`, IP Protocol `TCP`, Destination Port `80` / `443`.
5. Подождите 5 минут и откройте в браузере `https://130-61-5-9.sslip.io` (ваш IP через дефисы). Должно появиться «nit game server ok».
6. Пришлите мне этот адрес — я впишу его в игру: `wss://130-61-5-9.sslip.io`.

Если не открывается: Compute → Instances → ваш сервер → **Console connection**, либо посмотрите журнал установки `/var/log/nit-setup.log`.
