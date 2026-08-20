# تطبيق الملاحظات (Notes App)

**اللغات:** [العربية](README.ar.md) · [English](README.md)

تطبيق كامل المكدس لإنشاء الملاحظات وحفظها والبحث فيها وتصديرها.

- **`client/`** — واجهة React + Vite + TypeScript
- **`server/`** — واجهة REST عبر Express + TypeScript مع تخزين ملفّي

في وضع التطوير يوجّه العميل طلبات `/api/*` إلى الخادم، فتعمل الواجهة والـ API معاً عبر عنوان واحد.

## المتطلبات

- Node.js `>= 20` (مُطوَّر على Node 22)
- npm `>= 10`

## البدء السريع

```bash
npm install        # تثبيت اعتماديات كل الـ workspaces
npm run dev        # تشغيل الـ API (:3001) والعميل (:5173) معاً
```

ثم افتح http://localhost:5173 وأنشئ ملاحظة.

لبناء الإنتاج (الخادم يخدم الواجهة المُجمَّعة أيضاً):

```bash
npm run build
npm start          # http://localhost:3001 (API + واجهة)
```

## الأوامر الشائعة

| الأمر | الوصف |
| --- | --- |
| `npm run dev` | تشغيل العميل والخادم معاً مع إعادة التحميل |
| `npm run dev:server` | تشغيل الـ API فقط على المنفذ `3001` |
| `npm run dev:client` | تشغيل Vite فقط على المنفذ `5173` |
| `npm test` | تشغيل اختبارات Vitest لكل الـ workspaces |
| `npm run typecheck` | فحص الأنواع في كل الـ workspaces |
| `npm run lint` | فحص المستودع بـ ESLint |
| `npm run build` | بناء الخادم والعميل للإنتاج |
| `npm start` | تشغيل الإنتاج على المنفذ `3001` |

## الميزات

- إنشاء / تعديل / حذف ملاحظات مع تأكيد قبل الحذف
- حفظ ذرّي على القرص في `server/data/notes.json`
- بحث محلي يراعي العربية (ألف/تشكيل/همزة، ياء/كاف فارسي، أرقام شرقية، مسافات زائدة)
- واجهة تتبع لغة المتصفح (عربية RTL أو إنجليزية LTR)
- تصدير الملاحظات الظاهرة كـ JSON أو Markdown
- حماية من فقدان التعديلات غير المحفوظة (Escape و beforeunload)
- صحة التخزين عبر `/api/health` (`ok` / `degraded` / `unavailable`)

## واجهة الـ API (ملخص)

| الطريقة | المسار | الوصف |
| --- | --- | --- |
| `GET` | `/api/health` | فحص الصحة وحالة التخزين |
| `GET` | `/api/notes` | قائمة الملاحظات (الأحدث أولاً) |
| `GET` | `/api/notes/export` | تنزيل الكل (`?format=json` أو `md`) |
| `GET` | `/api/notes/:id` | جلب ملاحظة واحدة |
| `POST` | `/api/notes` | إنشاء `{ title, body? }` |
| `PUT` | `/api/notes/:id` | تحديث جزئي `{ title?, body? }` |
| `DELETE` | `/api/notes/:id` | حذف ملاحظة |

- العنوان حتى 200 حرف، والنص حتى 8000 حرف
- طلب JSON غير صالح أو عنوان ناقص → `400`
- فشل الكتابة على القرص → `503` مع التراجع عن الحالة في الذاكرة
- تفاصيل كاملة: [`docs/API.ar.md`](docs/API.ar.md)

## متغيرات البيئة

| المتغير | الافتراضي | الوصف |
| --- | --- | --- |
| `PORT` | `3001` | منفذ الخادم |
| `HOST` | `0.0.0.0` | عنوان الاستماع |
| `NOTES_DATA_FILE` | `server/data/notes.json` | مسار ملف التخزين |
| `VITE_API_TARGET` | `http://127.0.0.1:3001` | هدف بروكسي التطوير في Vite |

## هيكل المشروع

```
.
├── client/                 # واجهة React + Vite
├── server/                 # API Express + TypeScript
├── docs/                   # توثيق معماري وواجهة الـ API
├── .cursor/environment.json
├── .cursor/install.sh      # تثبيت Cloud Agent
├── eslint.config.js
├── README.md               # English
├── README.ar.md            # العربية (هذا الملف)
└── package.json            # npm workspaces
```

## توثيق إضافي

- [المعمارية](docs/ARCHITECTURE.ar.md) · [Architecture (EN)](docs/ARCHITECTURE.md)
- [مرجع الـ API](docs/API.ar.md) · [API reference (EN)](docs/API.md)

## بيئة Cursor Cloud

- التثبيت: `bash .cursor/install.sh` (`npm ci` عند وجود `package-lock.json`)
- الطرفية تبدأ `npm run dev:server` و `npm run dev:client`
- المنافذ: العميل `5173`، الخادم `3001`

## الاختبار و CI

يعمل GitHub Actions على Node 20 و 22: تثبيت، typecheck، lint، اختبارات، ثم بناء.

```bash
npm test
npm run typecheck
npm run lint
npm run build
```
