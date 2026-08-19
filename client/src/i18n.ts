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
    delete: (noteTitle: string) => `Delete ${noteTitle}`,
    confirmDelete: (noteTitle: string) => `Delete “${noteTitle}”? This cannot be undone.`,
    titleRequired: "Please enter a title.",
    loading: "Loading…",
    empty: "No notes yet. Create your first one above.",
    searchLabel: "Search notes",
    searchPlaceholder: "Search notes…",
    noResults: "No notes match your search.",
    edited: "edited",
    retry: "Try again",
    networkError: "Could not reach the notes API. Is the server running?",
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
    delete: (noteTitle: string) => `حذف ${noteTitle}`,
    confirmDelete: (noteTitle: string) => `حذف «${noteTitle}»؟ لا يمكن التراجع عن هذا.`,
    titleRequired: "يرجى إدخال عنوان.",
    loading: "جارٍ التحميل…",
    empty: "لا توجد ملاحظات بعد. أنشئ الأولى من الأعلى.",
    searchLabel: "بحث في الملاحظات",
    searchPlaceholder: "ابحث في الملاحظات…",
    noResults: "لا توجد ملاحظات مطابقة للبحث.",
    edited: "معدّلة",
    retry: "إعادة المحاولة",
    networkError: "تعذر الوصول إلى واجهة الملاحظات. هل الخادم يعمل؟",
    discardChanges: "لديك تغييرات غير محفوظة. هل تريد تجاهلها؟",
  },
} as const;
