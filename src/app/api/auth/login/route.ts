import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'البريد الإلكتروني وكلمة المرور مطلوبان' }, { status: 400 });
    }

    const employee = await db.employee.findUnique({
      where: { email },
      include: {
        branch: true,
        company: { include: { branches: true } },
        manager: { select: { id: true, name: true, email: true } },
        subordinates: { select: { id: true, name: true, email: true, position: true } },
      }
    });

    if (!employee) {
      return NextResponse.json({ error: 'الموظف غير موجود' }, { status: 404 });
    }

    if (employee.password !== password) {
      return NextResponse.json({ error: 'كلمة المرور غير صحيحة' }, { status: 401 });
    }

    return NextResponse.json({
      employee: {
        id: employee.id,
        name: employee.name,
        email: employee.email,
        phone: employee.phone,
        position: employee.position,
        department: employee.department,
        role: employee.role,
        branch: employee.branch,
        company: employee.company,
        manager: employee.manager,
        subordinates: employee.subordinates,
      }
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'حدث خطأ أثناء تسجيل الدخول' }, { status: 500 });
  }
}
