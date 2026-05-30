import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Check if data already exists
    const existingCompany = await db.company.findFirst();
    if (existingCompany) {
      return NextResponse.json({ message: 'البيانات موجودة بالفعل', company: existingCompany });
    }

    // Create company
    const company = await db.company.create({
      data: {
        name: 'شركة النخبة للأعمال',
        workStart: '09:00',
        workEnd: '17:00',
      }
    });

    // Create branches
    const branch1 = await db.branch.create({
      data: {
        name: 'الفرع الرئيسي - القاهرة',
        address: 'القاهرة، مصر الجديدة، شارع الثورة',
        latitude: 30.0561,
        longitude: 31.3313,
        radius: 200,
        companyId: company.id,
      }
    });

    const branch2 = await db.branch.create({
      data: {
        name: 'فرع الإسكندرية',
        address: 'الإسكندرية، سموحة، شارع 14 مايو',
        latitude: 31.2054,
        longitude: 29.9243,
        radius: 150,
        companyId: company.id,
      }
    });

    const branch3 = await db.branch.create({
      data: {
        name: 'فرع الجيزة',
        address: 'الجيزة، الدقي، شارع التحرير',
        latitude: 30.0444,
        longitude: 31.2357,
        radius: 180,
        companyId: company.id,
      }
    });

    // Create admin employee
    await db.employee.create({
      data: {
        name: 'مدير النظام',
        email: 'admin@company.com',
        phone: '01000000000',
        position: 'مدير',
        department: 'الإدارة',
        role: 'admin',
        password: 'admin123',
        branchId: branch1.id,
        companyId: company.id,
      }
    });

    // Create sample employees
    await db.employee.createMany({
      data: [
        {
          name: 'أحمد محمد',
          email: 'ahmed@company.com',
          phone: '01100000001',
          position: 'مهندس برمجيات',
          department: 'تكنولوجيا المعلومات',
          role: 'employee',
          password: '123456',
          branchId: branch1.id,
          companyId: company.id,
        },
        {
          name: 'سارة أحمد',
          email: 'sara@company.com',
          phone: '01100000002',
          position: 'محاسبة',
          department: 'المالية',
          role: 'employee',
          password: '123456',
          branchId: branch1.id,
          companyId: company.id,
        },
        {
          name: 'محمد علي',
          email: 'mohamed@company.com',
          phone: '01100000003',
          position: 'مدير مبيعات',
          department: 'المبيعات',
          role: 'employee',
          password: '123456',
          branchId: branch2.id,
          companyId: company.id,
        },
        {
          name: 'فاطمة حسن',
          email: 'fatma@company.com',
          phone: '01100000004',
          position: 'مسؤولة موارد بشرية',
          department: 'الموارد البشرية',
          role: 'employee',
          password: '123456',
          branchId: branch3.id,
          companyId: company.id,
        },
      ]
    });

    return NextResponse.json({ 
      message: 'تم إنشاء البيانات بنجاح',
      company,
      branches: [branch1, branch2, branch3]
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'حدث خطأ أثناء إنشاء البيانات' }, { status: 500 });
  }
}
