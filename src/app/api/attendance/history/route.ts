import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');
    const companyId = searchParams.get('companyId');
    const limit = parseInt(searchParams.get('limit') || '30');

    if (employeeId) {
      // Get attendance history for a specific employee
      const records = await db.attendance.findMany({
        where: { employeeId },
        include: { 
          employee: { select: { name: true, department: true } },
          branch: { select: { name: true } }
        },
        orderBy: { workDate: 'desc' },
        take: limit,
      });
      return NextResponse.json({ records });
    }

    if (companyId) {
      // Get all attendance for company (admin view)
      const records = await db.attendance.findMany({
        where: { 
          employee: { companyId }
        },
        include: { 
          employee: { select: { name: true, department: true, position: true } },
          branch: { select: { name: true } }
        },
        orderBy: { workDate: 'desc' },
        take: limit,
      });
      return NextResponse.json({ records });
    }

    return NextResponse.json({ error: 'معرف الموظف أو الشركة مطلوب' }, { status: 400 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}
