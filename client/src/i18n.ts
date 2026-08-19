export type Locale = "en" | "ar";

export function detectLocale(): Locale {
  if (typeof navigator === "undefined") {
    return "en";
  }
  const language = (navigator.language || "").toLowerCase();
  return language.startsWith("ar") ? "ar" : "en";
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
  },
} as const;
