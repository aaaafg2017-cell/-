# واجهة برمجة الملاحظات REST

[English](api.md) · [README](../README.ar.md) · [البنية](architecture.ar.md)

العنوان الأساسي:

- واجهة التطوير: `http://localhost:5173/api` (Vite يوجّه الطلبات إلى الخادم)
- الواجهة البرمجية مباشرة: `http://127.0.0.1:3001/api`
- الإنتاج (`npm start`): `http://localhost:3001/api`

كل استجابات `/api` تضع `Cache-Control: no-store` و
`X-Content-Type-Options: nosniff`. حجم جسم JSON محدود بـ **256 كيلوبايت**.

## كائن الملاحظة

```json
{
  "id": "2f1c3a7e-9b0d-4c55-8a12-0e4b6d91f8aa",
  "title": "قائمة التسوق",
  "body": "حليب، خبز",
  "createdAt": "2026-08-20T06:41:00.000Z",
  "updatedAt": "2026-08-20T06:45:00.000Z"
}
```

| الحقل | النوع | ملاحظات |
| --- | --- | --- |
| `id` | نص | UUID يولّده الخادم |
| `title` | نص | بعد القص؛ من 1 إلى 200 حرف |
| `body` | نص | بعد القص؛ من 0 إلى 8000 حرف |
| `createdAt` | نص | UTC بصيغة ISO-8601 |
| `updatedAt` | نص | UTC بصيغة ISO-8601؛ يساوي `createdAt` حتى أول تعديل فعلي |

القوائم مرتبة تنازلياً حسب `updatedAt`.

## الأخطاء

أجسام الأخطاء JSON: `{ "error": "<رسالة>" }`.

| الحالة | متى |
| --- | --- |
| `400` | JSON غير صالح، عنوان ناقص/فارغ، حقول أطول من الحد، جسم `PUT` فارغ، أو `format` إخراج غير معروف |
| `404` | معرف ملاحظة غير موجود، أو مسار `/api` غير معروف |
| `413` | جسم JSON أكبر من 256 كيلوبايت |
| `502` | وكيل Vite لم يصل إلى الواجهة البرمجية (`{ "error": "api unreachable" }`) |
| `503` | ملف البيانات غير قابل للقراءة، أو فيه سجلات غير صالحة، أو فشلت الكتابة |
| `500` | خطأ خادم غير متوقع |

## `GET /api/health`

فحص التشغيل وحالة الحفظ.

```json
{
  "status": "ok",
  "persist": "ok",
  "uptime": 12.4
}
```

| `persist` | المعنى |
| --- | --- |
| `ok` | حُمّل الملف بنجاح (أو الحفظ في الذاكرة فقط) |
| `degraded` | تُخطّيت بعض السجلات؛ قراءة الملاحظات الصالحة تعمل؛ الكتابة مرفوضة |
| `unavailable` | تعذر تحليل الملف؛ القائمة والجلب والكتابة تفشل بـ `503` |

`status` يطابق `persist` (`ok` عند الصحة، وإلا قيمة الحفظ).

## `GET /api/notes`

ترجع مصفوفة ملاحظات، الأحدث أولاً. المخزن الفارغ: `[]`.

`503` إذا كان ملف البيانات غير قابل للقراءة.

## `GET /api/notes/:id`

ترجع ملاحظة واحدة، أو `404` `{ "error": "note not found" }`.

## `POST /api/notes`

إنشاء ملاحظة.

الطلب:

```json
{ "title": "مرحبا", "body": "نص اختياري" }
```

- `title` مطلوب بعد القص.
- `body` اختياري. القيم غير النصية تصبح `""`.
- تُحذف المسافات من البداية والنهاية.

الاستجابة: `201` مع الملاحظة المنشأة.

## `PUT /api/notes/:id`

تحديث جزئي. تتغير فقط الحقول الموجودة في كائن JSON.

```json
{ "title": "عنوان جديد" }
```

```json
{ "body": "نص جديد" }
```

- حذف `title` و `body` معاً يرجع `400` (`title or body is required`).
- إرسال القيم المخزّنة نفسها يرجع الملاحظة دون تغيير `updatedAt`.
- معرف غير معروف: `404`.

## `DELETE /api/notes/:id`

تحذف الملاحظة. النجاح: `204` بجسم فارغ. معرف غير معروف: `404`.

## `GET /api/notes/export`

تنزّل **كل** الملاحظات (وليس فلتر بحث الواجهة).

| الاستعلام | القيم | الافتراضي |
| --- | --- | --- |
| `format` | `json`، `md`، `markdown` | `json` |

`format` غير معروف → `400` `{ "error": "format must be json or md" }`.

الترويسات:

- `Content-Disposition: attachment; filename="notes-YYYY-MM-DD.json"` (أو `.md`)
- `Content-Type: application/json; charset=utf-8` أو `text/markdown; charset=utf-8`

جسم JSON:

```json
{
  "exportedAt": "2026-08-20T06:50:00.000Z",
  "count": 1,
  "notes": [ { "id": "...", "title": "...", "body": "...", "createdAt": "...", "updatedAt": "..." } ]
}
```

Markdown يبدأ بـ `# Notes` ثم `Exported` / `Count` ثم قسم `##` لكل ملاحظة
(العنوان، النص، المعرف، الإنشاء، التحديث). يُهرَّب `#` و `\` في العناوين.

## أمثلة curl

```bash
# الصحة
curl -s http://127.0.0.1:3001/api/health

# إنشاء
curl -s -X POST http://127.0.0.1:3001/api/notes \
  -H 'Content-Type: application/json' \
  -d '{"title":"مرحبا","body":"أول ملاحظة"}'

# قائمة
curl -s http://127.0.0.1:3001/api/notes

# تحديث العنوان فقط
curl -s -X PUT http://127.0.0.1:3001/api/notes/<id> \
  -H 'Content-Type: application/json' \
  -d '{"title":"محدَّث"}'

# إخراج Markdown
curl -s 'http://127.0.0.1:3001/api/notes/export?format=md' -o notes.md

# حذف
curl -s -o /dev/null -w '%{http_code}\n' \
  -X DELETE http://127.0.0.1:3001/api/notes/<id>
```
