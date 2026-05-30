import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const reset = searchParams.get('reset');

    if (reset === '1') {
      // Delete all data and re-seed
      await db.approvalSetting.deleteMany({});
      await db.permissionRequest.deleteMany({});
      await db.leaveRequest.deleteMany({});
      await db.attendance.deleteMany({});
      await db.employee.deleteMany({});
      await db.branch.deleteMany({});
      await db.company.deleteMany({});
    } else {
      const existingCompany = await db.company.findFirst();
      if (existingCompany) {
        return NextResponse.json({ message: 'البيانات موجودة بالفعل. استخدم ?reset=1 لإعادة التهيئة', company: existingCompany });
      }
    }

    const company = await db.company.create({
      data: { name: 'شركة النخبة للأعمال', workStart: '09:00', workEnd: '17:00', isSetup: true }
    });

    const branch1 = await db.branch.create({ data: { name: 'الفرع الرئيسي - القاهرة', address: 'القاهرة، مصر الجديدة', latitude: 30.0561, longitude: 31.3313, radius: 200, companyId: company.id } });
    const branch2 = await db.branch.create({ data: { name: 'فرع الإسكندرية', address: 'الإسكندرية، سموحة', latitude: 31.2054, longitude: 29.9243, radius: 150, companyId: company.id } });
    const branch3 = await db.branch.create({ data: { name: 'فرع الجيزة', address: 'الجيزة، الدقي', latitude: 30.0444, longitude: 31.2357, radius: 180, companyId: company.id } });

    const admin = await db.employee.create({ data: { name: 'مدير النظام', email: 'admin@company.com', phone: '01000000000', position: 'مدير عام', department: 'الإدارة', role: 'admin', password: 'admin123', branchId: branch1.id, companyId: company.id } });
    const hrManager = await db.employee.create({ data: { name: 'فاطمة حسن', email: 'fatma@company.com', phone: '01100000004', position: 'مدير الموارد البشرية', department: 'الموارد البشرية', role: 'manager', password: '123456', branchId: branch1.id, companyId: company.id } });
    const financeManager = await db.employee.create({ data: { name: 'خالد إبراهيم', email: 'khaled@company.com', phone: '01100000005', position: 'مدير المالية', department: 'المالية', role: 'manager', password: '123456', branchId: branch1.id, companyId: company.id } });

    await db.employee.createMany({
      data: [
        { name: 'أحمد محمد', email: 'ahmed@company.com', phone: '01100000001', position: 'مهندس برمجيات', department: 'تكنولوجيا المعلومات', role: 'employee', password: '123456', branchId: branch1.id, companyId: company.id, managerId: admin.id },
        { name: 'سارة أحمد', email: 'sara@company.com', phone: '01100000002', position: 'محاسبة', department: 'المالية', role: 'employee', password: '123456', branchId: branch1.id, companyId: company.id, managerId: financeManager.id },
        { name: 'محمد علي', email: 'mohamed@company.com', phone: '01100000003', position: 'مدير مبيعات', department: 'المبيعات', role: 'employee', password: '123456', branchId: branch2.id, companyId: company.id, managerId: admin.id },
        { name: 'نور السيد', email: 'nour@company.com', phone: '01100000006', position: 'أخصائية موارد بشرية', department: 'الموارد البشرية', role: 'employee', password: '123456', branchId: branch3.id, companyId: company.id, managerId: hrManager.id },
      ]
    });

    // Level 1: Direct Manager (automatic)
    // Level 2: Specific approver per type
    await db.approvalSetting.createMany({
      data: [
        { companyId: company.id, category: 'leave', requestType: 'annual', level: 2, approverId: hrManager.id },
        { companyId: company.id, category: 'leave', requestType: 'sick', level: 2, approverId: hrManager.id },
        { companyId: company.id, category: 'leave', requestType: 'personal', level: 2, approverId: admin.id },
        { companyId: company.id, category: 'leave', requestType: 'unpaid', level: 2, approverId: financeManager.id },
        { companyId: company.id, category: 'leave', requestType: 'emergency', level: 2, approverId: admin.id },
        { companyId: company.id, category: 'leave', requestType: 'maternity', level: 2, approverId: hrManager.id },
        { companyId: company.id, category: 'permission', requestType: 'personal', level: 2, approverId: hrManager.id },
        { companyId: company.id, category: 'permission', requestType: 'late', level: 2, approverId: hrManager.id },
        { companyId: company.id, category: 'permission', requestType: 'early', level: 2, approverId: hrManager.id },
        { companyId: company.id, category: 'permission', requestType: 'errand', level: 2, approverId: admin.id },
        { companyId: company.id, category: 'permission', requestType: 'other', level: 2, approverId: admin.id },
      ]
    });

    return NextResponse.json({
      message: 'تم إنشاء البيانات بنجاح مع نظام الموافقة على مرحلتين',
      approvalFlow: 'المرحلة 1: المدير المباشر → المرحلة 2: المعتمد حسب النوع (HR/مالية/إدارة)',
      company: { id: company.id, name: company.name }
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}
