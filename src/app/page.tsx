'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Progress } from '@/components/ui/progress'
import { useToast } from '@/hooks/use-toast'
import {
  MapPin, Clock, LogIn, LogOut, CalendarDays, FileCheck, Shield,
  Plus, Users, Building2, CheckCircle2, XCircle, AlertCircle,
  Loader2, Fingerprint, Timer, Sun, Moon, ChevronLeft,
  ArrowRightFromLine, ArrowLeftFromLine, FileText, UserCheck,
  Settings, Bell, LogOut as LogoutIcon, Home, ClipboardList,
  Phone, Mail, Briefcase, Map, Navigation, CircleDot
} from 'lucide-react'

// Types
interface Branch {
  id: string
  name: string
  address?: string
  latitude: number
  longitude: number
  radius: number
  _count?: { employees: number }
}

interface Company {
  id: string
  name: string
  workStart: string
  workEnd: string
  branches: Branch[]
}

interface EmployeeData {
  id: string
  name: string
  email: string
  phone?: string
  position?: string
  department?: string
  role: string
  branch: Branch
  company: Company
}

interface AttendanceData {
  id: string
  checkIn: string | null
  checkOut: string | null
  checkInDistance?: number
  checkOutDistance?: number
  status: string
  workDate: string
  branch: { name: string }
}

interface LeaveData {
  id: string
  type: string
  startDate: string
  endDate: string
  reason: string
  status: string
  approvedBy?: string
  employee?: { name: string; department?: string }
}

interface PermissionData {
  id: string
  type: string
  date: string
  timeFrom: string
  timeTo: string
  reason: string
  status: string
  approvedBy?: string
  employee?: { name: string; department?: string }
}

type TabValue = 'attendance' | 'leaves' | 'permissions' | 'admin'

// Helper: Format time
function formatTime(dateStr: string | null) {
  if (!dateStr) return '--:--'
  const d = new Date(dateStr)
  return d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })
}

function formatDateShort(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' })
}

