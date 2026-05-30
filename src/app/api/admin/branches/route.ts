import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');

    if (!companyId) {
      return NextResponse.json({ error: 'معرف الشركة مطلوب' }, { status: 400 });
    }

    const branches = await db.branch.findMany({
      where: { companyId },
      include: { _count: { select: { employees: true } } },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ branches });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { name, address, latitude, longitude, radius, companyId } = await request.json();

    if (!name || latitude === undefined || longitude === undefined || !companyId) {
      return NextResponse.json({ error: 'جميع البيانات مطلوبة' }, { status: 400 });
    }

    const branch = await db.branch.create({
      data: {
        name,
        address: address || null,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        radius: parseFloat(radius) || 100,
        companyId,
      }
    });

    return NextResponse.json({ message: 'تم إنشاء الفرع بنجاح', branch });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'حدث خطأ أثناء إنشاء الفرع' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { id, name, address, latitude, longitude, radius } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'معرف الفرع مطلوب' }, { status: 400 });
    }

    const branch = await db.branch.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(address !== undefined && { address }),
        ...(latitude !== undefined && { latitude: parseFloat(latitude) }),
        ...(longitude !== undefined && { longitude: parseFloat(longitude) }),
        ...(radius !== undefined && { radius: parseFloat(radius) }),
      }
    });

    return NextResponse.json({ message: 'تم تحديث الفرع بنجاح', branch });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'حدث خطأ أثناء تحديث الفرع' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'معرف الفرع مطلوب' }, { status: 400 });
    }

    await db.branch.delete({ where: { id } });
    return NextResponse.json({ message: 'تم حذف الفرع بنجاح' });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'حدث خطأ أثناء حذف الفرع' }, { status: 500 });
  }
}
