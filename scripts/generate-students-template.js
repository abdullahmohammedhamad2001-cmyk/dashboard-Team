const path = require("path");
const ExcelJS = require("exceljs");

const outputPath = path.resolve(
  __dirname,
  "../../../../app/ملف الاكسل/students_template.xlsx"
);

const columns = [
  { title: "اسم الطالب الكامل", key: "name", width: 28, required: true },
  { title: "الجنس", key: "sex", width: 14, required: true },
  { title: "يوم الميلاد", key: "birth_day", width: 14, required: true },
  { title: "شهر الميلاد", key: "birth_month", width: 14, required: true },
  { title: "سنة الميلاد", key: "birth_year", width: 14, required: true },
  { title: "اسم ولي الأمر", key: "parent_name", width: 28, required: true },
  { title: "رقم هاتف ولي الأمر", key: "phone_number", width: 23, required: true },
  { title: "المرحلة الدراسية", key: "education_level", width: 20, required: true },
  { title: "الصف الدراسي", key: "class_grade", width: 21, required: true },
  { title: "التخصص", key: "specialization", width: 18, required: false },
  { title: "الشعبة", key: "class_section", width: 14, required: true },
  { title: "السنة الدراسية", key: "academic_year", width: 18, required: true },
];

const instructions = [
  ["اسم الطالب الكامل", "مطلوب - الاسم الثلاثي أو الرباعي كاملاً."],
  ["الجنس", "مطلوب - اختر ذكر أو أنثى من القائمة."],
  ["تاريخ الميلاد", "مطلوب - اكتب اليوم والشهر والسنة كل واحد في عموده."],
  ["اسم ولي الأمر", "مطلوب - الاسم الكامل لولي أمر الطالب."],
  ["رقم هاتف ولي الأمر", "مطلوب - العراق: 10 أرقام تبدأ بـ7 من دون 0 أو +964. تونس: 8 أرقام تبدأ بـ2 أو 5 أو 9."],
  ["المرحلة الدراسية", "مطلوب - ابتدائي أو متوسط أو إعدادي."],
  ["الصف الدراسي", "مطلوب - يجب أن يطابق الصف الموجود في لوحة المدرسة، مثل: خامس ابتدائي."],
  ["التخصص", "مطلوب للمرحلة الإعدادية فقط، مثل علمي أو أدبي. يترك فارغاً للابتدائي والمتوسط."],
  ["الشعبة", "مطلوب - يجب أن تطابق الشعبة الموجودة في لوحة المدرسة، مثل أ أو ب أو 1."],
  ["السنة الدراسية", "مطلوب - بالصيغة 2026-2027، ويجب وجود قالب فواتير لها في لوحة المدرسة."],
];

const gradeValues = [
  "أول ابتدائي",
  "ثاني ابتدائي",
  "ثالث ابتدائي",
  "رابع ابتدائي",
  "خامس ابتدائي",
  "سادس ابتدائي",
  "أول متوسط",
  "ثاني متوسط",
  "ثالث متوسط",
  "رابع إعدادي",
  "خامس إعدادي",
  "سادس إعدادي",
];

const specializationValues = [
  "علمي",
  "أدبي",
  "تجاري",
  "اسلامي",
  "مهني",
  "فنون جميلة",
  "تمريض",
];

