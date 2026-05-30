import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { type, id, approvedById, note } = await request.json();
    if (!type || !id || !approvedById) {
      return NextResponse.json({ error: 'جميع البيانات مطلوبة' }, { status: 400 });
    }

    const approver = await db.employee.findUnique({ where: { id: approvedById } });
    if (!approver) return NextResponse.json({ error: 'المعتمد غير موجود' }, { status: 404 });

    // === LEAVE REQUEST ===
    const leave = await db.leaveRequest.findUnique({ where: { id }, include: { employee: { select: { name: true } } } });
    if (leave) {
      if (leave.status === 'pending_level1' && leave.level1AssignedToId === approvedById) {
        if (type === 'approve') {
          // Level 1 approved - move to level 2 or fully approve
          if (leave.level2AssignedToId) {
            await db.leaveRequest.update({
              where: { id },
              data: {
                status: 'pending_level2',
                currentLevel: 2,
                level1ApprovedBy: approver.name,
                level1ApprovedAt: new Date(),
                level1Note: note || null,
              }
            });
            return NextResponse.json({ message: `تمت الموافقة الأولى - تم توجيه الطلب إلى المعتمد الثاني` });
          } else {
            // No level 2 needed - fully approved
            await db.leaveRequest.update({
              where: { id },
              data: {
                status: 'approved',
                currentLevel: 2,
                level1ApprovedBy: approver.name,
                level1ApprovedAt: new Date(),
                level1Note: note || null,
                level2ApprovedBy: approver.name,
                level2ApprovedAt: new Date(),
              }
            });
            return NextResponse.json({ message: `تمت الموافقة على اجازة ${leave.employee?.name} ✅` });
          }
        } else {
          // Level 1 rejected
          await db.leaveRequest.update({
            where: { id },
            data: { status: 'rejected', level1ApprovedBy: approver.name, level1ApprovedAt: new Date(), level1Note: note || null }
          });
          return NextResponse.json({ message: `تم رفض طلب اجازة ${leave.employee?.name}` });
        }
      }

      if (leave.status === 'pending_level2' && leave.level2AssignedToId === approvedById) {
        if (type === 'approve') {
          await db.leaveRequest.update({
            where: { id },
            data: { status: 'approved', level2ApprovedBy: approver.name, level2ApprovedAt: new Date(), level2Note: note || null }
          });
          return NextResponse.json({ message: `تمت الموافقة النهائية على اجازة ${leave.employee?.name} ✅` });
        } else {
          await db.leaveRequest.update({
            where: { id },
            data: { status: 'rejected', level2ApprovedBy: approver.name, level2ApprovedAt: new Date(), level2Note: note || null }
          });
          return NextResponse.json({ message: `تم رفض طلب اجازة ${leave.employee?.name} في المرحلة الثانية` });
        }
      }

      return NextResponse.json({ error: 'غير مسموح لك بالاعتماد على هذا الطلب' }, { status: 403 });
    }

    // === PERMISSION REQUEST ===
    const perm = await db.permissionRequest.findUnique({ where: { id }, include: { employee: { select: { name: true } } } });
    if (perm) {
      if (perm.status === 'pending_level1' && perm.level1AssignedToId === approvedById) {
        if (type === 'approve') {
          if (perm.level2AssignedToId) {
            await db.permissionRequest.update({
              where: { id },
              data: { status: 'pending_level2', currentLevel: 2, level1ApprovedBy: approver.name, level1ApprovedAt: new Date(), level1Note: note || null }
            });
            return NextResponse.json({ message: `تمت الموافقة الأولى - تم توجيه الطلب إلى المعتمد الثاني` });
          } else {
            await db.permissionRequest.update({
              where: { id },
              data: { status: 'approved', level1ApprovedBy: approver.name, level1ApprovedAt: new Date(), level1Note: note || null, level2ApprovedBy: approver.name, level2ApprovedAt: new Date() }
            });
            return NextResponse.json({ message: `تمت الموافقة على إذن ${perm.employee?.name} ✅` });
          }
        } else {
          await db.permissionRequest.update({
            where: { id },
            data: { status: 'rejected', level1ApprovedBy: approver.name, level1ApprovedAt: new Date(), level1Note: note || null }
          });
          return NextResponse.json({ message: `تم رفض طلب إذن ${perm.employee?.name}` });
        }
      }

      if (perm.status === 'pending_level2' && perm.level2AssignedToId === approvedById) {
        if (type === 'approve') {
          await db.permissionRequest.update({
            where: { id },
            data: { status: 'approved', level2ApprovedBy: approver.name, level2ApprovedAt: new Date(), level2Note: note || null }
          });
          return NextResponse.json({ message: `تمت الموافقة النهائية على إذن ${perm.employee?.name} ✅` });
        } else {
          await db.permissionRequest.update({
            where: { id },
            data: { status: 'rejected', level2ApprovedBy: approver.name, level2ApprovedAt: new Date(), level2Note: note || null }
          });
          return NextResponse.json({ message: `تم رفض طلب إذن ${perm.employee?.name} في المرحلة الثانية` });
        }
      }

      return NextResponse.json({ error: 'غير مسموح لك بالاعتماد على هذا الطلب' }, { status: 403 });
    }

    return NextResponse.json({ error: 'الطلب غير موجود' }, { status: 404 });
  } catch (error) { console.error(error); return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 }); }
}
