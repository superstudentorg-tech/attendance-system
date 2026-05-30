'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useToast } from '@/hooks/use-toast'
import {
  MapPin, Clock, LogIn, LogOut, CalendarDays, FileCheck, Shield,
  Plus, Users, Building2, CheckCircle2, XCircle,
  Loader2, Fingerprint, Timer,
  LogOut as LogoutIcon, FileText, UserCheck,
  Settings, Navigation, CircleDot, UserCircle,
  ArrowUpDown, Pencil, Trash2, Network
} from 'lucide-react'

// Types
interface Branch {
  id: string; name: string; address?: string; latitude: number; longitude: number; radius: number
  _count?: { employees: number }
}

interface Company {
  id: string; name: string; workStart: string; workEnd: string; isSetup?: boolean; branches?: Branch[]
}

interface ManagerInfo {
  id: string; name: string; email?: string; position?: string
}

interface EmployeeData {
  id: string; name: string; email: string; phone?: string; position?: string; department?: string
  role: string; branch: Branch; company: Company; manager?: ManagerInfo | null; subordinates?: { id: string; name: string }[]
}

interface AttendanceData {
  id: string; checkIn: string | null; checkOut: string | null; checkInDistance?: number
  checkOutDistance?: number; status: string; workDate: string; branch: { name: string }
}

interface LeaveData {
  id: string; type: string; startDate: string; endDate: string; reason: string; status: string
  approvedById?: string; approvedBy?: { name: string } | null
  assignedToId?: string; assignedTo?: { id: string; name: string; position?: string } | null
  employee?: { name: string; department?: string }
}

interface PermissionData {
  id: string; type: string; date: string; timeFrom: string; timeTo: string; reason: string; status: string
  approvedById?: string; approvedBy?: { name: string } | null
  assignedToId?: string; assignedTo?: { id: string; name: string; position?: string } | null
  employee?: { name: string; department?: string }
}

interface ApprovalSettingData {
  id: string; category: string; requestType: string
  approverId: string; approver: { id: string; name: string; position?: string; department?: string }
}

interface EmployeeList {
  id: string; name: string; email: string; phone?: string; position?: string; department?: string
  role: string; branch: { name: string }; manager?: { id: string; name: string } | null
}

type TabValue = 'attendance' | 'leaves' | 'permissions' | 'admin'

function formatTime(d: string | null) {
  if (!d) return '--:--'
  return new Date(d).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
}

function formatDateShort(d: string) {
  return new Date(d).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' })
}

