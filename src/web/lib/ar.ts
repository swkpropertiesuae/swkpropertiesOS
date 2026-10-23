// English → Arabic UI dictionary. Anything missing falls back to English.
const RAW = `
Dashboard|لوحة التحكم
Operations|العمليات
Deals|الصفقات
Deal|صفقة
Deal files|ملفات الصفقات
Deals & Pipeline|الصفقات وخط البيع
Master Deal|صفقة
Leads|العملاء المحتملون
Lead|عميل محتمل
Lead Search|بحث العملاء المحتملين
CRM & Sales|العملاء والمبيعات
Properties|العقارات
Property|عقار
Property No.|رقم العقار
Properties & Units|العقارات والوحدات
Communities|المجتمعات السكنية
Developers|المطورون
Mandates|الموكّنة
Mandate|موكّنة
Viewings|المعاينات
Viewing|معاينة
Offers|العروض
Offer|عرض
Sales Contracts|عقود البيع
Sales contract|عقد بيع
Leases|عقود الإيجار
Lease|عقد إيجار
Leases & Property Management|الإيجار وإدارة الأملاك
Rent Schedule|جدول الإيجار
Rent Schedules|جداول الإيجار
Rent Receipts|سندات الإيجار
Renewals|التجديلات
Snagging|مطابقة التسليم
Handover|التسليم
Accounting|المحاسبة
Accounts|الحسابات
Invoices|الفواتير
Invoice|فاتورة
Invoice no.|رقم الفاتورة
Invoice date|تاريخ الفاتورة
Bills|فواتير الموردين
Bill|فاتورة مورد
Receipts|السندات
Payment|دفعة
Payments|الدفعات
Payment no.|رقم السند
Method|الطريقة
Reference|المرجع
Bank Accounts|الحسابات البنكية
Bank Transactions|حركات بنكية
Bank Statement Import|استيراد كشف الحساب
Journal Entries|قيود اليومية
Fixed Assets|الأصول الثابتة
Expenses|المصروفات
Ledger|دفتر الأستاذ
Trial Balance|ميزان المراجعة
Debit|مدين
Credit|دائن
Paid|المدفوع
Balance|الرصيد
Revenue (AED)|الإيرادات (درهم)
Cost (AED)|التكلفة (درهم)
Profit (AED)|الربح (درهم)
Currency|العملة
Exchange rates|أسعار الصرف
Payment terms|شروط الدفع
People|الموظفون
Employees|الموظفون
Employee no.|رقم الموظف
Join date|تاريخ الانضمام
Nationality|الجنسية
Passport no.|رقم جواز السفر
Passport expiry|انتهاء جواز السفر
Emirates ID|الهوية الإماراتية
Visa expiry|انتهاء التأشيرة
Job title|المسمى الوظيفي
Branch|الفرع
Departments|الأقسام
Attendance|الحضور
Leave|الإجازة
Payroll|الرواتب
Payslips|قسائم الرواتب
Basic salary|الراتب الأساسي
Housing|بدل السكن
Allowances|البدلات
Overtime|العمل الإضافي
Deductions|الخصومات
Net pay|صافي الراتب
Agents|الوكلاء
Agent commissions|عمولات الوكلاء
Compliance|الامتثال
Licences|التراخيص
Permits|التصاريح
Projects|المشاريع
Documents|المستندات
Document no.|رقم المستند
Document type|نوع المستند
Automation|الأتمتة
Announcements|الإعلانات
Reports|التقارير
Administration|الإدارة
Users|المستخدمون
Roles|الأدوار
Sessions|الجلسات
Settings|الإعدادات
Audit log|سجل التدقيق
Workspaces|مساحات العمل
Books|الدفاتر
Party|جهة اتصال
Customers|العملاء
Customer|عميل
Vendors|الموردون
Vendor|مورد
VAT Codes|رموز الضريبة
Service items|بنود الخدمة
Charge codes|رموز الرسوم
Countries|الدول
Currencies|العملات
Companies|الشركات
Legal entities|الكيانات القانونية
Branches|الفروع
Tax Invoice|فاتورة ضريبية
Quotations|عروض الأسعار
Quotation|عرض سعر
Quote no.|رقم العرض
Valid until|صالح حتى
Salesperson|مسؤول المبيعات
Campaigns|الحملات
Marketing|التسويق
Opportunities|الفرص
Opportunity|فرصة
Contacts|جهات الاتصال
Notes|ملاحظات
Attachments|المرفقات
File|الملف
Support|الدعم
Tickets|التذاكر
Ticket no.|رقم التذكرة
Claims|المطالبات
Dispute|نزاع
Priority|الأولوية
Resolution|الحل
Due|مستحق
Start date|تاريخ البدء
End date|تاريخ الانتهاء
Status|الحالة
Type|النوع
Name|الاسم
Code|الرمز
Qty|الكمية
Rate|السعر
Amount|المبلغ
Total|الإجمالي
Net profit / (loss)|صافي الربح / (الخسارة)
Fiscal year|السنة المالية
Period|الفترة
Receivables|الذمم المدينة
Payables|الذمم الدائنة
Ageing|تقادم الديون
Cash flow|التدفق النقدي
Owner|المالك
Landlord|المالك
Tenant|المستأجر
Buyer|المشتري
Seller|البائع
Landlord & Tenant|المالك والمستأجر
Security deposit|مبلغ التأمين
Agency fee|أتعاب الوساطة
Commission|العمولة
Annual rent|الإيجار السنوي
Cheques|الشيكات
Ejari|إجاري
Building|المبنى
Unit|الوحدة
Bedrooms|غرف النوم
Bathrooms|دورات المياه
Area (sqft)|المساحة (قدم²)
Furnishing|التجهيزات
Floor|الطابق
Parking|مواقف السيارات
Listing|إدراج عقاري
Portal|منصة إعلانية
Price|السعر
Asking price|السعر المطلوب
Asking rent|الإيجار المطلوب
Valuation|التقييم
ROI|العائد على الاستثمار
Service charge|رسوم الخدمة
Maintenance|الصيانة
Inspections|التفتيش
Escrow|الحساب الوصي
Title deed|صك التملك
DLD|دائرة الأراضي والعقارات
RERA|ريرا
Trakheesi|ترخيصي
Permit no.|رقم التصريح
`
export const AR: Record<string, string> = {}
for (const line of RAW.split('\n')) { const i = line.indexOf('|'); if (i > 0) AR[line.slice(0, i).trim()] = line.slice(i + 1).trim() }

