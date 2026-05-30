import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');
    const companyId = searchParams.get('companyId');

    if (employeeId) {
      const permissions = await db.permissionRequest.findMany({
        where: { employeeId },
        include: {
          employee: { select: { name: true, department: true } },
          assignedTo: { select: { id: true, name: true, position: true } },
          approvedBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
      return NextResponse.json({ permissions });
    }

    if (companyId) {
      const permissions = await db.permissionRequest.findMany({
        where: { employee: { companyId } },
        include: {
          employee: { select: { name: true, department: true, position: true } },
          assignedTo: { select: { id: true, name: true, position: true } },
          approvedBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
      return NextResponse.json({ permissions });
    }

    return NextResponse.json({ error: 'معرف الموظف أو الشركة مطلوب' }, { status: 400 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { employeeId, type, date, timeFrom, timeTo, reason } = await request.json();

    if (!employeeId || !type || !date || !timeFrom || !timeTo || !reason) {
      return NextResponse.json({ error: 'جميع البيانات مطلوبة' }, { status: 400 });
    }

    const employee = await db.employee.findUnique({
      where: { id: employeeId },
    });

    if (!employee) {
      return NextResponse.json({ error: 'الموظف غير موجود' }, { status: 404 });
    }

    // Find the approver based on approval settings
    let assignedToId: string | null = null;
    const approvalSetting = await db.approvalSetting.findUnique({
      where: {
        companyId_category_requestType: {
          companyId: employee.companyId,
          category: 'permission',
          requestType: type,
        }
      }
    });

    if (approvalSetting) {
      assignedToId = approvalSetting.approverId;
    } else {
      assignedToId = employee.managerId;
    }

    const permission = await db.permissionRequest.create({
      data: {
        employeeId,
        type,
        date: new Date(date),
        timeFrom,
        timeTo,
        reason,
        status: 'pending',
        assignedToId,
      },
      include: {
        employee: { select: { name: true } },
        assignedTo: { select: { name: true, position: true } },
      }
    });

    return NextResponse.json({
      message: assignedToId
        ? `تم تقديم طلب الإذن بنجاح - تم توجيه الطلب إلى: ${permission.assignedTo?.name || 'المدير المباشر'}`
        : 'تم تقديم طلب الإذن بنجاح',
      permission
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'حدث خطأ أثناء تقديم الطلب' }, { status: 500 });
  }
}
