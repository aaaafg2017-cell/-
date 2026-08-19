export type Locale = "en" | "ar";

function normalizeLanguageTag(tag: string): string {
  return tag.trim().toLowerCase().replace(/_/g, "-");
}

export function isArabicLanguage(tag: string): boolean {
  const language = normalizeLanguageTag(tag);
  return language === "ar" || language.startsWith("ar-");
}

export function preferredLanguage(
  nav: Pick<Navigator, "language" | "languages"> | undefined = globalThis.navigator,
): string {
  if (!nav) {
    return "";
  }
  if (nav.languages && nav.languages.length > 0) {
    return nav.languages[0] ?? "";
  }
  return nav.language || "";
}

export function detectLocale(language = preferredLanguage()): Locale {
  return isArabicLanguage(language) ? "ar" : "en";
}

/**
 * Normalize text for client-side search so Arabic alef/tashkeel variants and
 * Latin case differences still match the stored note.
 */
export function normalizeForSearch(text: string): string {
  return text
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "")
    .replace(/\u0640/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ؤ/g, "و")
    .replace(/[ئى]/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ");
}

export const copy = {
  en: {
    title: "Notes",
    subtitle: "A tiny full-stack starter — React & Vite talking to an Express API.",
    titlePlaceholder: "Note title",
    bodyPlaceholder: "Write something…",
    titleLabel: "Note title",
    bodyLabel: "Note body",
    add: "Add note",
    save: "Save note",
    cancel: "Cancel",
    edit: "Edit",
    editNote: (noteTitle: string) => `Edit ${noteTitle}`,
    delete: (noteTitle: string) => `Delete ${noteTitle}`,
    confirmDelete: (noteTitle: string) => `Delete “${noteTitle}”? This cannot be undone.`,
    titleRequired: "Please enter a title.",
    loading: "Loading…",
    empty: "No notes yet. Create your first one above.",
    searchLabel: "Search notes",
    searchPlaceholder: "Search notes…",
    noResults: "No notes match your search.",
    exportLabel: "Export notes",
    exportJson: "Export JSON",
    exportMarkdown: "Export Markdown",
    exportFailed: "Could not export your notes.",
    edited: "edited",
    retry: "Try again",
    networkError: "Could not reach the notes API. Is the server running?",
    persistError:
      "Could not load notes from disk. Saving is paused until this is fixed.",
    notFound: "That note no longer exists.",
    notFoundRecreate:
      "That note was deleted. Save again to keep it as a new note.",
    tooLarge: "That note is too large to save.",
    titleTooLong: "Titles can be at most 200 characters.",
    bodyTooLong: "Note bodies can be at most 8,000 characters.",
    invalidRequest: "That note could not be saved.",
    discardChanges: "You have unsaved changes. Discard them?",
  },
  ar: {
    title: "الملاحظات",
    subtitle: "تطبيق بسيط كامل المكدس — React و Vite مع واجهة Express.",
    titlePlaceholder: "عنوان الملاحظة",
    bodyPlaceholder: "اكتب شيئاً…",
    titleLabel: "عنوان الملاحظة",
    bodyLabel: "نص الملاحظة",
    add: "إضافة ملاحظة",
    save: "حفظ الملاحظة",
    cancel: "إلغاء",
    edit: "تعديل",
    editNote: (noteTitle: string) => `تعديل ${noteTitle}`,
    delete: (noteTitle: string) => `حذف ${noteTitle}`,
    confirmDelete: (noteTitle: string) => `حذف «${noteTitle}»؟ لا يمكن التراجع عن هذا.`,
    titleRequired: "يرجى إدخال عنوان.",
    loading: "جارٍ التحميل…",
    empty: "لا توجد ملاحظات بعد. أنشئ الأولى من الأعلى.",
    searchLabel: "بحث في الملاحظات",
    searchPlaceholder: "ابحث في الملاحظات…",
    noResults: "لا توجد ملاحظات مطابقة للبحث.",
    exportLabel: "تصدير الملاحظات",
    exportJson: "تصدير JSON",
    exportMarkdown: "تصدير Markdown",
    exportFailed: "تعذر تصدير الملاحظات.",
    edited: "معدّلة",
    retry: "إعادة المحاولة",
    networkError: "تعذر الوصول إلى واجهة الملاحظات. هل الخادم يعمل؟",
    persistError:
      "تعذر تحميل الملاحظات من القرص. تم إيقاف الحفظ حتى يتم إصلاح ذلك.",
    notFound: "لم تعد هذه الملاحظة موجودة.",
    notFoundRecreate:
      "تم حذف هذه الملاحظة. احفظ مرة أخرى لإبقائها كملاحظة جديدة.",
    tooLarge: "هذه الملاحظة أكبر من أن تُحفظ.",
    titleTooLong: "يجب ألا يتجاوز العنوان 200 حرف.",
    bodyTooLong: "يجب ألا يتجاوز نص الملاحظة 8000 حرف.",
    invalidRequest: "تعذر حفظ هذه الملاحظة.",
    discardChanges: "لديك تغييرات غير محفوظة. هل تريد تجاهلها؟",
  },
} as const;
