# توثيق للمطورين والوكلاء

ملاحظات قصيرة للوكلاء والمساهمين الذين يعملون على هذا المستودع.

## ما هذا المشروع؟

تطبيق ملاحظات كامل المكدس (`client/` + `server/`) مع تخزين JSON على القرص،
واجهة ثنائية اللغة (إنجليزي/عربي)، بحث عربي مُطبَّع، وتصدير JSON/Markdown.

التوثيق للمستخدمين:

- [`README.md`](../README.md) — English
- [`README.ar.md`](../README.ar.md) — العربية

## أوامر التحقق المعتادة

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

للتطوير المحلي/السحابي: `npm run dev` أو `npm run dev:server` + `npm run dev:client`.

## أين تغيّر ماذا؟

| الحاجة | الملفات الأولى |
| --- | --- |
| مسارات API / أخطاء HTTP | `server/src/app.ts` |
| التخزين، التحقق، الصحة | `server/src/notesStore.ts` |
| تصدير الخادم | `server/src/exportNotes.ts` |
| واجهة CRUD / بحث / تصدير | `client/src/App.tsx` |
| طلبات العميل | `client/src/api.ts` |
| اللغة والبحث العربي | `client/src/i18n.ts` |
| تصدير المتصفح | `client/src/exportNotes.ts` |
| وكيل التطوير `/api` | `client/vite.config.ts` |

## قواعد سلوك مهمة

1. **مساران للتصدير**: الواجهة تصدّر نتائج البحث فقط؛ `/api/notes/export` يصدّر كل المخزن. لا تدمجهما دون قصد.
2. **لا تستبدل** ملف تخزين تالفاً تلقائياً؛ حالات `degraded` / `unavailable` ترفض الكتابة بـ `503`.
3. الكتابة ذرّية عبر ملف مؤقت ثم `rename`.
4. اللغة من المتصفح فقط (`ar` / غير ذلك → `en`)؛ لا تضف مبدّل لغة إلا بطلب صريح.
5. عند تغيير شكل الـ API أو سلوك التخزين، حدّث `README.md` و `README.ar.md` معاً.

## بيئة Cursor Cloud

- التثبيت: `.cursor/install.sh` → `npm ci`
- المنافذ: عميل `5173`، خادم `3001` (انظر `.cursor/environment.json`)