function StatusBadge({ status }: { status: string }) {
  const c: Record<string, { label: string; cls: string }> = {
    pending: { label: 'قيد المراجعة', cls: 'bg-amber-100 text-amber-800 hover:bg-amber-100' },
    approved: { label: 'معتمد', cls: 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100' },
    rejected: { label: 'مرفوض', cls: 'bg-red-100 text-red-800 hover:bg-red-100' },
    present: { label: 'حاضر', cls: 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100' },
    late: { label: 'متأخر', cls: 'bg-amber-100 text-amber-800 hover:bg-amber-100' },
  }
  const x = c[status] || c.pending
  return <Badge className={x.cls}>{x.label}</Badge>
}

const LEAVE_TYPES: Record<string, string> = {
  annual: 'اجازة سنوية', sick: 'اجازة مرضية', personal: 'اجازة شخصية',
  unpaid: 'اجازة بدون راتب', emergency: 'اجازة طارئة', maternity: 'اجازة أمومة',
}
const PERM_TYPES: Record<string, string> = {
  personal: 'إذن شخصي', late: 'تأخير حضور', early: 'انصراف مبكر', errand: 'مأمورية', other: 'أخرى',
}

// ==================== MAIN APP ====================
export default function AttendanceApp() {
  const { toast } = useToast()
  const [employee, setEmployee] = useState<EmployeeData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<TabValue>('attendance')
  const [currentTime, setCurrentTime] = useState(new Date())

  // Login
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')

  // Setup
  const [showSetup, setShowSetup] = useState(false)
  const [setupStep, setSetupStep] = useState(0)
  const [setupForm, setSetupForm] = useState({
    name: '', workStart: '09:00', workEnd: '17:00',
    adminName: '', adminEmail: '', adminPassword: 'admin123',
    branches: [{ name: '', address: '', latitude: '', longitude: '', radius: '200' }]
  })

  // Attendance
  const [todayAttendance, setTodayAttendance] = useState<AttendanceData | null>(null)
  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceData[]>([])
  const [gpsStatus, setGpsStatus] = useState<{ lat: number; lng: number; accuracy: number } | null>(null)
  const [gpsLoading, setGpsLoading] = useState(false)
  const [checkInProgress, setCheckInProgress] = useState(false)

  // Leaves
  const [leaves, setLeaves] = useState<LeaveData[]>([])
  const [showLeaveDialog, setShowLeaveDialog] = useState(false)
  const [leaveForm, setLeaveForm] = useState({ type: 'annual', startDate: '', endDate: '', reason: '' })

  // Permissions
  const [permissions, setPermissions] = useState<PermissionData[]>([])
  const [showPermDialog, setShowPermDialog] = useState(false)
  const [permForm, setPermForm] = useState({ type: 'personal', date: '', timeFrom: '', timeTo: '', reason: '' })

  // Admin
  const [branches, setBranches] = useState<Branch[]>([])
  const [allEmployees, setAllEmployees] = useState<EmployeeList[]>([])
  const [allLeaves, setAllLeaves] = useState<LeaveData[]>([])
  const [allPerms, setAllPerms] = useState<PermissionData[]>([])
  const [approvalSettings, setApprovalSettings] = useState<ApprovalSettingData[]>([])
  const [adminSub, setAdminSub] = useState<'branches' | 'employees' | 'approvals' | 'settings'>('employees')

  // Dialogs
  const [showBranchDialog, setShowBranchDialog] = useState(false)
  const [branchForm, setBranchForm] = useState({ name: '', address: '', latitude: '', longitude: '', radius: '200' })
  const [showEmpDialog, setShowEmpDialog] = useState(false)
  const [editingEmp, setEditingEmp] = useState<EmployeeList | null>(null)
  const [empForm, setEmpForm] = useState({ name: '', email: '', phone: '', position: '', department: '', role: 'employee', password: '123456', branchId: '', managerId: '' })
  const [showApprovalDialog, setShowApprovalDialog] = useState(false)
  const [approvalForm, setApprovalForm] = useState({ category: 'leave', requestType: 'annual', approverId: '' })

  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const getGPS = useCallback((): Promise<{ lat: number; lng: number; accuracy: number }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) { reject(new Error('المتصفح لا يدعم تحديد الموقع')); return }
      setGpsLoading(true)
      navigator.geolocation.getCurrentPosition(
        (pos) => { const l = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }; setGpsStatus(l); setGpsLoading(false); resolve(l) },
        (err) => { setGpsLoading(false); let m = 'فشل في تحديد الموقع'; if (err.code === 1) m = 'تم رفض إذن الموقع'; if (err.code === 2) m = 'GPS غير متاح'; reject(new Error(m)) },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      )
    })
  }, [])

  // Load data
  const loadToday = useCallback(async () => {
    if (!employee) return
    try { const r = await fetch(`/api/attendance/today?employeeId=${employee.id}`); const d = await r.json(); setTodayAttendance(d.attendance || null) } catch {}
  }, [employee])

  const loadHistory = useCallback(async () => {
    if (!employee) return
    try { const r = await fetch(`/api/attendance/history?employeeId=${employee.id}&limit=15`); const d = await r.json(); setAttendanceHistory(d.records || []) } catch {}
  }, [employee])

  const loadLeaves = useCallback(async () => {
    if (!employee) return
    try { const r = await fetch(`/api/leaves?employeeId=${employee.id}`); const d = await r.json(); setLeaves(d.leaves || []) } catch {}
  }, [employee])

  const loadPerms = useCallback(async () => {
    if (!employee) return
    try { const r = await fetch(`/api/permissions?employeeId=${employee.id}`); const d = await r.json(); setPermissions(d.permissions || []) } catch {}
  }, [employee])

  const loadAdmin = useCallback(async () => {
    if (!employee || employee.role !== 'admin') return
    try {
      const [b, e, l, p, s] = await Promise.all([
        fetch(`/api/admin/branches?companyId=${employee.company.id}`).then(r => r.json()),
        fetch(`/api/admin/employees?companyId=${employee.company.id}`).then(r => r.json()),
        fetch(`/api/leaves?companyId=${employee.company.id}`).then(r => r.json()),
        fetch(`/api/permissions?companyId=${employee.company.id}`).then(r => r.json()),
        fetch(`/api/admin/approval-settings?companyId=${employee.company.id}`).then(r => r.json()),
      ])
      setBranches(b.branches || [])
      setAllEmployees(e.employees || [])
      setAllLeaves(l.leaves || [])
      setAllPerms(p.permissions || [])
      setApprovalSettings(s.settings || [])
    } catch {}
  }, [employee])

  useEffect(() => {
    if (employee) { loadToday(); loadHistory(); loadLeaves(); loadPerms(); if (employee.role === 'admin') loadAdmin() }
  }, [employee, loadToday, loadHistory, loadLeaves, loadPerms, loadAdmin])

  useEffect(() => {
    if (!employee) return
    const i = setInterval(() => loadToday(), 30000)
    return () => clearInterval(i)
  }, [employee, loadToday])

  // Auth
  const handleLogin = async () => {
    if (!loginEmail || !loginPassword) { toast({ title: 'خطأ', description: 'أدخل البريد وكلمة المرور', variant: 'destructive' }); return }
    setIsLoading(true)
    try {
      const r = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: loginEmail, password: loginPassword }) })
      const d = await r.json()
      if (!r.ok) { toast({ title: 'خطأ', description: d.error, variant: 'destructive' }); return }
      setEmployee(d.employee)
      toast({ title: 'مرحباً', description: `أهلاً ${d.employee.name}` })
    } catch { toast({ title: 'خطأ', description: 'حدث خطأ في الاتصال', variant: 'destructive' }) }
    finally { setIsLoading(false) }
  }

  const handleSeed = async () => {
    setIsLoading(true)
    try { const r = await fetch('/api/seed'); const d = await r.json(); toast({ title: 'تم', description: d.message }) } catch { toast({ title: 'خطأ', variant: 'destructive' }) }
    finally { setIsLoading(false) }
  }

  // Setup
  const handleSetup = async () => {
    if (!setupForm.name || !setupForm.adminName || !setupForm.adminEmail || !setupForm.branches[0]?.name) {
      toast({ title: 'خطأ', description: 'أكمل جميع البيانات المطلوبة', variant: 'destructive' }); return
    }
    setIsLoading(true)
    try {
      const r = await fetch('/api/company', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(setupForm) })
      const d = await r.json()
      if (!r.ok) { toast({ title: 'خطأ', description: d.error, variant: 'destructive' }); return }
      toast({ title: 'تم بنجاح', description: `تم إنشاء شركة ${setupForm.name}` })
      setShowSetup(false)
      // Auto-login
      setLoginEmail(setupForm.adminEmail)
      setLoginPassword(setupForm.adminPassword)
    } catch { toast({ title: 'خطأ', variant: 'destructive' }) }
    finally { setIsLoading(false) }
  }

  const addSetupBranch = () => setSetupForm(p => ({ ...p, branches: [...p.branches, { name: '', address: '', latitude: '', longitude: '', radius: '200' }] }))
  const removeSetupBranch = (i: number) => setSetupForm(p => ({ ...p, branches: p.branches.filter((_, idx) => idx !== i) }))
  const updateSetupBranch = (i: number, field: string, value: string) => setSetupForm(p => ({ ...p, branches: p.branches.map((b, idx) => idx === i ? { ...b, [field]: value } : b) }))

  // Check in/out
  const handleCheckIn = async () => {
    if (!employee) return; setCheckInProgress(true)
    try {
      const loc = await getGPS()
      const r = await fetch('/api/attendance/check-in', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ employeeId: employee.id, latitude: loc.lat, longitude: loc.lng }) })
      const d = await r.json()
      if (!r.ok) { toast({ title: 'خطأ', description: d.error, variant: 'destructive' }); return }
      toast({ title: 'تم بنجاح', description: d.message }); loadToday(); loadHistory()
    } catch (err: unknown) { toast({ title: 'خطأ في الموقع', description: err instanceof Error ? err.message : 'فشل', variant: 'destructive' }) }
    finally { setCheckInProgress(false) }
  }

  const handleCheckOut = async () => {
    if (!employee) return; setCheckInProgress(true)
    try {
      const loc = await getGPS()
      const r = await fetch('/api/attendance/check-out', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ employeeId: employee.id, latitude: loc.lat, longitude: loc.lng }) })
      const d = await r.json()
      if (!r.ok) { toast({ title: 'خطأ', description: d.error, variant: 'destructive' }); return }
      toast({ title: 'تم بنجاح', description: d.message }); loadToday(); loadHistory()
    } catch (err: unknown) { toast({ title: 'خطأ في الموقع', description: err instanceof Error ? err.message : 'فشل', variant: 'destructive' }) }
    finally { setCheckInProgress(false) }
  }

  // Leave & Permission
  const handleSubmitLeave = async () => {
    if (!employee || !leaveForm.startDate || !leaveForm.endDate || !leaveForm.reason) { toast({ title: 'خطأ', description: 'جميع البيانات مطلوبة', variant: 'destructive' }); return }
    setIsLoading(true)
    try {
      const r = await fetch('/api/leaves', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ employeeId: employee.id, ...leaveForm }) })
      const d = await r.json()
      if (!r.ok) { toast({ title: 'خطأ', description: d.error, variant: 'destructive' }); return }
      toast({ title: 'تم بنجاح', description: d.message }); setShowLeaveDialog(false); setLeaveForm({ type: 'annual', startDate: '', endDate: '', reason: '' }); loadLeaves()
    } catch { toast({ title: 'خطأ', variant: 'destructive' }) }
    finally { setIsLoading(false) }
  }

  const handleSubmitPerm = async () => {
    if (!employee || !permForm.date || !permForm.timeFrom || !permForm.timeTo || !permForm.reason) { toast({ title: 'خطأ', description: 'جميع البيانات مطلوبة', variant: 'destructive' }); return }
    setIsLoading(true)
    try {
      const r = await fetch('/api/permissions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ employeeId: employee.id, ...permForm }) })
      const d = await r.json()
      if (!r.ok) { toast({ title: 'خطأ', description: d.error, variant: 'destructive' }); return }
      toast({ title: 'تم بنجاح', description: d.message }); setShowPermDialog(false); setPermForm({ type: 'personal', date: '', timeFrom: '', timeTo: '', reason: '' }); loadPerms()
    } catch { toast({ title: 'خطأ', variant: 'destructive' }) }
    finally { setIsLoading(false) }
  }

  // Admin: Branch
  const handleAddBranch = async () => {
    if (!employee || !branchForm.name || !branchForm.latitude || !branchForm.longitude) { toast({ title: 'خطأ', description: 'اسم الفرع والإحداثيات مطلوبة', variant: 'destructive' }); return }
    setIsLoading(true)
    try {
      const r = await fetch('/api/admin/branches', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...branchForm, companyId: employee.company.id }) })
      const d = await r.json()
      if (!r.ok) { toast({ title: 'خطأ', description: d.error, variant: 'destructive' }); return }
      toast({ title: 'تم', description: d.message }); setShowBranchDialog(false); setBranchForm({ name: '', address: '', latitude: '', longitude: '', radius: '200' }); loadAdmin()
    } catch { toast({ title: 'خطأ', variant: 'destructive' }) }
    finally { setIsLoading(false) }
  }

  // Admin: Employee Add/Edit
  const openAddEmp = () => { setEditingEmp(null); setEmpForm({ name: '', email: '', phone: '', position: '', department: '', role: 'employee', password: '123456', branchId: branches[0]?.id || '', managerId: '' }); setShowEmpDialog(true) }
  const openEditEmp = (emp: EmployeeList) => {
    setEditingEmp(emp)
    setEmpForm({ name: emp.name, email: emp.email, phone: emp.phone || '', position: emp.position || '', department: emp.department || '', role: emp.role, password: '', branchId: emp.branch?.name ? branches.find(b => b.name === emp.branch?.name)?.id || '' : '', managerId: emp.manager?.id || '' })
    setShowEmpDialog(true)
  }

  const handleSaveEmp = async () => {
    if (!employee || !empForm.name || !empForm.email) { toast({ title: 'خطأ', description: 'الاسم والبريد مطلوبين', variant: 'destructive' }); return }
    if (!editingEmp && !empForm.branchId) { toast({ title: 'خطأ', description: 'الفرع مطلوب', variant: 'destructive' }); return }
    setIsLoading(true)
    try {
      const url = editingEmp ? '/api/admin/employees' : '/api/admin/employees'
      const method = editingEmp ? 'PUT' : 'POST'
      const body = editingEmp
        ? { id: editingEmp.id, ...empForm, companyId: employee.company.id }
        : { ...empForm, companyId: employee.company.id }
      const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const d = await r.json()
      if (!r.ok) { toast({ title: 'خطأ', description: d.error, variant: 'destructive' }); return }
      toast({ title: 'تم', description: d.message }); setShowEmpDialog(false); loadAdmin()
    } catch { toast({ title: 'خطأ', variant: 'destructive' }) }
    finally { setIsLoading(false) }
  }

  // Admin: Approval
  const handleApproval = async (id: string, type: 'approve' | 'reject') => {
    if (!employee) return
    try {
      const r = await fetch('/api/admin/approvals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, type, approvedById: employee.id }) })
      const d = await r.json()
      if (!r.ok) { toast({ title: 'خطأ', description: d.error, variant: 'destructive' }); return }
      toast({ title: 'تم', description: d.message }); loadAdmin()
    } catch { toast({ title: 'خطأ', variant: 'destructive' }) }
  }

  // Admin: Approval Settings
  const handleSaveApprovalSetting = async () => {
    if (!employee || !approvalForm.approverId) { toast({ title: 'خطأ', description: 'اختر المعتمد', variant: 'destructive' }); return }
    setIsLoading(true)
    try {
      const r = await fetch('/api/admin/approval-settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ companyId: employee.company.id, ...approvalForm }) })
      const d = await r.json()
      if (!r.ok) { toast({ title: 'خطأ', description: d.error, variant: 'destructive' }); return }
      toast({ title: 'تم', description: d.message }); setShowApprovalDialog(false); loadAdmin()
    } catch { toast({ title: 'خطأ', variant: 'destructive' }) }
    finally { setIsLoading(false) }
  }

  const handleGetGps = async () => {
    try { const l = await getGPS(); setBranchForm(p => ({ ...p, latitude: l.lat.toString(), longitude: l.lng.toString() })) } catch (err: unknown) { toast({ title: 'خطأ', description: err instanceof Error ? err.message : 'فشل', variant: 'destructive' }) }
  }

  const getWorkingHours = () => {
    if (!todayAttendance?.checkIn) return null
    const ci = new Date(todayAttendance.checkIn); const co = todayAttendance.checkOut ? new Date(todayAttendance.checkOut) : new Date()
    const diff = co.getTime() - ci.getTime()
    return `${Math.floor(diff / 3600000)} ساعة ${Math.floor((diff % 3600000) / 60000)} دقيقة`
  }

  // Get managers/admins list for dropdown
  const managersList = allEmployees.filter(e => e.role === 'admin' || e.role === 'manager')

  // ========= SETUP SCREEN =========
  if (showSetup) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 flex items-center justify-center p-4" dir="rtl">
        <Card className="w-full max-w-md shadow-xl border-0">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center mb-3 shadow-lg">
              <Building2 className="w-8 h-8 text-white" />
            </div>
            <CardTitle className="text-xl font-bold text-emerald-800">تأسيس شركة جديدة</CardTitle>
            <CardDescription>الخطوة {setupStep + 1} من 3</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {setupStep === 0 && (
              <>
                <div className="space-y-2">
                  <Label>اسم الشركة</Label>
                  <Input value={setupForm.name} onChange={e => setSetupForm(p => ({ ...p, name: e.target.value }))} placeholder="مثال: شركة النخبة للأعمال" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>بداية الدوام</Label><Input type="time" value={setupForm.workStart} onChange={e => setSetupForm(p => ({ ...p, workStart: e.target.value }))} /></div>
                  <div className="space-y-2"><Label>نهاية الدوام</Label><Input type="time" value={setupForm.workEnd} onChange={e => setSetupForm(p => ({ ...p, workEnd: e.target.value }))} /></div>
                </div>
                <div className="space-y-2"><Label>اسم مدير النظام</Label><Input value={setupForm.adminName} onChange={e => setSetupForm(p => ({ ...p, adminName: e.target.value }))} placeholder="الاسم الكامل" /></div>
                <div className="space-y-2"><Label>بريد مدير النظام</Label><Input type="email" value={setupForm.adminEmail} onChange={e => setSetupForm(p => ({ ...p, adminEmail: e.target.value }))} placeholder="admin@company.com" /></div>
                <div className="space-y-2"><Label>كلمة مرور المدير</Label><Input value={setupForm.adminPassword} onChange={e => setSetupForm(p => ({ ...p, adminPassword: e.target.value }))} /></div>
              </>
            )}
            {setupStep === 1 && (
              <>
                <p className="text-sm text-muted-foreground mb-2">أضف فروع الشركة (ممكن أكثر من فرع)</p>
                {setupForm.branches.map((b, i) => (
                  <Card key={i} className="border border-emerald-200">
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-emerald-700">فرع {i + 1}</span>
                        {setupForm.branches.length > 1 && <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => removeSetupBranch(i)}><Trash2 className="w-3 h-3" /></Button>}
                      </div>
                      <Input placeholder="اسم الفرع" value={b.name} onChange={e => updateSetupBranch(i, 'name', e.target.value)} />
                      <Input placeholder="العنوان (اختياري)" value={b.address} onChange={e => updateSetupBranch(i, 'address', e.target.value)} />
                      <div className="grid grid-cols-2 gap-2">
                        <Input placeholder="خط العرض" type="number" step="any" value={b.latitude} onChange={e => updateSetupBranch(i, 'latitude', e.target.value)} />
                        <Input placeholder="خط الطول" type="number" step="any" value={b.longitude} onChange={e => updateSetupBranch(i, 'longitude', e.target.value)} />
                      </div>
                      <Input placeholder="النطاق (متر)" type="number" value={b.radius} onChange={e => updateSetupBranch(i, 'radius', e.target.value)} />
                    </CardContent>
                  </Card>
                ))}
                <Button variant="outline" className="w-full border-dashed border-emerald-300 text-emerald-600" onClick={addSetupBranch}>
                  <Plus className="w-4 h-4 ml-1" /> إضافة فرع آخر
                </Button>
              </>
            )}
            {setupStep === 2 && (
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                </div>
                <div>
                  <p className="font-bold text-lg">{setupForm.name}</p>
                  <p className="text-sm text-muted-foreground">{setupForm.branches.length} فرع • مدير: {setupForm.adminName}</p>
                  <p className="text-sm text-muted-foreground">ساعات العمل: {setupForm.workStart} - {setupForm.workEnd}</p>
                </div>
              </div>
            )}
            <div className="flex gap-2">
              {setupStep > 0 && <Button variant="outline" className="flex-1" onClick={() => setSetupStep(s => s - 1)}>السابق</Button>}
              {setupStep < 2 ? (
                <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={() => setSetupStep(s => s + 1)}>التالي</Button>
              ) : (
                <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={handleSetup} disabled={isLoading}>
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'إنشاء الشركة'}
                </Button>
              )}
            </div>
            <Button variant="ghost" className="w-full text-gray-500" onClick={() => setShowSetup(false)}>إلغاء والرجوع</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ========= LOGIN SCREEN =========
  if (!employee) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 flex items-center justify-center p-4" dir="rtl">
        <Card className="w-full max-w-md shadow-xl border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto w-20 h-20 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
              <Fingerprint className="w-10 h-10 text-white" />
            </div>
            <CardTitle className="text-2xl font-bold text-emerald-800">نظام الحضور والانصراف</CardTitle>
            <CardDescription className="text-emerald-600">سجل دخولك لتسجيل البصمة</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>البريد الإلكتروني</Label>
              <Input type="email" placeholder="example@company.com" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()} />
            </div>
            <div className="space-y-2">
              <Label>كلمة المرور</Label>
              <Input type="password" placeholder="••••••" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()} />
            </div>
            <Button onClick={handleLogin} className="w-full bg-gradient-to-l from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white h-12 text-base font-semibold shadow-md" disabled={isLoading}>
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><LogIn className="w-5 h-5 ml-2" />تسجيل الدخول</>}
            </Button>
            <div className="relative my-4"><Separator /><span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-3 text-xs text-muted-foreground">أو</span></div>
            <Button onClick={() => setShowSetup(true)} variant="outline" className="w-full border-emerald-200 text-emerald-700 hover:bg-emerald-50 h-11">
              <Building2 className="w-4 h-4 ml-2" />تأسيس شركة جديدة
            </Button>
            <Button onClick={handleSeed} variant="outline" className="w-full border-gray-200 text-gray-600 hover:bg-gray-50 h-11" disabled={isLoading}>
              <Settings className="w-4 h-4 ml-2" />بيانات تجريبية
            </Button>
            <div className="bg-emerald-50 rounded-xl p-4 mt-4">
              <p className="text-xs font-semibold text-emerald-800 mb-2">بيانات تجريبية:</p>
              <div className="text-xs text-emerald-700 space-y-1">
                <p>مدير: admin@company.com / admin123</p>
                <p>موظف: ahmed@company.com / 123456</p>
                <p>مدير موارد بشرية: fatma@company.com / 123456</p>
                <p>مدير مالية: khaled@company.com / 123456</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ========= MAIN APP =========
  const isCheckedIn = !!todayAttendance?.checkIn
  const isCheckedOut = !!todayAttendance?.checkOut
  const workingHours = getWorkingHours()

  // Get pending requests assigned to current user (for managers)
  const myPendingLeaves = allLeaves.filter(l => l.assignedToId === employee.id && l.status === 'pending')
  const myPendingPerms = allPerms.filter(p => p.assignedToId === employee.id && p.status === 'pending')
  const pendingCount = myPendingLeaves.length + myPendingPerms.length

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col" dir="rtl">
      {/* Header */}
      <header className="bg-gradient-to-l from-emerald-600 to-teal-600 text-white shadow-lg sticky top-0 z-50">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
              <Fingerprint className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-sm">{employee.name}</p>
              <p className="text-xs text-emerald-100">{employee.position || 'موظف'} • {employee.company.name}</p>
              {employee.manager && <p className="text-[10px] text-emerald-200">المدير: {employee.manager.name}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-left">
              <p className="text-xs text-emerald-100">{currentTime.toLocaleDateString('ar-EG', { weekday: 'long' })}</p>
              <p className="text-sm font-mono font-bold">{currentTime.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</p>
            </div>
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 h-9 w-9" onClick={() => { setEmployee(null); setTodayAttendance(null) }}>
              <LogoutIcon className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-4 pb-24">
        {/* ATTENDANCE TAB */}
        {activeTab === 'attendance' && (
          <div className="space-y-4">
            <Card className="shadow-lg border-0 overflow-hidden">
              <div className={`h-2 ${isCheckedOut ? 'bg-gray-400' : isCheckedIn ? 'bg-amber-400' : 'bg-emerald-400'}`} />
              <CardContent className="p-6">
                <div className="text-center mb-6">
                  <div className={`w-28 h-28 mx-auto rounded-full flex items-center justify-center mb-4 transition-all duration-500 ${isCheckedOut ? 'bg-gray-100 ring-4 ring-gray-300' : isCheckedIn ? 'bg-amber-50 ring-4 ring-amber-300 animate-pulse' : 'bg-emerald-50 ring-4 ring-emerald-300'}`}>
                    {isCheckedOut ? <LogOut className="w-12 h-12 text-gray-500" /> : isCheckedIn ? <Timer className="w-12 h-12 text-amber-500" /> : <Fingerprint className="w-12 h-12 text-emerald-500" />}
                  </div>
                  <h2 className="text-xl font-bold">{isCheckedOut ? 'تم الانصراف' : isCheckedIn ? 'جاري العمل' : 'سجل حضورك'}</h2>
                  <p className="text-muted-foreground text-sm mt-1">{isCheckedOut ? 'يوم عمل موفق!' : isCheckedIn ? `مدة العمل: ${workingHours}` : 'اضغط لتسجيل الحضور'}</p>
                </div>

                {(isCheckedIn || isCheckedOut) && todayAttendance && (
                  <div className="grid grid-cols-2 gap-3 mb-5">
                    <div className="bg-emerald-50 rounded-xl p-3 text-center">
                      <p className="text-xs text-emerald-600">الحضور</p>
                      <p className="text-lg font-bold text-emerald-800">{formatTime(todayAttendance.checkIn)}</p>
                      {todayAttendance.checkInDistance && <p className="text-xs text-emerald-500"><Navigation className="w-3 h-3 inline" /> {Math.round(todayAttendance.checkInDistance)}م</p>}
                    </div>
                    <div className={`${isCheckedOut ? 'bg-red-50' : 'bg-gray-50'} rounded-xl p-3 text-center`}>
                      <p className={`text-xs ${isCheckedOut ? 'text-red-600' : 'text-gray-400'}`}>الانصراف</p>
                      <p className={`text-lg font-bold ${isCheckedOut ? 'text-red-800' : 'text-gray-400'}`}>{formatTime(todayAttendance.checkOut)}</p>
                    </div>
                  </div>
                )}

                {gpsStatus && (
                  <div className="flex items-center justify-center gap-2 text-xs text-emerald-600 mb-4 bg-emerald-50 rounded-lg p-2">
                    <MapPin className="w-3 h-3" /><span>الموقع محدد - دقة {Math.round(gpsStatus.accuracy)}م</span>
                  </div>
                )}

                <div className="space-y-3">
                  {!isCheckedIn && <Button onClick={handleCheckIn} disabled={checkInProgress || gpsLoading} className="w-full h-14 text-lg font-bold bg-gradient-to-l from-emerald-600 to-teal-600 shadow-lg" size="lg">
                    {checkInProgress || gpsLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : <><LogIn className="w-6 h-6 ml-2" />تسجيل الحضور</>}
                  </Button>}
                  {isCheckedIn && !isCheckedOut && <Button onClick={handleCheckOut} disabled={checkInProgress || gpsLoading} className="w-full h-14 text-lg font-bold bg-gradient-to-l from-red-500 to-rose-600 shadow-lg" size="lg">
                    {checkInProgress || gpsLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : <><LogOut className="w-6 h-6 ml-2" />تسجيل الانصراف</>}
                  </Button>}
                </div>

                <div className="mt-4 bg-gray-50 rounded-xl p-3 space-y-1">
                  <div className="flex items-center gap-2 text-sm text-gray-600"><Building2 className="w-4 h-4 text-emerald-600" /><span>الفرع: {employee.branch.name}</span></div>
                  <div className="flex items-center gap-2 text-xs text-gray-500"><MapPin className="w-3 h-3" /><span>النطاق: {Math.round(employee.branch.radius)} متر</span></div>
                  <div className="flex items-center gap-2 text-xs text-gray-500"><Clock className="w-3 h-3" /><span>الدوام: {employee.company.workStart} - {employee.company.workEnd}</span></div>
                </div>
              </CardContent>
            </Card>

            {todayAttendance && (
              <Card className="shadow-sm border-0"><CardContent className="p-4"><div className="flex items-center justify-between"><span className="text-sm font-medium">حالة اليوم</span><StatusBadge status={todayAttendance.status} /></div></CardContent></Card>
            )}

            <Card className="shadow-sm border-0">
              <CardHeader className="pb-2 pt-4 px-4"><CardTitle className="text-base font-bold flex items-center gap-2"><FileText className="w-4 h-4 text-emerald-600" />سجل الحضور الأخير</CardTitle></CardHeader>
              <CardContent className="px-4 pb-4">
                <ScrollArea className="max-h-64">
                  {attendanceHistory.length === 0 ? <p className="text-center text-muted-foreground text-sm py-4">لا يوجد سجل بعد</p> : (
                    <div className="space-y-2">
                      {attendanceHistory.map(r => (
                        <div key={r.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                          <div><p className="text-sm font-medium">{formatDateShort(r.workDate)}</p><p className="text-xs text-muted-foreground">{formatTime(r.checkIn)} - {formatTime(r.checkOut)}</p></div>
                          <StatusBadge status={r.status} />
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        )}

        {/* LEAVES TAB */}
        {activeTab === 'leaves' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold flex items-center gap-2"><CalendarDays className="w-5 h-5 text-emerald-600" />طلبات الاجازات</h2>
              <Dialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
                <DialogTrigger asChild><Button className="bg-emerald-600 hover:bg-emerald-700 h-9"><Plus className="w-4 h-4 ml-1" />طلب جديد</Button></DialogTrigger>
                <DialogContent className="max-w-md" dir="rtl">
                  <DialogHeader><DialogTitle className="flex items-center gap-2"><CalendarDays className="w-5 h-5 text-emerald-600" />طلب اجازة جديد</DialogTitle></DialogHeader>
                  <div className="space-y-4 mt-4">
                    <div className="space-y-2"><Label>نوع الاجازة</Label>
                      <Select value={leaveForm.type} onValueChange={v => setLeaveForm(p => ({ ...p, type: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{Object.entries(LEAVE_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2"><Label>من تاريخ</Label><Input type="date" value={leaveForm.startDate} onChange={e => setLeaveForm(p => ({ ...p, startDate: e.target.value }))} /></div>
                      <div className="space-y-2"><Label>إلى تاريخ</Label><Input type="date" value={leaveForm.endDate} onChange={e => setLeaveForm(p => ({ ...p, endDate: e.target.value }))} /></div>
                    </div>
                    <div className="space-y-2"><Label>السبب</Label><Textarea value={leaveForm.reason} onChange={e => setLeaveForm(p => ({ ...p, reason: e.target.value }))} placeholder="سبب الاجازة..." rows={3} /></div>
                  </div>
                  <DialogFooter className="gap-2 mt-4"><DialogClose asChild><Button variant="outline">إلغاء</Button></DialogClose>
                    <Button onClick={handleSubmitLeave} disabled={isLoading} className="bg-emerald-600 hover:bg-emerald-700">{isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'تقديم الطلب'}</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            {leaves.length === 0 ? (
              <Card className="shadow-sm border-0"><CardContent className="p-8 text-center"><CalendarDays className="w-12 h-12 text-gray-300 mx-auto mb-3" /><p className="text-muted-foreground">لا يوجد طلبات اجازات</p></CardContent></Card>
            ) : (
              <div className="space-y-3">
                {leaves.map(l => (
                  <Card key={l.id} className="shadow-sm border-0">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div><p className="font-semibold text-sm">{LEAVE_TYPES[l.type] || l.type}</p><p className="text-xs text-muted-foreground mt-1">{formatDateShort(l.startDate)} - {formatDateShort(l.endDate)}</p></div>
                        <StatusBadge status={l.status} />
                      </div>
                      <p className="text-xs text-gray-500 bg-gray-50 rounded-lg p-2 mt-2">{l.reason}</p>
                      {l.assignedTo && l.status === 'pending' && (
                        <div className="flex items-center gap-1 mt-2 text-xs text-emerald-600"><UserCircle className="w-3 h-3" /><span>موجه إلى: {l.assignedTo.name} {l.assignedTo.position ? `(${l.assignedTo.position})` : ''}</span></div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* PERMISSIONS TAB */}
        {activeTab === 'permissions' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold flex items-center gap-2"><FileCheck className="w-5 h-5 text-emerald-600" />طلبات الأذونات</h2>
              <Dialog open={showPermDialog} onOpenChange={setShowPermDialog}>
                <DialogTrigger asChild><Button className="bg-emerald-600 hover:bg-emerald-700 h-9"><Plus className="w-4 h-4 ml-1" />طلب جديد</Button></DialogTrigger>
                <DialogContent className="max-w-md" dir="rtl">
                  <DialogHeader><DialogTitle className="flex items-center gap-2"><FileCheck className="w-5 h-5 text-emerald-600" />طلب إذن جديد</DialogTitle></DialogHeader>
                  <div className="space-y-4 mt-4">
                    <div className="space-y-2"><Label>نوع الإذن</Label>
                      <Select value={permForm.type} onValueChange={v => setPermForm(p => ({ ...p, type: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{Object.entries(PERM_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2"><Label>التاريخ</Label><Input type="date" value={permForm.date} onChange={e => setPermForm(p => ({ ...p, date: e.target.value }))} /></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2"><Label>من الساعة</Label><Input type="time" value={permForm.timeFrom} onChange={e => setPermForm(p => ({ ...p, timeFrom: e.target.value }))} /></div>
                      <div className="space-y-2"><Label>إلى الساعة</Label><Input type="time" value={permForm.timeTo} onChange={e => setPermForm(p => ({ ...p, timeTo: e.target.value }))} /></div>
                    </div>
                    <div className="space-y-2"><Label>السبب</Label><Textarea value={permForm.reason} onChange={e => setPermForm(p => ({ ...p, reason: e.target.value }))} placeholder="سبب الإذن..." rows={3} /></div>
                  </div>
                  <DialogFooter className="gap-2 mt-4"><DialogClose asChild><Button variant="outline">إلغاء</Button></DialogClose>
                    <Button onClick={handleSubmitPerm} disabled={isLoading} className="bg-emerald-600 hover:bg-emerald-700">{isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'تقديم الطلب'}</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            {permissions.length === 0 ? (
              <Card className="shadow-sm border-0"><CardContent className="p-8 text-center"><FileCheck className="w-12 h-12 text-gray-300 mx-auto mb-3" /><p className="text-muted-foreground">لا يوجد طلبات أذونات</p></CardContent></Card>
            ) : (
              <div className="space-y-3">
                {permissions.map(p => (
                  <Card key={p.id} className="shadow-sm border-0">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div><p className="font-semibold text-sm">{PERM_TYPES[p.type] || p.type}</p><p className="text-xs text-muted-foreground mt-1">{formatDateShort(p.date)} • {p.timeFrom} - {p.timeTo}</p></div>
                        <StatusBadge status={p.status} />
                      </div>
                      <p className="text-xs text-gray-500 bg-gray-50 rounded-lg p-2 mt-2">{p.reason}</p>
                      {p.assignedTo && p.status === 'pending' && (
                        <div className="flex items-center gap-1 mt-2 text-xs text-emerald-600"><UserCircle className="w-3 h-3" /><span>موجه إلى: {p.assignedTo.name}</span></div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ADMIN TAB */}
        {activeTab === 'admin' && employee.role === 'admin' && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold flex items-center gap-2"><Shield className="w-5 h-5 text-emerald-600" />لوحة التحكم - {employee.company.name}</h2>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-2">
              <Card className="shadow-sm border-0 bg-emerald-50"><CardContent className="p-2 text-center"><Building2 className="w-4 h-4 text-emerald-600 mx-auto mb-0.5" /><p className="text-base font-bold text-emerald-800">{branches.length}</p><p className="text-[10px] text-emerald-600">فروع</p></CardContent></Card>
              <Card className="shadow-sm border-0 bg-teal-50"><CardContent className="p-2 text-center"><Users className="w-4 h-4 text-teal-600 mx-auto mb-0.5" /><p className="text-base font-bold text-teal-800">{allEmployees.length}</p><p className="text-[10px] text-teal-600">موظفين</p></CardContent></Card>
              <Card className="shadow-sm border-0 bg-amber-50"><CardContent className="p-2 text-center"><FileText className="w-4 h-4 text-amber-600 mx-auto mb-0.5" /><p className="text-base font-bold text-amber-800">{allLeaves.filter(l => l.status === 'pending').length}</p><p className="text-[10px] text-amber-600">اجازات</p></CardContent></Card>
              <Card className="shadow-sm border-0 bg-rose-50"><CardContent className="p-2 text-center"><FileCheck className="w-4 h-4 text-rose-600 mx-auto mb-0.5" /><p className="text-base font-bold text-rose-800">{allPerms.filter(p => p.status === 'pending').length}</p><p className="text-[10px] text-rose-600">أذونات</p></CardContent></Card>
            </div>

            {/* Admin sub tabs */}
            <div className="flex gap-1 bg-gray-100 rounded-xl p-1 overflow-x-auto">
              {([{ k: 'employees', l: 'الموظفين', ic: Users }, { k: 'branches', l: 'الفروع', ic: Building2 }, { k: 'approvals', l: `الطلبات${pendingCount > 0 ? ` (${pendingCount})` : ''}`, ic: FileText }, { k: 'settings', l: 'الاعتماد', ic: Network }] as const).map(t => (
                <button key={t.k} onClick={() => setAdminSub(t.k as typeof adminSub)} className={`flex items-center gap-1 flex-1 py-2 px-2 rounded-lg text-[11px] font-medium transition-all whitespace-nowrap ${adminSub === t.k ? 'bg-white shadow-sm text-emerald-700' : 'text-gray-500 hover:text-gray-700'}`}>
                  <t.ic className="w-3 h-3" />{t.l}
                </button>
              ))}
            </div>

            {/* EMPLOYEES */}
            {adminSub === 'employees' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">الموظفين ({allEmployees.length})</span>
                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 h-8 text-xs" onClick={openAddEmp}><Plus className="w-3 h-3 ml-1" />موظف جديد</Button>
                </div>
                {allEmployees.map(emp => (
                  <Card key={emp.id} className="shadow-sm border-0">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center"><span className="text-sm font-bold text-emerald-700">{emp.name.charAt(0)}</span></div>
                          <div>
                            <p className="font-semibold text-sm">{emp.name}</p>
                            <p className="text-xs text-muted-foreground">{emp.position || 'موظف'} • {emp.department || '-'}</p>
                            <p className="text-xs text-muted-foreground">{emp.branch?.name || '-'}</p>
                            {emp.manager && <p className="text-[10px] text-emerald-600 flex items-center gap-1 mt-0.5"><UserCircle className="w-3 h-3" />المدير: {emp.manager.name}</p>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {emp.role === 'admin' && <Badge className="bg-emerald-100 text-emerald-700 text-[10px]">مدير</Badge>}
                          {emp.role === 'manager' && <Badge className="bg-teal-100 text-teal-700 text-[10px]">مشرف</Badge>}
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditEmp(emp)}><Pencil className="w-3 h-3 text-gray-500" /></Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* BRANCHES */}
            {adminSub === 'branches' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">الفروع ({branches.length})</span>
                  <Dialog open={showBranchDialog} onOpenChange={setShowBranchDialog}>
                    <DialogTrigger asChild><Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 h-8 text-xs"><Plus className="w-3 h-3 ml-1" />فرع جديد</Button></DialogTrigger>
                    <DialogContent className="max-w-md" dir="rtl">
                      <DialogHeader><DialogTitle>إضافة فرع جديد</DialogTitle></DialogHeader>
                      <div className="space-y-4 mt-4">
                        <div className="space-y-2"><Label>اسم الفرع</Label><Input value={branchForm.name} onChange={e => setBranchForm(p => ({ ...p, name: e.target.value }))} /></div>
                        <div className="space-y-2"><Label>العنوان</Label><Input value={branchForm.address} onChange={e => setBranchForm(p => ({ ...p, address: e.target.value }))} /></div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2"><Label>خط العرض</Label><Input type="number" step="any" value={branchForm.latitude} onChange={e => setBranchForm(p => ({ ...p, latitude: e.target.value }))} /></div>
                          <div className="space-y-2"><Label>خط الطول</Label><Input type="number" step="any" value={branchForm.longitude} onChange={e => setBranchForm(p => ({ ...p, longitude: e.target.value }))} /></div>
                        </div>
                        <Button variant="outline" onClick={handleGetGps} className="w-full" type="button"><MapPin className="w-4 h-4 ml-2" />تحديد الموقع الحالي</Button>
                        <div className="space-y-2"><Label>نطاق البصمة (متر)</Label><Input type="number" value={branchForm.radius} onChange={e => setBranchForm(p => ({ ...p, radius: e.target.value }))} /></div>
                      </div>
                      <DialogFooter className="gap-2 mt-4"><DialogClose asChild><Button variant="outline">إلغاء</Button></DialogClose>
                        <Button onClick={handleAddBranch} disabled={isLoading} className="bg-emerald-600 hover:bg-emerald-700">{isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'إضافة'}</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
                {branches.map(b => (
                  <Card key={b.id} className="shadow-sm border-0">
                    <CardContent className="p-4">
                      <p className="font-semibold text-sm">{b.name}</p>
                      <p className="text-xs text-muted-foreground">{b.address}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-xs text-emerald-600 flex items-center gap-1"><MapPin className="w-3 h-3" />{b.latitude.toFixed(4)}, {b.longitude.toFixed(4)}</span>
                        <span className="text-xs text-gray-500 flex items-center gap-1"><CircleDot className="w-3 h-3" />{Math.round(b.radius)}م</span>
                        <span className="text-xs text-gray-500 flex items-center gap-1"><Users className="w-3 h-3" />{b._count?.employees || 0}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* APPROVALS */}
            {adminSub === 'approvals' && (
              <div className="space-y-4">
                {/* Pending Leaves */}
                <div>
                  <h3 className="text-sm font-bold flex items-center gap-2 mb-3"><CalendarDays className="w-4 h-4 text-amber-500" />اجازات معلقة{allLeaves.filter(l => l.status === 'pending').length > 0 && <Badge className="bg-amber-100 text-amber-800">{allLeaves.filter(l => l.status === 'pending').length}</Badge>}</h3>
                  {allLeaves.filter(l => l.status === 'pending').length === 0 ? <p className="text-xs text-muted-foreground text-center py-3 bg-gray-50 rounded-lg">لا يوجد طلبات معلقة</p> : (
                    <div className="space-y-2">
                      {allLeaves.filter(l => l.status === 'pending').map(l => (
                        <Card key={l.id} className="shadow-sm border-0">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <p className="font-semibold text-sm">{l.employee?.name}</p>
                                <p className="text-xs text-muted-foreground">{LEAVE_TYPES[l.type] || l.type}</p>
                                <p className="text-xs text-muted-foreground">{formatDateShort(l.startDate)} - {formatDateShort(l.endDate)}</p>
                              </div>
                              {l.assignedTo && <Badge className="bg-emerald-50 text-emerald-700 text-[10px] flex items-center gap-1"><UserCircle className="w-3 h-3" />{l.assignedTo.name}</Badge>}
                            </div>
                            <p className="text-xs text-gray-500 bg-gray-50 rounded-lg p-2 mb-3">{l.reason}</p>
                            <div className="flex gap-2">
                              <Button size="sm" className="flex-1 bg-emerald-600 hover:bg-emerald-700 h-8 text-xs" onClick={() => handleApproval(l.id, 'approve')}><CheckCircle2 className="w-3 h-3 ml-1" />اعتماد</Button>
                              <Button size="sm" variant="destructive" className="flex-1 h-8 text-xs" onClick={() => handleApproval(l.id, 'reject')}><XCircle className="w-3 h-3 ml-1" />رفض</Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>

                <Separator />

                {/* Pending Permissions */}
                <div>
                  <h3 className="text-sm font-bold flex items-center gap-2 mb-3"><FileCheck className="w-4 h-4 text-amber-500" />أذونات معلقة{allPerms.filter(p => p.status === 'pending').length > 0 && <Badge className="bg-amber-100 text-amber-800">{allPerms.filter(p => p.status === 'pending').length}</Badge>}</h3>
                  {allPerms.filter(p => p.status === 'pending').length === 0 ? <p className="text-xs text-muted-foreground text-center py-3 bg-gray-50 rounded-lg">لا يوجد طلبات معلقة</p> : (
                    <div className="space-y-2">
                      {allPerms.filter(p => p.status === 'pending').map(p => (
                        <Card key={p.id} className="shadow-sm border-0">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <p className="font-semibold text-sm">{p.employee?.name}</p>
                                <p className="text-xs text-muted-foreground">{PERM_TYPES[p.type] || p.type}</p>
                                <p className="text-xs text-muted-foreground">{formatDateShort(p.date)} • {p.timeFrom}-{p.timeTo}</p>
                              </div>
                              {p.assignedTo && <Badge className="bg-emerald-50 text-emerald-700 text-[10px] flex items-center gap-1"><UserCircle className="w-3 h-3" />{p.assignedTo.name}</Badge>}
                            </div>
                            <p className="text-xs text-gray-500 bg-gray-50 rounded-lg p-2 mb-3">{p.reason}</p>
                            <div className="flex gap-2">
                              <Button size="sm" className="flex-1 bg-emerald-600 hover:bg-emerald-700 h-8 text-xs" onClick={() => handleApproval(p.id, 'approve')}><CheckCircle2 className="w-3 h-3 ml-1" />اعتماد</Button>
                              <Button size="sm" variant="destructive" className="flex-1 h-8 text-xs" onClick={() => handleApproval(p.id, 'reject')}><XCircle className="w-3 h-3 ml-1" />رفض</Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* APPROVAL SETTINGS */}
            {adminSub === 'settings' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold flex items-center gap-2"><Network className="w-4 h-4 text-emerald-600" />إعدادات توجيه الطلبات</h3>
                  <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
                    <DialogTrigger asChild><Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 h-8 text-xs" onClick={() => setApprovalForm({ category: 'leave', requestType: 'annual', approverId: '' })}><Plus className="w-3 h-3 ml-1" />قاعدة جديدة</Button></DialogTrigger>
                    <DialogContent className="max-w-md" dir="rtl">
                      <DialogHeader><DialogTitle>إضافة قاعدة اعتماد</DialogTitle></DialogHeader>
                      <div className="space-y-4 mt-4">
                        <div className="space-y-2"><Label>نوع الطلب</Label>
                          <Select value={approvalForm.category} onValueChange={v => setApprovalForm(p => ({ ...p, category: v, requestType: v === 'leave' ? 'annual' : 'personal' }))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="leave">اجازة</SelectItem><SelectItem value="permission">إذن</SelectItem></SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2"><Label>النوع التفصيلي</Label>
                          <Select value={approvalForm.requestType} onValueChange={v => setApprovalForm(p => ({ ...p, requestType: v }))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {approvalForm.category === 'leave'
                                ? Object.entries(LEAVE_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)
                                : Object.entries(PERM_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)
                              }
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2"><Label>المعتمد المسؤول</Label>
                          <Select value={approvalForm.approverId} onValueChange={v => setApprovalForm(p => ({ ...p, approverId: v }))}>
                            <SelectTrigger><SelectValue placeholder="اختر المعتمد" /></SelectTrigger>
                            <SelectContent>
                              {allEmployees.filter(e => e.role === 'admin' || e.role === 'manager').map(e => (
                                <SelectItem key={e.id} value={e.id}>{e.name} ({e.position || e.role})</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <DialogFooter className="gap-2 mt-4"><DialogClose asChild><Button variant="outline">إلغاء</Button></DialogClose>
                        <Button onClick={handleSaveApprovalSetting} disabled={isLoading} className="bg-emerald-600 hover:bg-emerald-700">{isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'حفظ'}</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>

                <p className="text-xs text-muted-foreground">حدد مين المسؤول عن اعتماد كل نوع طلب. لو محطتش قاعدة، الطلب هيروح للمدير المباشر.</p>

                {/* Leave settings */}
                <div>
                  <h4 className="text-xs font-bold text-emerald-700 mb-2 flex items-center gap-1"><CalendarDays className="w-3 h-3" />اجازات</h4>
                  <div className="space-y-2">
                    {approvalSettings.filter(s => s.category === 'leave').map(s => (
                      <Card key={s.id} className="shadow-sm border-0">
                        <CardContent className="p-3 flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium">{LEAVE_TYPES[s.requestType] || s.requestType}</p>
                            <p className="text-xs text-emerald-600 flex items-center gap-1"><UserCircle className="w-3 h-3" />{s.approver.name} {s.approver.position ? `(${s.approver.position})` : ''}</p>
                          </div>
                          <Badge className="bg-emerald-50 text-emerald-700 text-[10px]">{s.approver.department || ''}</Badge>
                        </CardContent>
                      </Card>
                    ))}
                    {approvalSettings.filter(s => s.category === 'leave').length === 0 && <p className="text-xs text-muted-foreground text-center py-2 bg-gray-50 rounded-lg">لا يوجد قواعد - الطلبات هتروح للمدير المباشر</p>}
                  </div>
                </div>

                {/* Permission settings */}
                <div>
                  <h4 className="text-xs font-bold text-emerald-700 mb-2 flex items-center gap-1"><FileCheck className="w-3 h-3" />أذونات</h4>
                  <div className="space-y-2">
                    {approvalSettings.filter(s => s.category === 'permission').map(s => (
                      <Card key={s.id} className="shadow-sm border-0">
                        <CardContent className="p-3 flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium">{PERM_TYPES[s.requestType] || s.requestType}</p>
                            <p className="text-xs text-emerald-600 flex items-center gap-1"><UserCircle className="w-3 h-3" />{s.approver.name} {s.approver.position ? `(${s.approver.position})` : ''}</p>
                          </div>
                          <Badge className="bg-emerald-50 text-emerald-700 text-[10px]">{s.approver.department || ''}</Badge>
                        </CardContent>
                      </Card>
                    ))}
                    {approvalSettings.filter(s => s.category === 'permission').length === 0 && <p className="text-xs text-muted-foreground text-center py-2 bg-gray-50 rounded-lg">لا يوجد قواعد</p>}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Employee Add/Edit Dialog (outside tabs) */}
      <Dialog open={showEmpDialog} onOpenChange={setShowEmpDialog}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader><DialogTitle>{editingEmp ? 'تعديل بيانات الموظف' : 'إضافة موظف جديد'}</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>الاسم</Label><Input value={empForm.name} onChange={e => setEmpForm(p => ({ ...p, name: e.target.value }))} /></div>
              <div className="space-y-2"><Label>البريد</Label><Input type="email" value={empForm.email} onChange={e => setEmpForm(p => ({ ...p, email: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>الهاتف</Label><Input value={empForm.phone} onChange={e => setEmpForm(p => ({ ...p, phone: e.target.value }))} /></div>
              <div className="space-y-2"><Label>المنصب</Label><Input value={empForm.position} onChange={e => setEmpForm(p => ({ ...p, position: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>القسم</Label><Input value={empForm.department} onChange={e => setEmpForm(p => ({ ...p, department: e.target.value }))} /></div>
              <div className="space-y-2"><Label>الصلاحية</Label>
                <Select value={empForm.role} onValueChange={v => setEmpForm(p => ({ ...p, role: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="employee">موظف</SelectItem><SelectItem value="manager">مشرف</SelectItem><SelectItem value="admin">مدير</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>الفرع</Label>
                <Select value={empForm.branchId} onValueChange={v => setEmpForm(p => ({ ...p, branchId: v }))}>
                  <SelectTrigger><SelectValue placeholder="اختر الفرع" /></SelectTrigger>
                  <SelectContent>{branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>المدير المباشر</Label>
                <Select value={empForm.managerId} onValueChange={v => setEmpForm(p => ({ ...p, managerId: v }))}>
                  <SelectTrigger><SelectValue placeholder="اختر المدير" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">بدون مدير</SelectItem>
                    {managersList.filter(e => e.id !== editingEmp?.id).map(e => <SelectItem key={e.id} value={e.id}>{e.name} ({e.position || e.role})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {!editingEmp && (
              <div className="space-y-2"><Label>كلمة المرور</Label><Input value={empForm.password} onChange={e => setEmpForm(p => ({ ...p, password: e.target.value }))} /></div>
            )}
            {editingEmp && (
              <div className="space-y-2"><Label>كلمة المرور الجديدة (اختياري)</Label><Input type="password" placeholder="اتركها فارغة لو مش عايز تغيرها" value={empForm.password} onChange={e => setEmpForm(p => ({ ...p, password: e.target.value }))} /></div>
            )}
          </div>
          <DialogFooter className="gap-2 mt-4"><DialogClose asChild><Button variant="outline">إلغاء</Button></DialogClose>
            <Button onClick={handleSaveEmp} disabled={isLoading} className="bg-emerald-600 hover:bg-emerald-700">{isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : editingEmp ? 'حفظ التعديلات' : 'إضافة'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
        <div className="max-w-lg mx-auto flex">
          {([
            { v: 'attendance' as TabValue, ic: Fingerprint, l: 'البصمة' },
            { v: 'leaves' as TabValue, ic: CalendarDays, l: 'الاجازات' },
            { v: 'permissions' as TabValue, ic: FileCheck, l: 'الأذونات' },
            ...(employee.role === 'admin' || employee.role === 'manager' ? [{ v: 'admin' as TabValue, ic: Shield, l: 'الإدارة' }] : []),
          ]).map(tab => (
            <button key={tab.v} onClick={() => setActiveTab(tab.v)} className={`flex-1 flex flex-col items-center py-2 px-1 transition-all ${activeTab === tab.v ? 'text-emerald-600' : 'text-gray-400 hover:text-gray-600'}`}>
              <div className="relative">
                <tab.ic className="w-5 h-5" />
                {tab.v === 'admin' && pendingCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full text-[8px] text-white flex items-center justify-center font-bold">{pendingCount}</span>
                )}
              </div>
              <span className="text-[10px] mt-0.5 font-medium">{tab.l}</span>
              {activeTab === tab.v && <div className="w-8 h-0.5 bg-emerald-600 rounded-full mt-1" />}
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}
