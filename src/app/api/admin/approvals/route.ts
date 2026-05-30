import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { type, id, approvedBy } = await request.json();

    if (!type || !id || !approvedBy) {
      return NextResponse.json({ error: 'جميع البيانات مطلوبة' }, { status: 400 });
    }

    const status = type === 'approve' ? 'approved' : 'rejected';

    if (type === 'approve' || type === 'reject') {
      // Check if it's a leave or permission request
      // Try leave first
      let leave = await db.leaveRequest.findUnique({ where: { id } });
      if (leave) {
        const updated = await db.leaveRequest.update({
          where: { id },
          data: { status, approvedBy, approvedAt: new Date() },
          include: { employee: { select: { name: true } } }
        });
        return NextResponse.json({ 
          message: status === 'approved' ? 'تم اعتماد طلب الاجازة' : 'تم رفض طلب الاجازة',
          request: updated 
        });
      }

      // Try permission
      let permission = await db.permissionRequest.findUnique({ where: { id } });
      if (permission) {
        const updated = await db.permissionRequest.update({
          where: { id },
          data: { status, approvedBy, approvedAt: new Date() },
          include: { employee: { select: { name: true } } }
        });
        return NextResponse.json({ 
          message: status === 'approved' ? 'تم اعتماد طلب الإذن' : 'تم رفض طلب الإذن',
          request: updated 
        });
      }

      return NextResponse.json({ error: 'الطلب غير موجود' }, { status: 404 });
    }

    return NextResponse.json({ error: 'نوع العملية غير صحيح' }, { status: 400 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}
