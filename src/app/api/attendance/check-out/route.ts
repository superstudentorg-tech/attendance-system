import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function POST(request: Request) {
  try {
    const { employeeId, latitude, longitude } = await request.json();

    if (!employeeId || latitude === undefined || longitude === undefined) {
      return NextResponse.json({ error: 'جميع البيانات مطلوبة' }, { status: 400 });
    }

    const employee = await db.employee.findUnique({
      where: { id: employeeId },
      include: { branch: true }
    });

    if (!employee) {
      return NextResponse.json({ error: 'الموظف غير موجود' }, { status: 404 });
    }

    // Calculate distance from branch
    const distance = calculateDistance(
      latitude,
      longitude,
      employee.branch.latitude,
      employee.branch.longitude
    );

    if (distance > employee.branch.radius) {
      return NextResponse.json({ 
        error: `أنت خارج نطاق الفرع. المسافة: ${Math.round(distance)} متر`,
        distance,
        allowedRadius: employee.branch.radius,
        withinRange: false
      }, { status: 403 });
    }

    // Find today's attendance
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const attendance = await db.attendance.findFirst({
      where: {
        employeeId,
        workDate: { gte: today, lt: tomorrow }
      }
    });

    if (!attendance) {
      return NextResponse.json({ error: 'لم يتم تسجيل الحضور اليوم' }, { status: 400 });
    }

    if (attendance.checkOut) {
      return NextResponse.json({ error: 'تم تسجيل الانصراف بالفعل اليوم' }, { status: 400 });
    }

    // Update attendance with check-out
    const now = new Date();
    const updatedAttendance = await db.attendance.update({
      where: { id: attendance.id },
      data: {
        checkOut: now,
        checkOutLat: latitude,
        checkOutLng: longitude,
        checkOutDistance: distance,
      }
    });

    return NextResponse.json({ 
      message: 'تم تسجيل الانصراف بنجاح',
      attendance: updatedAttendance,
      distance: Math.round(distance),
      withinRange: true,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'حدث خطأ أثناء تسجيل الانصراف' }, { status: 500 });
  }
}