async function generateTemplate() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Safe Student";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("بيانات الطلاب", {
    views: [{ rightToLeft: true, state: "frozen", ySplit: 5 }],
    properties: { defaultRowHeight: 22 },
  });

  sheet.mergeCells(1, 1, 1, columns.length);
  sheet.getCell(1, 1).value = "قالب إدخال بيانات الطلاب - Safe Student";
  sheet.getCell(1, 1).font = { bold: true, size: 18, color: { argb: "FFFFFFFF" } };
  sheet.getCell(1, 1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF176B5B" } };
  sheet.getCell(1, 1).alignment = { horizontal: "center", vertical: "middle" };
  sheet.getRow(1).height = 34;

  sheet.mergeCells(2, 1, 2, columns.length);
  sheet.getCell(2, 1).value =
    "املأ صفاً لكل طالب. لا تغيّر أسماء الأعمدة أو المفاتيح. احذف صف المثال قبل تسليم الملف. الأحمر = مطلوب، الأزرق = اختياري.";
  sheet.getCell(2, 1).font = { bold: true, color: { argb: "FF7A2E0E" } };
  sheet.getCell(2, 1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFE7D6" } };
  sheet.getCell(2, 1).alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  sheet.getRow(2).height = 38;

  columns.forEach((column, index) => {
    const columnNumber = index + 1;
    const headerCell = sheet.getCell(3, columnNumber);
    const keyCell = sheet.getCell(4, columnNumber);
    const helpCell = sheet.getCell(5, columnNumber);

    headerCell.value = `${column.title}${column.required ? " *" : ""}`;
    headerCell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: column.required ? "FFB42318" : "FF2563A7" },
    };
    headerCell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };

    keyCell.value = `[${column.key}]`;
    keyCell.font = { italic: true, color: { argb: "FF475467" } };
    keyCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F4F7" } };
    keyCell.alignment = { horizontal: "center", vertical: "middle" };

    helpCell.value = column.required ? "مطلوب" : "اختياري - للإعدادية فقط";
    helpCell.font = { size: 10, color: { argb: "FF475467" } };
    helpCell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    sheet.getColumn(columnNumber).width = column.width;
  });

  const example = [
    "علي محمد حسن الجبوري",
    "ذكر",
    10,
    4,
    2014,
    "محمد علي حسن",
    "7712345678",
    "ابتدائي",
    "خامس ابتدائي",
    "",
    "أ",
    "2026-2027",
  ];

  example.forEach((value, index) => {
    const cell = sheet.getCell(6, index + 1);
    cell.value = value;
    cell.font = { italic: true, color: { argb: "FF667085" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F4F7" } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
  });

  for (let row = 7; row <= 506; row += 1) {
    sheet.getCell(row, 2).dataValidation = {
      type: "list",
      allowBlank: false,
      formulae: ['"ذكر,أنثى"'],
      error: "اختر ذكر أو أنثى فقط.",
      errorTitle: "قيمة غير صحيحة",
      showErrorMessage: true,
    };
    sheet.getCell(row, 3).dataValidation = {
      type: "whole",
      operator: "between",
      allowBlank: false,
      formulae: [1, 31],
      showErrorMessage: true,
      error: "اليوم يجب أن يكون بين 1 و31.",
    };
    sheet.getCell(row, 4).dataValidation = {
      type: "whole",
      operator: "between",
      allowBlank: false,
      formulae: [1, 12],
      showErrorMessage: true,
      error: "الشهر يجب أن يكون بين 1 و12.",
    };
    sheet.getCell(row, 5).dataValidation = {
      type: "whole",
      operator: "between",
      allowBlank: false,
      formulae: [1990, new Date().getFullYear()],
      showErrorMessage: true,
      error: "أدخل سنة ميلادية صحيحة.",
    };
    sheet.getCell(row, 8).dataValidation = {
      type: "list",
      allowBlank: false,
      formulae: ['"ابتدائي,متوسط,إعدادي"'],
      showErrorMessage: true,
      error: "اختر مرحلة من القائمة.",
    };
    sheet.getCell(row, 9).dataValidation = {
      type: "list",
      allowBlank: false,
      formulae: [`"${gradeValues.join(",")}"`],
      showErrorMessage: true,
      error: "اختر الصف من القائمة.",
    };
    sheet.getCell(row, 10).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: [`"${specializationValues.join(",")}"`],
      showErrorMessage: true,
      error: "اختر تخصصاً من القائمة أو اتركه فارغاً.",
    };
    sheet.getCell(row, 12).dataValidation = {
      type: "list",
      allowBlank: false,
      formulae: ['"2025-2026,2026-2027,2027-2028"'],
      showErrorMessage: true,
      error: "اختر السنة الدراسية من القائمة.",
    };
    sheet.getCell(row, 7).numFmt = "@";
  }

  sheet.autoFilter = { from: { row: 3, column: 1 }, to: { row: 506, column: columns.length } };
  sheet.getRow(3).height = 34;
  sheet.getRow(4).height = 24;
  sheet.getRow(5).height = 28;
  sheet.getRow(6).height = 26;

  const guide = workbook.addWorksheet("التعليمات", {
    views: [{ rightToLeft: true, state: "frozen", ySplit: 3 }],
  });
  guide.columns = [{ width: 28 }, { width: 90 }];
  guide.mergeCells("A1:B1");
  guide.getCell("A1").value = "تعليمات ملء ملف الطلاب";
  guide.getCell("A1").font = { bold: true, size: 18, color: { argb: "FFFFFFFF" } };
  guide.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF176B5B" } };
  guide.getCell("A1").alignment = { horizontal: "center" };
  guide.getRow(1).height = 34;
  guide.addRow([]);
  guide.addRow(["العمود", "طريقة التعبئة"]);
  guide.getRow(3).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF344054" } };
    cell.alignment = { horizontal: "center" };
  });
  instructions.forEach((item) => guide.addRow(item));
  guide.addRow([]);
  guide.addRow(["حقول يولدها النظام", "لا تضفها إلى الملف: student_id، school_id، school_name، school_logo، class_id، billing_template_id، الفواتير، نتائج السنة، حالة الربط، الموقع، السائق، الخط، الإشعارات، وتاريخ الإنشاء."]);
  guide.addRow(["قبل الإدخال", "يجب أن يكون الصف والشعبة موجودين مسبقاً في لوحة المدرسة، ويجب إنشاء قالب فواتير للسنة الدراسية والصف المطلوب."]);
  guide.eachRow((row, rowNumber) => {
    if (rowNumber > 3) {
      row.alignment = { vertical: "top", wrapText: true };
      row.height = 34;
    }
  });

  await workbook.xlsx.writeFile(outputPath);
  console.log(outputPath);
}

generateTemplate().catch((error) => {
  console.error(error);
  process.exit(1);
});