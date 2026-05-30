import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const existingCompany = await db.company.findFirst();
    if (existingCompany) {
      return NextResponse.json({ message: 'البيانات موجودة بالفعل', company: existingCompany });
    }

    const company = await db.company.create({
      data: {
        name: 'شركة النخبة للأعمال',
        workStart: '09:00',
        workEnd: '17:00',
        isSetup: true,
      }
    });

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

    // Admin
    const admin = await db.employee.create({
      data: {
        name: 'مدير النظام',
        email: 'admin@company.com',
        phone: '01000000000',
        position: 'مدير عام',
        department: 'الإدارة',
        role: 'admin',
        password: 'admin123',
        branchId: branch1.id,
        companyId: company.id,
      }
    });

    // HR Manager
    const hrManager = await db.employee.create({
      data: {
        name: 'فاطمة حسن',
        email: 'fatma@company.com',
        phone: '01100000004',
        position: 'مدير الموارد البشرية',
        department: 'الموارد البشرية',
        role: 'manager',
        password: '123456',
        branchId: branch1.id,
        companyId: company.id,
      }
    });

    // Finance Manager
    const financeManager = await db.employee.create({
      data: {
        name: 'خالد إبراهيم',
        email: 'khaled@company.com',
        phone: '01100000005',
        position: 'مدير المالية',
        department: 'المالية',
        role: 'manager',
        password: '123456',
        branchId: branch1.id,
        companyId: company.id,
      }
    });

    // Employees with managers
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
          managerId: admin.id,
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
          managerId: financeManager.id,
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
          managerId: admin.id,
        },
        {
          name: 'نور السيد',
          email: 'nour@company.com',
          phone: '01100000006',
          position: 'أخصائية موارد بشرية',
          department: 'الموارد البشرية',
          role: 'employee',
          password: '123456',
          branchId: branch3.id,
          companyId: company.id,
          managerId: hrManager.id,
        },
      ]
    });

    // Approval settings - different approvers per type
    await db.approvalSetting.createMany({
      data: [
        { companyId: company.id, category: 'leave', requestType: 'annual', approverId: hrManager.id },
        { companyId: company.id, category: 'leave', requestType: 'sick', approverId: hrManager.id },
        { companyId: company.id, category: 'leave', requestType: 'personal', approverId: admin.id },
        { companyId: company.id, category: 'leave', requestType: 'unpaid', approverId: financeManager.id },
        { companyId: company.id, category: 'leave', requestType: 'emergency', approverId: admin.id },
        { companyId: company.id, category: 'leave', requestType: 'maternity', approverId: hrManager.id },
        { companyId: company.id, category: 'permission', requestType: 'personal', approverId: hrManager.id },
        { companyId: company.id, category: 'permission', requestType: 'late', approverId: hrManager.id },
        { companyId: company.id, category: 'permission', requestType: 'early', approverId: hrManager.id },
        { companyId: company.id, category: 'permission', requestType: 'errand', approverId: admin.id },
        { companyId: company.id, category: 'permission', requestType: 'other', approverId: admin.id },
      ]
    });

    return NextResponse.json({
      message: 'تم إنشاء البيانات بنجاح مع إعدادات الاعتماد',
      company,
      managers: { admin: admin.name, hr: hrManager.name, finance: financeManager.name }
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'حدث خطأ أثناء إنشاء البيانات' }, { status: 500 });
  }
}
