# نظام الحضور والانصراف - بصمة

## النشر على Vercel

### الخطوة 1: رفع الكود على GitHub

1. اذهب إلى [github.com](https://github.com) وأنشئ مستودع جديد
2. من الجهاز المحلي:
```bash
git remote add origin https://github.com/USERNAME/attendance-system.git
git push -u origin main
```

### الخطوة 2: إنشاء قاعدة بيانات على Vercel

1. اذهب إلى [vercel.com](https://vercel.com) وافتح المشروع
2. اذهب إلى **Storage** → **Create Database** → **Postgres (Neon)**
3. اختر الخطة المجانية (Hobby)
4. انسخ رابط الاتصال `DATABASE_URL`

### الخطوة 3: ربط المشروع بـ Vercel

1. اذهب إلى [vercel.com/new](https://vercel.com/new)
2. اختر المستودع من GitHub
3. في إعدادات Environment Variables أضف:
   - `DATABASE_URL` = رابط PostgreSQL من الخطوة 2
4. اضغط **Deploy**

### الخطوة 4: تهيئة قاعدة البيانات

بعد نجاح النشر، افتح الرابط وأضف `/api/seed` في المتصفح:
```
https://your-app.vercel.app/api/seed
```

### بيانات الدخول التجريبية:
| الدور | البريد | كلمة المرور |
|-------|--------|-------------|
| مدير | admin@company.com | admin123 |
| موظف | ahmed@company.com | 123456 |

## التشغيل المحلي

```bash
npm install
npx prisma db push
npm run dev
```

افتح http://localhost:3000 واضغط "تهيئة البيانات التجريبية"
