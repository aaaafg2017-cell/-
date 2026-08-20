# مرجع الواجهة البرمجية

العنوان الأساسي:

- أثناء التطوير (Vite): `http://localhost:5173/api` — يُحوَّل إلى خادم Express
- الواجهة مباشرة / الإنتاج: `http://localhost:3001/api`

كل استجابات `/api` ترسل `Cache-Control: no-store` و`X-Content-Type-Options: nosniff`. حد جسم JSON هو **256 كيلوبايت**.

## كائن الملاحظة

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "التسوق",
  "body": "حليب وخبز",
  "createdAt": "2026-08-20T06:41:00.000Z",
  "updatedAt": "2026-08-20T06:45:00.000Z"
}
```

| الحقل | النوع | القواعد |
| --- | --- | --- |
| `id` | نص (UUID) | يولّده الخادم عند الإنشاء |
| `title` | نص | مطلوب، بعد القص، من 1 إلى 200 حرف |
| `body` | نص | اختياري، بعد القص، حتى 8000 حرف |
| `createdAt` | نص | UTC بصيغة ISO-8601 |
| `updatedAt` | نص | UTC بصيغة ISO-8601؛ يساوي `createdAt` حتى أول تعديل |

القوائم مرتبة تنازلياً حسب `updatedAt` (الأحدث أولاً).

## المسارات

### `GET /api/health`

فحص الحياة وحالة التخزين.

```json
{ "status": "ok", "persist": "ok", "uptime": 12.34 }
```

| `persist` | المعنى |
| --- | --- |
| `ok` | ملف البيانات سليم (أو التخزين في الذاكرة فقط) |
| `degraded` | تُخطّي بعض السجلات غير الصالحة؛ القراءة تعمل والحفظ يعيد `503` |
| `unavailable` | تعذر قراءة الملف أو تحليله؛ القائمة والحفظ يعيدان `503` |

قيمة `status` تطابق `persist`.

### `GET /api/notes`

يعيد مصفوفة الملاحظات. `503` إذا كانت الحالة `unavailable`.

### `GET /api/notes/:id`

ملاحظة واحدة، أو `404` `{ "error": "note not found" }`.

### `POST /api/notes`

إنشاء ملاحظة. الجسم: `{ "title": string, "body"?: string }`.

- `201` مع الملاحظة المنشأة
- `400` إذا كان العنوان فارغاً أو تجاوز أحد الحقول الحد
- `503` إذا رفض المتجر الكتابة

### `PUT /api/notes/:id`

تحديث جزئي. أرسل الحقول المراد تغييرها فقط: `{ "title"?: string, "body"?: string }`.

- الحقول المحذوفة تبقي قيمها الحالية
- الجسم الفارغ (`{}`) يعيد `400` بالرسالة `"title or body is required"`
- القيم غير المتغيرة تعيد الملاحظة كما هي دون تحديث `updatedAt`
- `404` إذا كان المعرّف غير موجود
- `503` إذا رُفضت الكتابة

### `DELETE /api/notes/:id`

يحذف الملاحظة. `204` بجسم فارغ، أو `404` إن لم توجد.

### `GET /api/notes/export`

ينزّل كل الملاحظات المخزّنة.

| الاستعلام | القيم | الافتراضي |
| --- | --- | --- |
| `format` | `json` أو `md` أو `markdown` | `json` |

صيغة غير صالحة تعيد `400` `{ "error": "format must be json or md" }`.

ترويسات الاستجابة:

- `Content-Disposition: attachment; filename="notes-YYYY-MM-DD.json"` (أو `.md`)
- `Content-Type: application/json; charset=utf-8` أو `text/markdown; charset=utf-8`

جسم JSON:

```json
{
  "exportedAt": "2026-08-20T06:41:00.000Z",
  "count": 1,
  "notes": [ { "id": "…", "title": "…", "body": "…", "createdAt": "…", "updatedAt": "…" } ]
}
```

يبدأ ملف Markdown بـ `# Notes` ثم عنوان `##` لكل ملاحظة مع بيانات `id` و`created` و`updated`.

أزرار التصدير في الواجهة تنزّل الملاحظات **الظاهرة / المطابقة للبحث** في المتصفح. هذا المسار يصدّر **المخزن بالكامل**.

## أخطاء الاستجابة

شكل الخطأ: `{ "error": "رسالة مقروءة" }`.

| الحالة | متى |
| --- | --- |
| `400` | فشل التحقق، JSON تالف (`invalid request body`)، أو صيغة تصدير خاطئة |
| `404` | معرّف غير موجود، أو مسار `/api` غير معروف (`not found`) |
| `413` | جسم الطلب أكبر من 256 كيلوبايت |
| `502` | وكيل Vite لم يصل إلى الواجهة (`api unreachable`) — أثناء التطوير فقط |
| `503` | خطأ تخزين (ملف غير قابل للقراءة أو يحتوي سجلات باطلة)؛ تُتراجع تغييرات الذاكرة |
| `500` | خطأ خادم غير متوقع |

## أمثلة

```bash
curl -s http://localhost:3001/api/health
curl -s http://localhost:3001/api/notes
curl -s -X POST http://localhost:3001/api/notes \
  -H 'Content-Type: application/json' \
  -d '{"title":"مرحبا","body":"العالم"}'
curl -s -X PUT http://localhost:3001/api/notes/<id> \
  -H 'Content-Type: application/json' \
  -d '{"body":"نص محدّث"}'
curl -s -o notes-export.json 'http://localhost:3001/api/notes/export?format=json'
curl -s -X DELETE http://localhost:3001/api/notes/<id> -o /dev/null -w '%{http_code}\n'
```
