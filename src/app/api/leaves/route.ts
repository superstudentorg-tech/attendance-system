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
        include: { employee: { select: { name: true, department: true } } },
        orderBy: { createdAt: 'desc' },
      });
      return NextResponse.json({ leaves });
    }

    if (companyId) {
      const leaves = await db.leaveRequest.findMany({
        where: { employee: { companyId } },
        include: { employee: { select: { name: true, department: true, position: true } } },
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

    const leave = await db.leaveRequest.create({
      data: {
        employeeId,
        type,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        reason,
        status: 'pending',
      },
      include: { employee: { select: { name: true } } }
    });

    return NextResponse.json({ message: 'تم تقديم طلب الاجازة بنجاح', leave });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'حدث خطأ أثناء تقديم الطلب' }, { status: 500 });
  }
}
