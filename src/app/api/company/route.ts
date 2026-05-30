import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const company = await db.company.findFirst({
      include: { branches: true }
    });
    if (!company) return NextResponse.json({ company: null });
    return NextResponse.json({ company });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { name, workStart, workEnd, branches, adminName, adminEmail, adminPassword } = await request.json();

    if (!name || !adminName || !adminEmail) {
      return NextResponse.json({ error: 'اسم الشركة واسم مدير النظام والبريد الإلكتروني مطلوبون' }, { status: 400 });
    }

    // Check if company already exists
    const existing = await db.company.findFirst();
    if (existing) {
      return NextResponse.json({ error: 'يوجد شركة مسجلة بالفعل' }, { status: 400 });
    }

    const company = await db.company.create({
      data: { name, workStart: workStart || '09:00', workEnd: workEnd || '17:00', isSetup: true }
    });

    // Auto-create a default headquarters branch
    const defaultBranch = await db.branch.create({
      data: {
        name: 'المقر الرئيسي',
        address: null,
        latitude: 30.0444,
        longitude: 31.2357,
        radius: 500,
        companyId: company.id,
      }
    });

    // Create any additional branches if provided
    const createdBranches = [defaultBranch];
    if (branches && branches.length > 0) {
      for (const branch of branches) {
        if (!branch.name) continue;
        const b = await db.branch.create({
          data: {
            name: branch.name, address: branch.address || null,
            latitude: parseFloat(branch.latitude) || 30.0, longitude: parseFloat(branch.longitude) || 31.0,
            radius: parseFloat(branch.radius) || 200, companyId: company.id,
          }
        });
        createdBranches.push(b);
      }
    }

    const admin = await db.employee.create({
      data: {
        name: adminName, email: adminEmail, role: 'admin',
        password: adminPassword || 'admin123', branchId: defaultBranch.id,
        companyId: company.id, position: 'مدير النظام', department: 'الإدارة',
      }
    });

    return NextResponse.json({
      message: 'تم إنشاء الشركة بنجاح',
      company, branches: createdBranches,
      admin: { id: admin.id, name: admin.name, email: admin.email }
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'حدث خطأ أثناء إنشاء الشركة' }, { status: 500 });
  }
}
