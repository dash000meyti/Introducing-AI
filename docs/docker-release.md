# Docker Release — رجیستری آروان

راهنمای بیلد و پوش ایمیج به `registry.hamdocker.ir/development`.

## اطلاعات رجیستری

| مورد | مقدار |
|---|---|
| آدرس رجیستری | `registry.hamdocker.ir/development` |
| نام کاربری | `development` |
| نام ایمیج | `introducing-ai` |
| تگ نسخه | از `package.json` خوانده می‌شود (مثلاً `v0.0.1`) |

آدرس کامل ایمیج:

```
registry.hamdocker.ir/development/introducing-ai:v0.0.1
```

---

## ۱. پیش‌نیاز

```bash
cd /Users/goodinmahdi/Desktop/git/Introducing-AI
```

مطمئن شو Docker در حال اجراست:

```bash
docker info
```

---

## ۲. تست قبل از ریلیز (اختیاری ولی توصیه‌شده)

```bash
npm run check
npm run build
```

---

## ۳. خواندن نسخه از package.json

```bash
VERSION=$(node -p "require('./package.json').version")
echo "v${VERSION}"
```

---

## ۴. بیلد ایمیج Docker

```bash
IMAGE="registry.hamdocker.ir/development/introducing-ai"

docker build -t "${IMAGE}:v${VERSION}" .
```

---

## ۵. تگ `latest`

```bash
docker tag "${IMAGE}:v${VERSION}" "${IMAGE}:latest"
```

---

## ۶. لاگین به رجیستری آروان

```bash
docker login registry.hamdocker.ir -u development
```

رمز عبور را وارد کن (در ترمینال پرسیده می‌شود).

یا با `--password-stdin`:

```bash
echo 'YOUR_PASSWORD' | docker login registry.hamdocker.ir -u development --password-stdin
```

---

## ۷. پوش به رجیستری

```bash
docker push "${IMAGE}:v${VERSION}"
docker push "${IMAGE}:latest"
```

---

## ۸. دیپلوی روی سرور

```bash
docker login registry.hamdocker.ir -u development

docker pull registry.hamdocker.ir/development/introducing-ai:v0.0.1

docker run -d \
  --name introducing-ai \
  -p 3000:3000 \
  --restart unless-stopped \
  registry.hamdocker.ir/development/introducing-ai:v0.0.1
```

اپ روی پورت **3000** در دسترس است.

---

## ۹. آپدیت نسخه بعدی

قبل از ریلیز جدید، نسخه را در `package.json` بالا ببر (مثلاً `0.0.2`)، سپس همان مراحل ۲ تا ۷ را تکرار کن.

---

## اسکریپت یک‌جا (کپی-پیست)

```bash
cd /Users/goodinmahdi/Desktop/git/Introducing-AI

npm run check
npm run build

VERSION=$(node -p "require('./package.json').version")
IMAGE="registry.hamdocker.ir/development/introducing-ai"

docker build -t "${IMAGE}:v${VERSION}" .
docker tag "${IMAGE}:v${VERSION}" "${IMAGE}:latest"

docker login registry.hamdocker.ir -u development

docker push "${IMAGE}:v${VERSION}"
docker push "${IMAGE}:latest"

echo "Pushed ${IMAGE}:v${VERSION} and ${IMAGE}:latest"
```

---

## آخرین ریلیز

| تگ | Digest |
|---|---|
| `v0.0.1` | `sha256:96b7110777e7ec2917cb9365f5b10280e7c183d718355b4b791d69fab43d4cdd` |
| `latest` | همان digest بالا |