// Status badge helper
function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; className: string }> = {
    pending: { label: 'قيد المراجعة', variant: 'secondary', className: 'bg-amber-100 text-amber-800 hover:bg-amber-100' },
    approved: { label: 'معتمد', variant: 'default', className: 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100' },
    rejected: { label: 'مرفوض', variant: 'destructive', className: 'bg-red-100 text-red-800 hover:bg-red-100' },
    present: { label: 'حاضر', variant: 'default', className: 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100' },
    late: { label: 'متأخر', variant: 'destructive', className: 'bg-amber-100 text-amber-800 hover:bg-amber-100' },
    absent: { label: 'غائب', variant: 'destructive', className: 'bg-red-100 text-red-800 hover:bg-red-100' },
  }
  const c = config[status] || config.pending
  return <Badge className={c.className}>{c.label}</Badge>
}

// Leave type label
function LeaveTypeLabel({ type }: { type: string }) {
  const labels: Record<string, string> = {
    annual: 'اجازة سنوية',
    sick: 'اجازة مرضية',
    personal: 'اجازة شخصية',
    unpaid: 'اجازة بدون راتب',
    emergency: 'اجازة طارئة',
    maternity: 'اجازة أمومة',
  }
  return <span>{labels[type] || type}</span>
}

// Permission type label
function PermissionTypeLabel({ type }: { type: string }) {
  const labels: Record<string, string> = {
    late: 'تأخير حضور',
    early: 'انصراف مبكر',
    personal: 'إذن شخصي',
    errand: 'مأمورية',
    other: 'أخرى',
  }
  return <span>{labels[type] || type}</span>
}

// ============ MAIN APP ============
export default function AttendanceApp() {
  const { toast } = useToast()
  const [employee, setEmployee] = useState<EmployeeData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<TabValue>('attendance')
  const [currentTime, setCurrentTime] = useState(new Date())

  // Login state
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')

  // Attendance state
  const [todayAttendance, setTodayAttendance] = useState<AttendanceData | null>(null)
  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceData[]>([])
  const [gpsStatus, setGpsStatus] = useState<{ lat: number; lng: number; accuracy: number } | null>(null)
  const [gpsLoading, setGpsLoading] = useState(false)
  const [checkInProgress, setCheckInProgress] = useState(false)

  // Leaves state
  const [leaves, setLeaves] = useState<LeaveData[]>([])
  const [showLeaveDialog, setShowLeaveDialog] = useState(false)
  const [leaveForm, setLeaveForm] = useState({ type: 'annual', startDate: '', endDate: '', reason: '' })

  // Permissions state
  const [permissions, setPermissions] = useState<PermissionData[]>([])
  const [showPermissionDialog, setShowPermissionDialog] = useState(false)
  const [permissionForm, setPermissionForm] = useState({ type: 'personal', date: '', timeFrom: '', timeTo: '', reason: '' })

  // Admin state
  const [branches, setBranches] = useState<Branch[]>([])
  const [allEmployees, setAllEmployees] = useState<EmployeeData[]>([])
  const [allLeaves, setAllLeaves] = useState<LeaveData[]>([])
  const [allPermissions, setAllPermissions] = useState<PermissionData[]>([])
  const [adminSubTab, setAdminSubTab] = useState<'branches' | 'employees' | 'approvals'>('branches')
  const [showBranchDialog, setShowBranchDialog] = useState(false)
  const [branchForm, setBranchForm] = useState({ name: '', address: '', latitude: '', longitude: '', radius: '200' })
  const [showEmployeeDialog, setShowEmployeeDialog] = useState(false)
  const [employeeForm, setEmployeeForm] = useState({ name: '', email: '', phone: '', position: '', department: '', role: 'employee', password: '123456', branchId: '' })

  // Clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Get GPS location
  const getGPSLocation = useCallback((): Promise<{ lat: number; lng: number; accuracy: number }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('المتصفح لا يدعم تحديد الموقع'))
        return
      }
      setGpsLoading(true)
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const loc = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy
          }
          setGpsStatus(loc)
          setGpsLoading(false)
          resolve(loc)
        },
        (error) => {
          setGpsLoading(false)
          let msg = 'فشل في تحديد الموقع'
          if (error.code === 1) msg = 'تم رفض إذن تحديد الموقع. يرجى السماح بالوصول للموقع'
          if (error.code === 2) msg = 'الموقع غير متاح. تأكد من تفعيل GPS'
          if (error.code === 3) msg = 'انتهت مهلة تحديد الموقع. حاول مرة أخرى'
          reject(new Error(msg))
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      )
    })
  }, [])

  // Load data functions
  const loadTodayAttendance = useCallback(async () => {
    if (!employee) return
    try {
      const res = await fetch(`/api/attendance/today?employeeId=${employee.id}`)
      const data = await res.json()
      setTodayAttendance(data.attendance || null)
    } catch { /* ignore */ }
  }, [employee])

  const loadAttendanceHistory = useCallback(async () => {
    if (!employee) return
    try {
      const res = await fetch(`/api/attendance/history?employeeId=${employee.id}&limit=15`)
      const data = await res.json()
      setAttendanceHistory(data.records || [])
    } catch { /* ignore */ }
  }, [employee])

  const loadLeaves = useCallback(async () => {
    if (!employee) return
    try {
      const res = await fetch(`/api/leaves?employeeId=${employee.id}`)
      const data = await res.json()
      setLeaves(data.leaves || [])
    } catch { /* ignore */ }
  }, [employee])

  const loadPermissions = useCallback(async () => {
    if (!employee) return
    try {
      const res = await fetch(`/api/permissions?employeeId=${employee.id}`)
      const data = await res.json()
      setPermissions(data.permissions || [])
    } catch { /* ignore */ }
  }, [employee])

  const loadAdminData = useCallback(async () => {
    if (!employee || employee.role !== 'admin') return
    try {
      const [branchesRes, employeesRes, leavesRes, permissionsRes] = await Promise.all([
        fetch(`/api/admin/branches?companyId=${employee.company.id}`),
        fetch(`/api/admin/employees?companyId=${employee.company.id}`),
        fetch(`/api/leaves?companyId=${employee.company.id}`),
        fetch(`/api/permissions?companyId=${employee.company.id}`),
      ])
      const branchesData = await branchesRes.json()
      const employeesData = await employeesRes.json()
      const leavesData = await leavesRes.json()
      const permissionsData = await permissionsRes.json()
      setBranches(branchesData.branches || [])
      setAllEmployees(employeesData.employees || [])
      setAllLeaves(leavesData.leaves || [])
      setAllPermissions(permissionsData.permissions || [])
    } catch { /* ignore */ }
  }, [employee])

  // Effects
  useEffect(() => {
    if (employee) {
      loadTodayAttendance()
      loadAttendanceHistory()
      loadLeaves()
      loadPermissions()
      if (employee.role === 'admin') loadAdminData()
    }
  }, [employee, loadTodayAttendance, loadAttendanceHistory, loadLeaves, loadPermissions, loadAdminData])

  // Auto-refresh attendance every 30s
  useEffect(() => {
    if (!employee) return
    const interval = setInterval(() => {
      loadTodayAttendance()
    }, 30000)
    return () => clearInterval(interval)
  }, [employee, loadTodayAttendance])

  // Login handler
  const handleLogin = async () => {
    if (!loginEmail || !loginPassword) {
      toast({ title: 'خطأ', description: 'أدخل البريد الإلكتروني وكلمة المرور', variant: 'destructive' })
      return
    }
    setIsLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword })
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: 'خطأ في تسجيل الدخول', description: data.error, variant: 'destructive' })
        return
      }
      setEmployee(data.employee)
      toast({ title: 'مرحباً', description: `أهلاً ${data.employee.name}` })
    } catch {
      toast({ title: 'خطأ', description: 'حدث خطأ في الاتصال', variant: 'destructive' })
    } finally {
      setIsLoading(false)
    }
  }

  // Check in
  const handleCheckIn = async () => {
    if (!employee) return
    setCheckInProgress(true)
    try {
      const loc = await getGPSLocation()
      const res = await fetch('/api/attendance/check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId: employee.id, latitude: loc.lat, longitude: loc.lng })
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: 'خطأ', description: data.error, variant: 'destructive' })
        return
      }
      toast({ title: 'تم بنجاح', description: data.message })
      loadTodayAttendance()
      loadAttendanceHistory()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'فشل في تحديد الموقع'
      toast({ title: 'خطأ في الموقع', description: message, variant: 'destructive' })
    } finally {
      setCheckInProgress(false)
    }
  }

  // Check out
  const handleCheckOut = async () => {
    if (!employee) return
    setCheckInProgress(true)
    try {
      const loc = await getGPSLocation()
      const res = await fetch('/api/attendance/check-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId: employee.id, latitude: loc.lat, longitude: loc.lng })
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: 'خطأ', description: data.error, variant: 'destructive' })
        return
      }
      toast({ title: 'تم بنجاح', description: data.message })
      loadTodayAttendance()
      loadAttendanceHistory()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'فشل في تحديد الموقع'
      toast({ title: 'خطأ في الموقع', description: message, variant: 'destructive' })
    } finally {
      setCheckInProgress(false)
    }
  }

  // Submit leave
  const handleSubmitLeave = async () => {
    if (!employee || !leaveForm.startDate || !leaveForm.endDate || !leaveForm.reason) {
      toast({ title: 'خطأ', description: 'جميع البيانات مطلوبة', variant: 'destructive' })
      return
    }
    setIsLoading(true)
    try {
      const res = await fetch('/api/leaves', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId: employee.id, ...leaveForm })
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: 'خطأ', description: data.error, variant: 'destructive' })
        return
      }
      toast({ title: 'تم بنجاح', description: data.message })
      setShowLeaveDialog(false)
      setLeaveForm({ type: 'annual', startDate: '', endDate: '', reason: '' })
      loadLeaves()
    } catch {
      toast({ title: 'خطأ', description: 'حدث خطأ', variant: 'destructive' })
    } finally {
      setIsLoading(false)
    }
  }

  // Submit permission
  const handleSubmitPermission = async () => {
    if (!employee || !permissionForm.date || !permissionForm.timeFrom || !permissionForm.timeTo || !permissionForm.reason) {
      toast({ title: 'خطأ', description: 'جميع البيانات مطلوبة', variant: 'destructive' })
      return
    }
    setIsLoading(true)
    try {
      const res = await fetch('/api/permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId: employee.id, ...permissionForm })
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: 'خطأ', description: data.error, variant: 'destructive' })
        return
      }
      toast({ title: 'تم بنجاح', description: data.message })
      setShowPermissionDialog(false)
      setPermissionForm({ type: 'personal', date: '', timeFrom: '', timeTo: '', reason: '' })
      loadPermissions()
    } catch {
      toast({ title: 'خطأ', description: 'حدث خطأ', variant: 'destructive' })
    } finally {
      setIsLoading(false)
    }
  }

  // Admin: Add branch
  const handleAddBranch = async () => {
    if (!employee || !branchForm.name || !branchForm.latitude || !branchForm.longitude) {
      toast({ title: 'خطأ', description: 'اسم الفرع والإحداثيات مطلوبة', variant: 'destructive' })
      return
    }
    setIsLoading(true)
    try {
      const res = await fetch('/api/admin/branches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...branchForm, companyId: employee.company.id })
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: 'خطأ', description: data.error, variant: 'destructive' })
        return
      }
      toast({ title: 'تم بنجاح', description: data.message })
      setShowBranchDialog(false)
      setBranchForm({ name: '', address: '', latitude: '', longitude: '', radius: '200' })
      loadAdminData()
    } catch {
      toast({ title: 'خطأ', description: 'حدث خطأ', variant: 'destructive' })
    } finally {
      setIsLoading(false)
    }
  }

  // Admin: Add employee
  const handleAddEmployee = async () => {
    if (!employee || !employeeForm.name || !employeeForm.email || !employeeForm.branchId) {
      toast({ title: 'خطأ', description: 'الاسم والبريد والفرع مطلوبين', variant: 'destructive' })
      return
    }
    setIsLoading(true)
    try {
      const res = await fetch('/api/admin/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...employeeForm, companyId: employee.company.id })
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: 'خطأ', description: data.error, variant: 'destructive' })
        return
      }
      toast({ title: 'تم بنجاح', description: data.message })
      setShowEmployeeDialog(false)
      setEmployeeForm({ name: '', email: '', phone: '', position: '', department: '', role: 'employee', password: '123456', branchId: '' })
      loadAdminData()
    } catch {
      toast({ title: 'خطأ', description: 'حدث خطأ', variant: 'destructive' })
    } finally {
      setIsLoading(false)
    }
  }

  // Admin: Approve/Reject
  const handleApproval = async (id: string, type: 'approve' | 'reject') => {
    if (!employee) return
    try {
      const res = await fetch('/api/admin/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, type, approvedBy: employee.id })
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: 'خطأ', description: data.error, variant: 'destructive' })
        return
      }
      toast({ title: 'تم بنجاح', description: data.message })
      loadAdminData()
    } catch {
      toast({ title: 'خطأ', description: 'حدث خطأ', variant: 'destructive' })
    }
  }

  // Get GPS for branch form
  const handleGetGpsForBranch = async () => {
    try {
      const loc = await getGPSLocation()
      setBranchForm(prev => ({ ...prev, latitude: loc.lat.toString(), longitude: loc.lng.toString() }))
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'فشل في تحديد الموقع'
      toast({ title: 'خطأ', description: message, variant: 'destructive' })
    }
  }

  // Seed database
  const handleSeed = async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/seed')
      const data = await res.json()
      toast({ title: 'تم بنجاح', description: data.message })
    } catch {
      toast({ title: 'خطأ', description: 'حدث خطأ', variant: 'destructive' })
    } finally {
      setIsLoading(false)
    }
  }

  // Calculate working hours
  const getWorkingHours = () => {
    if (!todayAttendance?.checkIn) return null
    const checkIn = new Date(todayAttendance.checkIn)
    const checkOut = todayAttendance.checkOut ? new Date(todayAttendance.checkOut) : new Date()
    const diff = checkOut.getTime() - checkIn.getTime()
    const hours = Math.floor(diff / 3600000)
    const minutes = Math.floor((diff % 3600000) / 60000)
    return `${hours} ساعة ${minutes} دقيقة`
  }

  // =========== LOGIN SCREEN ===========
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
              <Label htmlFor="email" className="text-sm font-medium">البريد الإلكتروني</Label>
              <div className="relative">
                <Mail className="absolute right-3 top-3 h-4 w-4 text-emerald-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="example@company.com"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="pr-10 border-emerald-200 focus:border-emerald-500"
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">كلمة المرور</Label>
              <div className="relative">
                <Shield className="absolute right-3 top-3 h-4 w-4 text-emerald-400" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="pr-10 border-emerald-200 focus:border-emerald-500"
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                />
              </div>
            </div>
            <Button
              onClick={handleLogin}
              className="w-full bg-gradient-to-l from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white h-12 text-base font-semibold shadow-md"
              disabled={isLoading}
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogIn className="w-5 h-5 ml-2" />}
              تسجيل الدخول
            </Button>

            <div className="relative my-4">
              <Separator />
              <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-3 text-xs text-muted-foreground">أو</span>
            </div>

            <Button
              onClick={handleSeed}
              variant="outline"
              className="w-full border-emerald-200 text-emerald-700 hover:bg-emerald-50 h-11"
              disabled={isLoading}
            >
              <Settings className="w-4 h-4 ml-2" />
              تهيئة البيانات التجريبية
            </Button>

            <div className="bg-emerald-50 rounded-xl p-4 mt-4">
              <p className="text-xs font-semibold text-emerald-800 mb-2">بيانات تجريبية للدخول:</p>
              <div className="text-xs text-emerald-700 space-y-1">
                <p>المدير: admin@company.com / admin123</p>
                <p>موظف: ahmed@company.com / 123456</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // =========== MAIN APP ===========
  const isCheckedIn = !!todayAttendance?.checkIn
  const isCheckedOut = !!todayAttendance?.checkOut
  const workingHours = getWorkingHours()

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
              <p className="text-xs text-emerald-100">{employee.position || 'موظف'} • {employee.branch.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-left">
              <p className="text-xs text-emerald-100">{currentTime.toLocaleDateString('ar-EG', { weekday: 'long' })}</p>
              <p className="text-sm font-mono font-bold">{currentTime.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20 h-9 w-9"
              onClick={() => { setEmployee(null); setTodayAttendance(null) }}
            >
              <LogoutIcon className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-4 pb-24">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)} className="w-full">
          {/* ATTENDANCE TAB */}
          <TabsContent value="attendance" className="space-y-4 mt-0">
            {/* Check-in/out Card */}
            <Card className="shadow-lg border-0 overflow-hidden">
              <div className={`h-2 ${isCheckedOut ? 'bg-gray-400' : isCheckedIn ? 'bg-amber-400' : 'bg-emerald-400'}`} />
              <CardContent className="p-6">
                <div className="text-center mb-6">
                  <div className={`w-32 h-32 mx-auto rounded-full flex items-center justify-center mb-4 transition-all duration-500 ${
                    isCheckedOut 
                      ? 'bg-gray-100 ring-4 ring-gray-300' 
                      : isCheckedIn 
                        ? 'bg-amber-50 ring-4 ring-amber-300 animate-pulse' 
                        : 'bg-emerald-50 ring-4 ring-emerald-300'
                  }`}>
                    {isCheckedOut ? (
                      <LogOut className="w-14 h-14 text-gray-500" />
                    ) : isCheckedIn ? (
                      <Timer className="w-14 h-14 text-amber-500" />
                    ) : (
                      <Fingerprint className="w-14 h-14 text-emerald-500" />
                    )}
                  </div>
                  <h2 className="text-xl font-bold">
                    {isCheckedOut ? 'تم الانصراف' : isCheckedIn ? 'جاري العمل' : 'سجل حضورك'}
                  </h2>
                  <p className="text-muted-foreground text-sm mt-1">
                    {isCheckedOut ? 'يوم عمل موفق!' : isCheckedIn ? `مدة العمل: ${workingHours}` : 'اضغط لتسجيل الحضور'}
                  </p>
                </div>

                {/* Status Info */}
                {(isCheckedIn || isCheckedOut) && todayAttendance && (
                  <div className="grid grid-cols-2 gap-3 mb-6">
                    <div className="bg-emerald-50 rounded-xl p-3 text-center">
                      <LogIn className="w-5 h-5 text-emerald-600 mx-auto mb-1" />
                      <p className="text-xs text-emerald-600">وقت الحضور</p>
                      <p className="text-lg font-bold text-emerald-800">{formatTime(todayAttendance.checkIn)}</p>
                      {todayAttendance.checkInDistance && (
                        <p className="text-xs text-emerald-500 mt-1">
                          <Navigation className="w-3 h-3 inline" /> {Math.round(todayAttendance.checkInDistance)}م
                        </p>
                      )}
                    </div>
                    <div className={`${isCheckedOut ? 'bg-red-50' : 'bg-gray-50'} rounded-xl p-3 text-center`}>
                      <LogOut className={`w-5 h-5 ${isCheckedOut ? 'text-red-600' : 'text-gray-400'} mx-auto mb-1`} />
                      <p className={`text-xs ${isCheckedOut ? 'text-red-600' : 'text-gray-400'}`}>وقت الانصراف</p>
                      <p className={`text-lg font-bold ${isCheckedOut ? 'text-red-800' : 'text-gray-400'}`}>
                        {formatTime(todayAttendance.checkOut)}
                      </p>
                      {todayAttendance.checkOutDistance && (
                        <p className="text-xs text-red-500 mt-1">
                          <Navigation className="w-3 h-3 inline" /> {Math.round(todayAttendance.checkOutDistance)}م
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* GPS Status */}
                {gpsStatus && (
                  <div className="flex items-center justify-center gap-2 text-xs text-emerald-600 mb-4 bg-emerald-50 rounded-lg p-2">
                    <MapPin className="w-3 h-3" />
                    <span>الموقع محدد - دقة {Math.round(gpsStatus.accuracy)}م</span>
                  </div>
                )}

                {/* Check-in/Out Buttons */}
                <div className="space-y-3">
                  {!isCheckedIn && (
                    <Button
                      onClick={handleCheckIn}
                      disabled={checkInProgress || gpsLoading}
                      className="w-full h-14 text-lg font-bold bg-gradient-to-l from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-lg"
                      size="lg"
                    >
                      {checkInProgress || gpsLoading ? (
                        <Loader2 className="w-6 h-6 animate-spin" />
                      ) : (
                        <>
                          <LogIn className="w-6 h-6 ml-2" />
                          تسجيل الحضور
                        </>
                      )}
                    </Button>
                  )}
                  {isCheckedIn && !isCheckedOut && (
                    <Button
                      onClick={handleCheckOut}
                      disabled={checkInProgress || gpsLoading}
                      className="w-full h-14 text-lg font-bold bg-gradient-to-l from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 shadow-lg"
                      size="lg"
                    >
                      {checkInProgress || gpsLoading ? (
                        <Loader2 className="w-6 h-6 animate-spin" />
                      ) : (
                        <>
                          <LogOut className="w-6 h-6 ml-2" />
                          تسجيل الانصراف
                        </>
                      )}
                    </Button>
                  )}
                </div>

                {/* Branch Info */}
                <div className="mt-4 bg-gray-50 rounded-xl p-3">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Building2 className="w-4 h-4 text-emerald-600" />
                    <span>الفرع: {employee.branch.name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                    <MapPin className="w-3 h-3" />
                    <span>النطاق المسموح: {Math.round(employee.branch.radius)} متر من موقع الفرع</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                    <Clock className="w-3 h-3" />
                    <span>ساعات العمل: {employee.company.workStart} - {employee.company.workEnd}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Today Status */}
            {todayAttendance && (
              <Card className="shadow-sm border-0">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">حالة اليوم</span>
                    <StatusBadge status={todayAttendance.status} />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Attendance History */}
            <Card className="shadow-sm border-0">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-emerald-600" />
                  سجل الحضور الأخير
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <ScrollArea className="max-h-64">
                  {attendanceHistory.length === 0 ? (
                    <p className="text-center text-muted-foreground text-sm py-4">لا يوجد سجل بعد</p>
                  ) : (
                    <div className="space-y-2">
                      {attendanceHistory.map((record) => (
                        <div key={record.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                          <div>
                            <p className="text-sm font-medium">{formatDateShort(record.workDate)}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatTime(record.checkIn)} - {formatTime(record.checkOut)}
                            </p>
                          </div>
                          <StatusBadge status={record.status} />
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* LEAVES TAB */}
          <TabsContent value="leaves" className="space-y-4 mt-0">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-emerald-600" />
                طلبات الاجازات
              </h2>
              <Dialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
                <DialogTrigger asChild>
                  <Button className="bg-emerald-600 hover:bg-emerald-700 h-9">
                    <Plus className="w-4 h-4 ml-1" />
                    طلب جديد
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md" dir="rtl">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <CalendarDays className="w-5 h-5 text-emerald-600" />
                      طلب اجازة جديد
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label>نوع الاجازة</Label>
                      <Select value={leaveForm.type} onValueChange={(v) => setLeaveForm(p => ({ ...p, type: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="annual">اجازة سنوية</SelectItem>
                          <SelectItem value="sick">اجازة مرضية</SelectItem>
                          <SelectItem value="personal">اجازة شخصية</SelectItem>
                          <SelectItem value="unpaid">اجازة بدون راتب</SelectItem>
                          <SelectItem value="emergency">اجازة طارئة</SelectItem>
                          <SelectItem value="maternity">اجازة أمومة</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>من تاريخ</Label>
                        <Input type="date" value={leaveForm.startDate} onChange={(e) => setLeaveForm(p => ({ ...p, startDate: e.target.value }))} />
                      </div>
                      <div className="space-y-2">
                        <Label>إلى تاريخ</Label>
                        <Input type="date" value={leaveForm.endDate} onChange={(e) => setLeaveForm(p => ({ ...p, endDate: e.target.value }))} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>السبب</Label>
                      <Textarea value={leaveForm.reason} onChange={(e) => setLeaveForm(p => ({ ...p, reason: e.target.value }))} placeholder="اذكر سبب الاجازة..." rows={3} />
                    </div>
                  </div>
                  <DialogFooter className="gap-2 mt-4">
                    <DialogClose asChild>
                      <Button variant="outline">إلغاء</Button>
                    </DialogClose>
                    <Button onClick={handleSubmitLeave} disabled={isLoading} className="bg-emerald-600 hover:bg-emerald-700">
                      {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'تقديم الطلب'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {/* Leaves List */}
            {leaves.length === 0 ? (
              <Card className="shadow-sm border-0">
                <CardContent className="p-8 text-center">
                  <CalendarDays className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-muted-foreground">لا يوجد طلبات اجازات</p>
                  <p className="text-xs text-muted-foreground mt-1">اضغط &quot;طلب جديد&quot; لتقديم طلب اجازة</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {leaves.map((leave) => (
                  <Card key={leave.id} className="shadow-sm border-0">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-semibold text-sm"><LeaveTypeLabel type={leave.type} /></p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDateShort(leave.startDate)} - {formatDateShort(leave.endDate)}
                          </p>
                        </div>
                        <StatusBadge status={leave.status} />
                      </div>
                      <p className="text-xs text-gray-500 bg-gray-50 rounded-lg p-2 mt-2">{leave.reason}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* PERMISSIONS TAB */}
          <TabsContent value="permissions" className="space-y-4 mt-0">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-emerald-600" />
                طلبات الأذونات
              </h2>
              <Dialog open={showPermissionDialog} onOpenChange={setShowPermissionDialog}>
                <DialogTrigger asChild>
                  <Button className="bg-emerald-600 hover:bg-emerald-700 h-9">
                    <Plus className="w-4 h-4 ml-1" />
                    طلب جديد
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md" dir="rtl">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <FileCheck className="w-5 h-5 text-emerald-600" />
                      طلب إذن جديد
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label>نوع الإذن</Label>
                      <Select value={permissionForm.type} onValueChange={(v) => setPermissionForm(p => ({ ...p, type: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="personal">إذن شخصي</SelectItem>
                          <SelectItem value="late">تأخير حضور</SelectItem>
                          <SelectItem value="early">انصراف مبكر</SelectItem>
                          <SelectItem value="errand">مأمورية</SelectItem>
                          <SelectItem value="other">أخرى</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>التاريخ</Label>
                      <Input type="date" value={permissionForm.date} onChange={(e) => setPermissionForm(p => ({ ...p, date: e.target.value }))} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>من الساعة</Label>
                        <Input type="time" value={permissionForm.timeFrom} onChange={(e) => setPermissionForm(p => ({ ...p, timeFrom: e.target.value }))} />
                      </div>
                      <div className="space-y-2">
                        <Label>إلى الساعة</Label>
                        <Input type="time" value={permissionForm.timeTo} onChange={(e) => setPermissionForm(p => ({ ...p, timeTo: e.target.value }))} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>السبب</Label>
                      <Textarea value={permissionForm.reason} onChange={(e) => setPermissionForm(p => ({ ...p, reason: e.target.value }))} placeholder="اذكر سبب الإذن..." rows={3} />
                    </div>
                  </div>
                  <DialogFooter className="gap-2 mt-4">
                    <DialogClose asChild>
                      <Button variant="outline">إلغاء</Button>
                    </DialogClose>
                    <Button onClick={handleSubmitPermission} disabled={isLoading} className="bg-emerald-600 hover:bg-emerald-700">
                      {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'تقديم الطلب'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {/* Permissions List */}
            {permissions.length === 0 ? (
              <Card className="shadow-sm border-0">
                <CardContent className="p-8 text-center">
                  <FileCheck className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-muted-foreground">لا يوجد طلبات أذونات</p>
                  <p className="text-xs text-muted-foreground mt-1">اضغط &quot;طلب جديد&quot; لتقديم طلب إذن</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {permissions.map((perm) => (
                  <Card key={perm.id} className="shadow-sm border-0">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-semibold text-sm"><PermissionTypeLabel type={perm.type} /></p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDateShort(perm.date)} • {perm.timeFrom} - {perm.timeTo}
                          </p>
                        </div>
                        <StatusBadge status={perm.status} />
                      </div>
                      <p className="text-xs text-gray-500 bg-gray-50 rounded-lg p-2 mt-2">{perm.reason}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ADMIN TAB */}
          {employee.role === 'admin' && (
            <TabsContent value="admin" className="space-y-4 mt-0">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Shield className="w-5 h-5 text-emerald-600" />
                لوحة التحكم
              </h2>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3">
                <Card className="shadow-sm border-0 bg-emerald-50">
                  <CardContent className="p-3 text-center">
                    <Building2 className="w-5 h-5 text-emerald-600 mx-auto mb-1" />
                    <p className="text-lg font-bold text-emerald-800">{branches.length}</p>
                    <p className="text-xs text-emerald-600">فروع</p>
                  </CardContent>
                </Card>
                <Card className="shadow-sm border-0 bg-teal-50">
                  <CardContent className="p-3 text-center">
                    <Users className="w-5 h-5 text-teal-600 mx-auto mb-1" />
                    <p className="text-lg font-bold text-teal-800">{allEmployees.length}</p>
                    <p className="text-xs text-teal-600">موظفين</p>
                  </CardContent>
                </Card>
                <Card className="shadow-sm border-0 bg-amber-50">
                  <CardContent className="p-3 text-center">
                    <FileText className="w-5 h-5 text-amber-600 mx-auto mb-1" />
                    <p className="text-lg font-bold text-amber-800">
                      {allLeaves.filter(l => l.status === 'pending').length + allPermissions.filter(p => p.status === 'pending').length}
                    </p>
                    <p className="text-xs text-amber-600">طلبات</p>
                  </CardContent>
                </Card>
              </div>

              {/* Admin Sub Tabs */}
              <div className="flex gap-2 bg-gray-100 rounded-xl p-1">
                {(['branches', 'employees', 'approvals'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setAdminSubTab(tab)}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                      adminSubTab === tab ? 'bg-white shadow-sm text-emerald-700' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {tab === 'branches' ? 'الفروع' : tab === 'employees' ? 'الموظفين' : 'الطلبات'}
                  </button>
                ))}
              </div>

              {/* Branches Section */}
              {adminSubTab === 'branches' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">الفروع ({branches.length})</span>
                    <Dialog open={showBranchDialog} onOpenChange={setShowBranchDialog}>
                      <DialogTrigger asChild>
                        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 h-8 text-xs">
                          <Plus className="w-3 h-3 ml-1" />
                          فرع جديد
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-md" dir="rtl">
                        <DialogHeader>
                          <DialogTitle>إضافة فرع جديد</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 mt-4">
                          <div className="space-y-2">
                            <Label>اسم الفرع</Label>
                            <Input value={branchForm.name} onChange={(e) => setBranchForm(p => ({ ...p, name: e.target.value }))} placeholder="مثال: فرع المعادي" />
                          </div>
                          <div className="space-y-2">
                            <Label>العنوان</Label>
                            <Input value={branchForm.address} onChange={(e) => setBranchForm(p => ({ ...p, address: e.target.value }))} placeholder="العنوان التفصيلي" />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                              <Label>خط العرض</Label>
                              <Input type="number" step="any" value={branchForm.latitude} onChange={(e) => setBranchForm(p => ({ ...p, latitude: e.target.value }))} />
                            </div>
                            <div className="space-y-2">
                              <Label>خط الطول</Label>
                              <Input type="number" step="any" value={branchForm.longitude} onChange={(e) => setBranchForm(p => ({ ...p, longitude: e.target.value }))} />
                            </div>
                          </div>
                          <Button variant="outline" onClick={handleGetGpsForBranch} className="w-full" type="button">
                            <MapPin className="w-4 h-4 ml-2" />
                            تحديد الموقع الحالي تلقائياً
                          </Button>
                          <div className="space-y-2">
                            <Label>نطاق البصمة (متر)</Label>
                            <Input type="number" value={branchForm.radius} onChange={(e) => setBranchForm(p => ({ ...p, radius: e.target.value }))} placeholder="200" />
                          </div>
                        </div>
                        <DialogFooter className="gap-2 mt-4">
                          <DialogClose asChild>
                            <Button variant="outline">إلغاء</Button>
                          </DialogClose>
                          <Button onClick={handleAddBranch} disabled={isLoading} className="bg-emerald-600 hover:bg-emerald-700">
                            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'إضافة الفرع'}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                  {branches.map((branch) => (
                    <Card key={branch.id} className="shadow-sm border-0">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-semibold text-sm">{branch.name}</p>
                            <p className="text-xs text-muted-foreground mt-1">{branch.address}</p>
                            <div className="flex items-center gap-3 mt-2">
                              <span className="text-xs text-emerald-600 flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {branch.latitude.toFixed(4)}, {branch.longitude.toFixed(4)}
                              </span>
                              <span className="text-xs text-gray-500 flex items-center gap-1">
                                <CircleDot className="w-3 h-3" />
                                {Math.round(branch.radius)}م
                              </span>
                              <span className="text-xs text-gray-500 flex items-center gap-1">
                                <Users className="w-3 h-3" />
                                {branch._count?.employees || 0}
                              </span>
                            </div>
                          </div>
                          <Building2 className="w-5 h-5 text-emerald-400" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* Employees Section */}
              {adminSubTab === 'employees' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">الموظفين ({allEmployees.length})</span>
                    <Dialog open={showEmployeeDialog} onOpenChange={setShowEmployeeDialog}>
                      <DialogTrigger asChild>
                        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 h-8 text-xs">
                          <Plus className="w-3 h-3 ml-1" />
                          موظف جديد
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-md" dir="rtl">
                        <DialogHeader>
                          <DialogTitle>إضافة موظف جديد</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 mt-4">
                          <div className="space-y-2">
                            <Label>الاسم الكامل</Label>
                            <Input value={employeeForm.name} onChange={(e) => setEmployeeForm(p => ({ ...p, name: e.target.value }))} placeholder="اسم الموظف" />
                          </div>
                          <div className="space-y-2">
                            <Label>البريد الإلكتروني</Label>
                            <Input type="email" value={employeeForm.email} onChange={(e) => setEmployeeForm(p => ({ ...p, email: e.target.value }))} placeholder="email@company.com" />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                              <Label>الهاتف</Label>
                              <Input value={employeeForm.phone} onChange={(e) => setEmployeeForm(p => ({ ...p, phone: e.target.value }))} placeholder="01xxxxxxxxx" />
                            </div>
                            <div className="space-y-2">
                              <Label>المنصب</Label>
                              <Input value={employeeForm.position} onChange={(e) => setEmployeeForm(p => ({ ...p, position: e.target.value }))} placeholder="المسمى الوظيفي" />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                              <Label>القسم</Label>
                              <Input value={employeeForm.department} onChange={(e) => setEmployeeForm(p => ({ ...p, department: e.target.value }))} placeholder="القسم" />
                            </div>
                            <div className="space-y-2">
                              <Label>الصلاحية</Label>
                              <Select value={employeeForm.role} onValueChange={(v) => setEmployeeForm(p => ({ ...p, role: v }))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="employee">موظف</SelectItem>
                                  <SelectItem value="admin">مدير</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label>الفرع</Label>
                            <Select value={employeeForm.branchId} onValueChange={(v) => setEmployeeForm(p => ({ ...p, branchId: v }))}>
                              <SelectTrigger><SelectValue placeholder="اختر الفرع" /></SelectTrigger>
                              <SelectContent>
                                {branches.map(b => (
                                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>كلمة المرور</Label>
                            <Input type="text" value={employeeForm.password} onChange={(e) => setEmployeeForm(p => ({ ...p, password: e.target.value }))} />
                          </div>
                        </div>
                        <DialogFooter className="gap-2 mt-4">
                          <DialogClose asChild>
                            <Button variant="outline">إلغاء</Button>
                          </DialogClose>
                          <Button onClick={handleAddEmployee} disabled={isLoading} className="bg-emerald-600 hover:bg-emerald-700">
                            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'إضافة الموظف'}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                  {allEmployees.map((emp) => (
                    <Card key={emp.id} className="shadow-sm border-0">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                              <span className="text-sm font-bold text-emerald-700">{emp.name.charAt(0)}</span>
                            </div>
                            <div>
                              <p className="font-semibold text-sm">{emp.name}</p>
                              <p className="text-xs text-muted-foreground">{emp.position || 'موظف'} • {emp.department || '-'}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{emp.branch?.name || '-'}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            {emp.role === 'admin' && (
                              <Badge className="bg-emerald-100 text-emerald-700 text-xs">مدير</Badge>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* Approvals Section */}
              {adminSubTab === 'approvals' && (
                <div className="space-y-4">
                  {/* Pending Leaves */}
                  <div>
                    <h3 className="text-sm font-bold flex items-center gap-2 mb-3">
                      <CalendarDays className="w-4 h-4 text-amber-500" />
                      طلبات الاجازات المعلقة
                      {allLeaves.filter(l => l.status === 'pending').length > 0 && (
                        <Badge className="bg-amber-100 text-amber-800">{allLeaves.filter(l => l.status === 'pending').length}</Badge>
                      )}
                    </h3>
                    {allLeaves.filter(l => l.status === 'pending').length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-3 bg-gray-50 rounded-lg">لا يوجد طلبات معلقة</p>
                    ) : (
                      <div className="space-y-2">
                        {allLeaves.filter(l => l.status === 'pending').map((leave) => (
                          <Card key={leave.id} className="shadow-sm border-0">
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between mb-2">
                                <div>
                                  <p className="font-semibold text-sm">{leave.employee?.name}</p>
                                  <p className="text-xs text-muted-foreground"><LeaveTypeLabel type={leave.type} /></p>
                                  <p className="text-xs text-muted-foreground">
                                    {formatDateShort(leave.startDate)} - {formatDateShort(leave.endDate)}
                                  </p>
                                </div>
                              </div>
                              <p className="text-xs text-gray-500 bg-gray-50 rounded-lg p-2 mb-3">{leave.reason}</p>
                              <div className="flex gap-2">
                                <Button size="sm" className="flex-1 bg-emerald-600 hover:bg-emerald-700 h-8 text-xs" onClick={() => handleApproval(leave.id, 'approve')}>
                                  <CheckCircle2 className="w-3 h-3 ml-1" />
                                  اعتماد
                                </Button>
                                <Button size="sm" variant="destructive" className="flex-1 h-8 text-xs" onClick={() => handleApproval(leave.id, 'reject')}>
                                  <XCircle className="w-3 h-3 ml-1" />
                                  رفض
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Processed Leaves */}
                  {allLeaves.filter(l => l.status !== 'pending').length > 0 && (
                    <div>
                      <h3 className="text-xs font-bold text-muted-foreground mb-2">الطلبات المعالجة</h3>
                      <div className="space-y-2">
                        {allLeaves.filter(l => l.status !== 'pending').map((leave) => (
                          <Card key={leave.id} className="shadow-sm border-0 opacity-70">
                            <CardContent className="p-3">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-xs font-medium">{leave.employee?.name} - <LeaveTypeLabel type={leave.type} /></p>
                                  <p className="text-xs text-muted-foreground">{formatDateShort(leave.startDate)} - {formatDateShort(leave.endDate)}</p>
                                </div>
                                <StatusBadge status={leave.status} />
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}

                  <Separator />

                  {/* Pending Permissions */}
                  <div>
                    <h3 className="text-sm font-bold flex items-center gap-2 mb-3">
                      <FileCheck className="w-4 h-4 text-amber-500" />
                      طلبات الأذونات المعلقة
                      {allPermissions.filter(p => p.status === 'pending').length > 0 && (
                        <Badge className="bg-amber-100 text-amber-800">{allPermissions.filter(p => p.status === 'pending').length}</Badge>
                      )}
                    </h3>
                    {allPermissions.filter(p => p.status === 'pending').length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-3 bg-gray-50 rounded-lg">لا يوجد طلبات معلقة</p>
                    ) : (
                      <div className="space-y-2">
                        {allPermissions.filter(p => p.status === 'pending').map((perm) => (
                          <Card key={perm.id} className="shadow-sm border-0">
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between mb-2">
                                <div>
                                  <p className="font-semibold text-sm">{perm.employee?.name}</p>
                                  <p className="text-xs text-muted-foreground"><PermissionTypeLabel type={perm.type} /></p>
                                  <p className="text-xs text-muted-foreground">
                                    {formatDateShort(perm.date)} • {perm.timeFrom} - {perm.timeTo}
                                  </p>
                                </div>
                              </div>
                              <p className="text-xs text-gray-500 bg-gray-50 rounded-lg p-2 mb-3">{perm.reason}</p>
                              <div className="flex gap-2">
                                <Button size="sm" className="flex-1 bg-emerald-600 hover:bg-emerald-700 h-8 text-xs" onClick={() => handleApproval(perm.id, 'approve')}>
                                  <CheckCircle2 className="w-3 h-3 ml-1" />
                                  اعتماد
                                </Button>
                                <Button size="sm" variant="destructive" className="flex-1 h-8 text-xs" onClick={() => handleApproval(perm.id, 'reject')}>
                                  <XCircle className="w-3 h-3 ml-1" />
                                  رفض
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Processed Permissions */}
                  {allPermissions.filter(p => p.status !== 'pending').length > 0 && (
                    <div>
                      <h3 className="text-xs font-bold text-muted-foreground mb-2">الطلبات المعالجة</h3>
                      <div className="space-y-2">
                        {allPermissions.filter(p => p.status !== 'pending').map((perm) => (
                          <Card key={perm.id} className="shadow-sm border-0 opacity-70">
                            <CardContent className="p-3">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-xs font-medium">{perm.employee?.name} - <PermissionTypeLabel type={perm.type} /></p>
                                  <p className="text-xs text-muted-foreground">{formatDateShort(perm.date)} • {perm.timeFrom}-{perm.timeTo}</p>
                                </div>
                                <StatusBadge status={perm.status} />
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>
          )}
        </Tabs>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
        <div className="max-w-lg mx-auto flex">
          {[
            { value: 'attendance' as TabValue, icon: Fingerprint, label: 'البصمة' },
            { value: 'leaves' as TabValue, icon: CalendarDays, label: 'الاجازات' },
            { value: 'permissions' as TabValue, icon: FileCheck, label: 'الأذونات' },
            ...(employee.role === 'admin' ? [{ value: 'admin' as TabValue, icon: Shield, label: 'الإدارة' }] : []),
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`flex-1 flex flex-col items-center py-2 px-1 transition-all ${
                activeTab === tab.value
                  ? 'text-emerald-600'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <tab.icon className={`w-5 h-5 ${activeTab === tab.value ? 'text-emerald-600' : ''}`} />
              <span className="text-[10px] mt-0.5 font-medium">{tab.label}</span>
              {activeTab === tab.value && (
                <div className="w-8 h-0.5 bg-emerald-600 rounded-full mt-1" />
              )}
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}
