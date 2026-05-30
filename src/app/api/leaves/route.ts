import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');
    const companyId = searchParams.get('companyId');

    if (employeeId) {
      const leaves = await db.leaveRequest.findMany({
        where: { employeeId },
        include: {
          employee: { select: { name: true, department: true } },
          assignedTo: { select: { id: true, name: true, position: true } },
          approvedBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
      return NextResponse.json({ leaves });
    }

    if (companyId) {
      const leaves = await db.leaveRequest.findMany({
        where: { employee: { companyId } },
        include: {
          employee: { select: { name: true, department: true, position: true } },
          assignedTo: { select: { id: true, name: true, position: true } },
          approvedBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
      return NextResponse.json({ leaves });
    }

    return NextResponse.json({ error: 'معرف الموظف أو الشركة مطلوب' }, { status: 400 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { employeeId, type, startDate, endDate, reason } = await request.json();

    if (!employeeId || !type || !startDate || !endDate || !reason) {
      return NextResponse.json({ error: 'جميع البيانات مطلوبة' }, { status: 400 });
    }

    const employee = await db.employee.findUnique({
      where: { id: employeeId },
      include: { company: true }
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
          category: 'leave',
          requestType: type,
        }
      }
    });

    if (approvalSetting) {
      assignedToId = approvalSetting.approverId;
    } else {
      // Fall back to direct manager
      assignedToId = employee.managerId;
    }

    const leave = await db.leaveRequest.create({
      data: {
        employeeId,
        type,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
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
        ? `تم تقديم طلب الاجازة بنجاح - تم توجيه الطلب إلى: ${leave.assignedTo?.name || 'المدير المباشر'}`
        : 'تم تقديم طلب الاجازة بنجاح - لا يوجد معتمد محدد',
      leave
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'حدث خطأ أثناء تقديم الطلب' }, { status: 500 });
  }
}
