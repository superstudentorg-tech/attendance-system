import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const branchId = searchParams.get('branchId');

    if (!companyId) {
      return NextResponse.json({ error: 'معرف الشركة مطلوب' }, { status: 400 });
    }

    const employees = await db.employee.findMany({
      where: {
        companyId,
        ...(branchId && { branchId })
      },
      include: {
        branch: { select: { name: true } },
        manager: { select: { id: true, name: true, position: true } },
        subordinates: { select: { id: true, name: true } },
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ employees });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { name, email, phone, position, department, role, password, branchId, companyId, managerId } = await request.json();

    if (!name || !email || !branchId || !companyId) {
      return NextResponse.json({ error: 'جميع البيانات مطلوبة' }, { status: 400 });
    }

    const existing = await db.employee.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: 'البريد الإلكتروني مستخدم بالفعل' }, { status: 400 });
    }

    const employee = await db.employee.create({
      data: {
        name,
        email,
        phone: phone || null,
        position: position || null,
        department: department || null,
        role: role || 'employee',
        password: password || '123456',
        branchId,
        companyId,
        managerId: managerId || null,
      },
      include: {
        branch: { select: { name: true } },
        manager: { select: { id: true, name: true } },
      }
    });

    return NextResponse.json({ message: 'تم إنشاء الموظف بنجاح', employee });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'حدث خطأ أثناء إنشاء الموظف' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { id, name, email, phone, position, department, role, branchId, managerId, password } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'معرف الموظف مطلوب' }, { status: 400 });
    }

    // Prevent self-reference for manager
    if (managerId === id) {
      return NextResponse.json({ error: 'لا يمكن تعيين الموظف كمدير لنفسه' }, { status: 400 });
    }

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (email !== undefined) data.email = email;
    if (phone !== undefined) data.phone = phone || null;
    if (position !== undefined) data.position = position || null;
    if (department !== undefined) data.department = department || null;
    if (role !== undefined) data.role = role;
    if (branchId !== undefined) data.branchId = branchId;
    if (managerId !== undefined) data.managerId = managerId || null;
    if (password !== undefined && password) data.password = password;

    const employee = await db.employee.update({
      where: { id },
      data,
      include: {
        branch: { select: { name: true } },
        manager: { select: { id: true, name: true } },
      }
    });

    return NextResponse.json({ message: 'تم تحديث بيانات الموظف بنجاح', employee });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'حدث خطأ أثناء تحديث البيانات' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'معرف الموظف مطلوب' }, { status: 400 });
    }

    await db.employee.delete({ where: { id } });
    return NextResponse.json({ message: 'تم حذف الموظف بنجاح' });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'حدث خطأ أثناء حذف الموظف' }, { status: 500 });
  }
}
