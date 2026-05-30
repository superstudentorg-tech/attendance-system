import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');
    const companyId = searchParams.get('companyId');

    const includeOpts = {
      employee: { select: { name: true, department: true, position: true } },
      level1AssignedTo: { select: { id: true, name: true, position: true } },
      level2AssignedTo: { select: { id: true, name: true, position: true } },
    };

    if (employeeId) {
      const permissions = await db.permissionRequest.findMany({ where: { employeeId }, include: includeOpts, orderBy: { createdAt: 'desc' } });
      return NextResponse.json({ permissions });
    }
    if (companyId) {
      const permissions = await db.permissionRequest.findMany({ where: { employee: { companyId } }, include: includeOpts, orderBy: { createdAt: 'desc' } });
      return NextResponse.json({ permissions });
    }
    return NextResponse.json({ error: 'معرف الموظف أو الشركة مطلوب' }, { status: 400 });
  } catch (error) { console.error(error); return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 }); }
}

export async function POST(request: Request) {
  try {
    const { employeeId, type, date, timeFrom, timeTo, reason } = await request.json();
    if (!employeeId || !type || !date || !timeFrom || !timeTo || !reason) {
      return NextResponse.json({ error: 'جميع البيانات مطلوبة' }, { status: 400 });
    }

    const employee = await db.employee.findUnique({ where: { id: employeeId } });
    if (!employee) return NextResponse.json({ error: 'الموظف غير موجود' }, { status: 404 });

    // Admin auto-approves their own requests
    if (employee.role === 'admin') {
      const permission = await db.permissionRequest.create({
        data: {
          employeeId, type, date: new Date(date), timeFrom, timeTo, reason,
          status: 'approved', currentLevel: 2,
          level1AssignedToId: employee.id,
          level1ApprovedBy: employee.name,
          level1ApprovedAt: new Date(),
          level2AssignedToId: employee.id,
          level2ApprovedBy: employee.name,
          level2ApprovedAt: new Date(),
        },
        include: {
          employee: { select: { name: true } },
          level1AssignedTo: { select: { name: true, position: true } },
          level2AssignedTo: { select: { name: true, position: true } },
        }
      });

      return NextResponse.json({
        message: `تم تقديم واعتماد طلب الإذن تلقائياً (مدير النظام)`,
        permission
      });
    }

    const level1AssignedToId = employee.managerId;
    if (!level1AssignedToId) {
      return NextResponse.json({ error: 'لا يوجد مدير مباشر معين لك. تواصل مع الإدارة' }, { status: 400 });
    }

    const level2Setting = await db.approvalSetting.findUnique({
      where: { companyId_category_requestType_level: { companyId: employee.companyId, category: 'permission', requestType: type, level: 2 } }
    });
    const level2AssignedToId = level2Setting?.approverId || null;

    const permRequest = await db.permissionRequest.create({
      data: {
        employeeId, type, date: new Date(date), timeFrom, timeTo, reason,
        status: 'pending_level1', currentLevel: 1,
        level1AssignedToId, level2AssignedToId,
      },
      include: {
        employee: { select: { name: true } },
        level1AssignedTo: { select: { name: true, position: true } },
        level2AssignedTo: { select: { name: true, position: true } },
      }
    });

    return NextResponse.json({
      message: `تم تقديم الطلب - المرحلة 1: ${permRequest.level1AssignedTo?.name || 'المدير المباشر'}${level2AssignedToId ? ` → المرحلة 2: ${permRequest.level2AssignedTo?.name || ''}` : ''}`,
      permission: permRequest
    });
  } catch (error) { console.error(error); return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 }); }
}
