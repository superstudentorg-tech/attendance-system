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
      const leaves = await db.leaveRequest.findMany({ where: { employeeId }, include: includeOpts, orderBy: { createdAt: 'desc' } });
      return NextResponse.json({ leaves });
    }
    if (companyId) {
      const leaves = await db.leaveRequest.findMany({ where: { employee: { companyId } }, include: includeOpts, orderBy: { createdAt: 'desc' } });
      return NextResponse.json({ leaves });
    }
    return NextResponse.json({ error: 'معرف الموظف أو الشركة مطلوب' }, { status: 400 });
  } catch (error) { console.error(error); return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 }); }
}

export async function POST(request: Request) {
  try {
    const { employeeId, type, startDate, endDate, reason } = await request.json();
    if (!employeeId || !type || !startDate || !endDate || !reason) {
      return NextResponse.json({ error: 'جميع البيانات مطلوبة' }, { status: 400 });
    }

    const employee = await db.employee.findUnique({ where: { id: employeeId } });
    if (!employee) return NextResponse.json({ error: 'الموظف غير موجود' }, { status: 404 });

    // Admin auto-approves their own requests
    if (employee.role === 'admin') {
      const leave = await db.leaveRequest.create({
        data: {
          employeeId, type, startDate: new Date(startDate), endDate: new Date(endDate), reason,
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
        message: `تم تقديم واعتماد طلب الاجازة تلقائياً (مدير النظام)`,
        leave
      });
    }

    // Level 1: Direct manager
    const level1AssignedToId = employee.managerId;
    if (!level1AssignedToId) {
      return NextResponse.json({ error: 'لا يوجد مدير مباشر معين لك. تواصل مع الإدارة' }, { status: 400 });
    }

    // Level 2: Find from approval settings
    const level2Setting = await db.approvalSetting.findUnique({
      where: { companyId_category_requestType_level: { companyId: employee.companyId, category: 'leave', requestType: type, level: 2 } }
    });
    const level2AssignedToId = level2Setting?.approverId || null;

    const leaveRequest = await db.leaveRequest.create({
      data: {
        employeeId, type, startDate: new Date(startDate), endDate: new Date(endDate), reason,
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
      message: `تم تقديم الطلب - المرحلة 1: ${leaveRequest.level1AssignedTo?.name || 'المدير المباشر'}${level2AssignedToId ? ` → المرحلة 2: ${leaveRequest.level2AssignedTo?.name || ''}` : ''}`,
      leave: leaveRequest
    });
  } catch (error) { console.error(error); return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 }); }
}