// common interface strings
Object.assign(AR, {
  Save: 'حفظ', 'Save Changes': 'حفظ التغييرات', Cancel: 'إلغاء', Edit: 'تعديل', Create: 'إنشاء', Delete: 'حذف', Back: 'رجوع', Search: 'بحث', Export: 'تصدير', Filters: 'تصفية', Print: 'طباعة', Close: 'إغلاق', Send: 'إرسال', Post: 'ترحيل', Void: 'إلغاء المستند',
  'Log Out': 'تسجيل الخروج', Help: 'مساعدة', Blog: 'المدونة', Notifications: 'الإشعارات', Report: 'تقرير', 'Bulk Mail / Print': 'بريد / طباعة جماعية', KPI: 'مؤشرات الأداء',
  Comments: 'التعليقات', 'Follow Up': 'المتابعة', References: 'المراجع', Tags: 'الوسوم', Links: 'الروابط', Likes: 'الإعجابات', Complaints: 'الشكاوى', 'Video Call': 'مكالمة فيديو', History: 'السجل',
  Overview: 'نظرة عامة', 'Recent Deals': 'أحدث الصفقات', 'Recent Call List': 'أحدث المكالمات', 'Sales (Branch)': 'المبيعات (حسب الفرع)',
  'Welcome to DigitalBurj OS': 'مرحباً بكم في نظام ديجيتال بورج للعقارات', 'Track and Manage Deals, Properties, Leases, Accounts and Compliance': 'تتبع وإدارة الصفقات والعقارات والإيجارات والحسابات والامتثال',
  'All statuses': 'كل الحالات', 'Page': 'صفحة', 'No records': 'لا توجد سجلات', Loading: 'جارٍ التحميل…', Records: 'سجلات', 'New': 'جديد', Draft: 'مسودة', Posted: 'مرحّل', Paid: 'مدفوع', Open: 'مفتوح', Closed: 'مغلق', Pending: 'قيد الانتظار', Approved: 'معتمد', Rejected: 'مرفوض', Cancelled: 'ملغى',
  'Language': 'اللغة', 'Signed in as': 'تم الدخول باسم', 'Change it now': 'غيّرها الآن', 'You are signed in with the default password.': 'أنت تستخدم كلمة المرور الافتراضية.',
})
