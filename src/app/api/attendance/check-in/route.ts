import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

// Calculate distance between two GPS coordinates using Haversine formula
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth's radius in meters
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

    // Get employee with branch info
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

    // Check if within allowed radius
    if (distance > employee.branch.radius) {
      return NextResponse.json({ 
        error: `أنت خارج نطاق الفرع. المسافة: ${Math.round(distance)} متر. النطاق المسموح: ${Math.round(employee.branch.radius)} متر`,
        distance,
        allowedRadius: employee.branch.radius,
        withinRange: false
      }, { status: 403 });
    }

    // Check if already checked in today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const existingAttendance = await db.attendance.findFirst({
      where: {
        employeeId,
        workDate: { gte: today, lt: tomorrow }
      }
    });

    if (existingAttendance?.checkIn) {
      return NextResponse.json({ 
        error: 'تم تسجيل الحضور بالفعل اليوم',
        attendance: existingAttendance 
      }, { status: 400 });
    }

    // Determine status based on work start time
    const now = new Date();
    const [workStartHour, workStartMin] = employee.branch.company.workStart.split(':').map(Number);
    const workStartTime = new Date(now);
    workStartTime.setHours(workStartHour, workStartMin, 0, 0);
    
    let status = 'present';
    if (now > new Date(workStartTime.getTime() + 15 * 60000)) {
      status = 'late';
    }

    // Create attendance record
    const attendance = await db.attendance.create({
      data: {
        employeeId,
        branchId: employee.branchId,
        workDate: today,
        checkIn: now,
        checkInLat: latitude,
        checkInLng: longitude,
        checkInDistance: distance,
        status,
      }
    });

    return NextResponse.json({ 
      message: status === 'late' ? 'تم تسجيل الحضور (متأخر)' : 'تم تسجيل الحضور بنجاح',
      attendance,
      distance: Math.round(distance),
      withinRange: true,
      isLate: status === 'late'
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'حدث خطأ أثناء تسجيل الحضور' }, { status: 500 });
  }
}
