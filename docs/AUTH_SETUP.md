# Настройка регистрации: почта, Google, GitHub

Код сайта уже всё умеет. Осталось включить нужное в Supabase, Google и GitHub — это делается мышкой в браузере, примерно за 30–40 минут.
Адрес проекта Supabase: `https://lojlwcsqbbthmpetmbmq.supabase.co`, сайт: `https://solofse.github.io/nit/`.

Делайте по порядку. Пока шаг не сделан, соответствующая кнопка на сайте просто покажет понятную ошибку — ничего не сломается.

---

## 1. SQL (обязательно, 1 минута)

Supabase → **SQL Editor** → вставить весь файл `supabase/auth.sql` → **Run**.
Без него вход через Google/GitHub будет падать с ошибкой «Database error saving new user».

## 2. Адреса сайта (обязательно)

Supabase → **Authentication → URL Configuration**:
- **Site URL**: `https://solofse.github.io/nit/`
- **Redirect URLs** → Add URL, по одному:
  - `https://solofse.github.io/nit/**`
  - `http://localhost:5173/**` (для проверки на компьютере)

Без этого ссылки из писем и возврат из Google/GitHub будут вести не туда.

## 3. Почта для писем (обязательно — без этого письма не дойдут)

Встроенная почта Supabase отправляет письма **только адресам участников вашей команды Supabase** и не больше пары штук в час. Для настоящих пользователей нужен свой почтовый ящик-отправитель (SMTP).

Самый простой бесплатный вариант без своего домена — **Gmail** (до ~500 писем в день):
1. Заведите отдельный Gmail, например `nit.messenger@gmail.com`.
2. В этом аккаунте включите **двухэтапную проверку**: myaccount.google.com → Безопасность.
3. Там же откройте **Пароли приложений** (myaccount.google.com/apppasswords), создайте пароль с названием «Supabase» — получите 16 букв. Сохраните их.
4. Supabase → **Authentication → Emails → SMTP Settings** → включить **Enable custom SMTP**:
   - Sender email: `nit.messenger@gmail.com`
   - Sender name: `Нить`
   - Host: `smtp.gmail.com`
   - Port: `465`
   - Username: `nit.messenger@gmail.com`
   - Password: те 16 букв пароля приложения
   - Minimum interval between emails: `30` секунд
5. Save.

Альтернатива — **Brevo** (brevo.com, 300 писем в день бесплатно): Senders → добавить свою почту → SMTP & API → взять логин/ключ, Host `smtp-relay.brevo.com`, Port `587`.

После этого: **Authentication → Rate Limits** → «Rate limit for sending emails» поставить 30–60 в час.

## 4. Подтверждение почты и пароли

Supabase → **Authentication → Sign In / Providers → Email**:
- **Enable Email provider** — включено
- **Confirm email** — **включить** (раньше просили выключить — теперь наоборот)
- **Secure email change** — **выключить**. Иначе старые аккаунты «по нику» не смогут привязать почту: письмо пришло бы и на служебный несуществующий адрес.
- **Secure password change** — можно включить: тогда для смены пароля придёт код на почту (сайт это умеет).
- **Minimum password length**: `8`
- **Password requirements**: «Lowercase, uppercase letters and digits» или «Letters and digits»
- **Email OTP Expiration**: `3600`, **Email OTP Length**: `6`

## 5. Красивые письма на русском

Supabase → **Authentication → Emails → Templates**. Для каждого шаблона: тема (Subject) и содержимое — весь текст файла из папки `supabase/emails/` (вкладка Source / HTML):

| Шаблон в Supabase | Тема письма | Файл |
|---|---|---|
| Confirm signup | Подтвердите почту в Нити | `confirm_signup.html` |
| Invite user | Приглашение в Нить | `invite.html` |
| Magic Link | Вход в Нить — ваш код | `magic_link.html` |
| Change Email Address | Подтвердите новую почту | `change_email.html` |
| Reset Password | Сброс пароля в Нити | `reset_password.html` |
| Reauthentication | Код подтверждения Нити | `reauthentication.html` |

Важно: письмо «Magic Link» должно содержать `{{ .Token }}` — по нему работает «Вход по коду из письма».

## 6. Вход через Google

1. Откройте **console.cloud.google.com**, войдите своим Google-аккаунтом, создайте проект «Нить».
2. **APIs & Services → OAuth consent screen** (или «Google Auth Platform → Branding»):
   - User type: **External**
   - App name: `Нить`, support email — ваша почта, Authorized domains: `supabase.co` и `solofse.github.io`
   - Сохранить. Затем **Audience → Publish app** (иначе входить смогут только добавленные вами тестовые пользователи).
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Application type: **Web application**, Name: `Нить`
   - Authorized JavaScript origins: `https://solofse.github.io`
   - Authorized redirect URIs: `https://lojlwcsqbbthmpetmbmq.supabase.co/auth/v1/callback`
   - Create → скопируйте **Client ID** и **Client secret**.
4. Supabase → **Authentication → Sign In / Providers → Google** → Enable, вставьте Client ID и Client Secret → Save.

## 7. Вход через GitHub

1. github.com → аватарка → **Settings → Developer settings → OAuth Apps → New OAuth App**:
   - Application name: `Нить`
   - Homepage URL: `https://solofse.github.io/nit/`
   - Authorization callback URL: `https://lojlwcsqbbthmpetmbmq.supabase.co/auth/v1/callback`
2. Register → скопируйте **Client ID**, нажмите **Generate a new client secret** → скопируйте секрет.
3. Supabase → **Authentication → Sign In / Providers → GitHub** → Enable, вставьте оба → Save.

## 8. Привязка Google/GitHub к существующему аккаунту

Supabase → **Authentication → Sign In / Providers** → внизу **Allow manual linking** — включить.
Тогда в «Аккаунт и безопасность» кнопки «Привязать Google/GitHub» заработают.

## 9. По желанию: защита от ботов

Supabase → **Authentication → Attack Protection** → **Enable Captcha protection** (Cloudflare Turnstile). Для этого нужен ещё и код на сайте — попросите агента добавить Turnstile, когда будет ключ.

---

## Что получится

- **Регистрация**: почта + ник + пароль (минимум 8 символов, буквы и цифры, полоска надёжности), проверка «ник свободен», согласие с правилами → письмо «Подтвердите почту» → нажал кнопку → сразу вошёл. «Отправить ещё раз» — не чаще раза в минуту.
- **Вход**: по почте или по нику (старые аккаунты), «Забыли пароль?» → письмо со ссылкой → «Новый пароль», «Войти по коду из письма» (без пароля).
- **Google / GitHub**: одна кнопка. Профиль создаётся сам, имя и аватарка берутся оттуда, ник придумывается автоматически — при первом входе человек выбирает свой.
- **Аккаунт и безопасность** (Профиль → кнопка): привязать/сменить почту, задать/сменить пароль, привязать/отвязать Google и GitHub, выйти на всех устройствах.
- **Старые аккаунты «ник + пароль»** работают как раньше. Им стоит привязать почту — иначе забытый пароль не восстановить.

## Если что-то не так

- «Database error saving new user» → не запущен шаг 1.
- Письма не приходят → шаг 3 (и папка «Спам»).
- После Google/GitHub открывается не тот адрес → шаг 2.
- «provider is not enabled» → шаги 6–7.
- В приложении на iPhone (с главного экрана) вход через Google/GitHub может открыть Safari: войдите там, потом откройте приложение — либо входите по почте.
