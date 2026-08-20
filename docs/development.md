# التطوير · Development

## الإعداد المحلي

```bash
npm install
npm run dev
```

- الواجهة: http://localhost:5173
- الـ API مباشرة: http://127.0.0.1:3001
- وكيل Vite: أي طلب من الواجهة إلى `/api/*` يذهب إلى `VITE_API_TARGET` (الافتراضي `http://127.0.0.1:3001`). إذا كان الخادم متوقفاً يعيد الوكيل `502` `{ "error": "api unreachable" }`.

```bash
npm run dev:server   # API فقط
npm run dev:client   # Vite فقط
```

## متغيرات البيئة

| المتغير | أين | الافتراضي | المعنى |
| --- | --- | --- | --- |
| `PORT` | الخادم | `3001` | منفذ الاستماع (1–65535) |
| `HOST` | الخادم | `0.0.0.0` | عنوان الربط |
| `NOTES_DATA_FILE` | الخادم | `server/data/notes.json` | مسار ملف الملاحظات |
| `VITE_API_TARGET` | Vite | `http://127.0.0.1:3001` | هدف وكيل `/api` |

ملف البيانات تحت `data/` ومدرج في `.gitignore`. لا تضع أسراراً في المستودع؛ `.env` مُتجاهل.

## البناء والتشغيل الإنتاجي

```bash
npm run build
npm start
```

`server/src/index.ts` يقدّم `client/dist` إذا وُجد `index.html`. بدون بناء العميل تطبع العملية «Notes API listening» فقط.

معاينة Vite (منفذ `4173`) تستخدم نفس وكيل `/api`.

## الجودة

```bash
npm test           # Vitest في client و server
npm run typecheck  # tsc --noEmit لكل مساحة عمل
npm run lint       # ESLint 9 (flat config) على TypeScript/TSX
```

اختبارات الخادم تمرّر `NotesStore` بدون ملف، أو بمسار مؤقت عند فحص الحفظ. اختبارات العميل تثبت `navigator.language` على `en-US` في `client/src/test/setup.ts`؛ لاختبار العربية تُعاد كتابة الخاصية داخل الاختبار.

CI: `.github/workflows/ci.yml` على `push`/`pull_request` إلى `main`، مصفوفة Node `20.x` و`22.x`.

## بيئة Cursor Cloud

`.cursor/environment.json` يشغّل `.cursor/install.sh` (`npm ci` إن وُجد القفل)، ثم طرفي `dev:server` و`dev:client`، مع المنافذ 3001 و5173.

## حدود يجدر احترامها عند التعديل

- العنوان 200 حرف والنص 8000؛ غيّر الثوابت في الخادم والعميل معاً (`TITLE_MAX_LENGTH` / `BODY_MAX_LENGTH`).
- لا تكتب فوق ملف بيانات `loadFailed`.
- أبقِ صيغ التصدير في `client/src/exportNotes.ts` و`server/src/exportNotes.ts` متوافقة.
- مسارات `/api` المجهولة يجب أن تبقى JSON `404` حتى لا تُفسَّر أخطاء الـ API كصفحة HTML.
