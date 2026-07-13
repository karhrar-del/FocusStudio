import React, { useState, useEffect } from 'react'
import { 
  LayoutDashboard, 
  Clock, 
  Users, 
  CloudUpload, 
  CheckCircle2, 
  Zap, 
  ArrowLeft, 
  ClipboardList, 
  Truck, 
  Archive, 
  PlayCircle, 
  Loader2, 
  PlusCircle, 
  AlertCircle,
  FileText,
  Smartphone
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { db } from '../db'
import StatCard from '../components/StatCard'
import { useTheme } from '../context/ThemeContext'

const Dashboard = ({ onNavigate, onResumeList }) => {
  const { theme } = useTheme()
  const isExcel = theme === 'excel'
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState({
    pendingListsCount: 0,
    totalSuppliers: 0,
    pendingUploads: 0,
    todayProgress: 0,
    urgentTasks: []
  })
  const [serverUrl, setServerUrl] = useState('')

  const fetchDashboardData = async () => {
    setLoading(true)
    try {
      // Safe data fetching with fallbacks
      const pendingLists = (db.getLists ? await db.getLists('pending') : []) || []
      const completedLists = (db.getLists ? await db.getLists('completed') : []) || []
      const suppliers = (db.getSuppliers ? await db.getSuppliers() : []) || []
      const stats = (db.getStats ? await db.getStats() : {}) || {}

      const allLists = [...pendingLists, ...completedLists]
      
      // 1. Pending Lists Count
      const pendingListsCount = pendingLists.length

      // 2. Total Suppliers
      const totalSuppliers = suppliers.length

      // 3. Pending Uploads (Photographed but not uploaded)
      const pendingUploads = allLists.reduce((acc, list) => {
        return acc + (list?.rows ? list.rows.filter(r => r?.photographed && !r?.uploaded).length : 0)
      }, 0)

      // 4. Today's Progress (From db.getStats which tracks today's photo count)
      const todayProgress = stats?.newPhotos || 0

      // 5. Urgent Tasks (3 oldest pending lists)
      const urgentTasks = [...(pendingLists || [])]
        .sort((a, b) => new Date(a?.updatedAt || 0) - new Date(b?.updatedAt || 0))
        .slice(0, 6)

      setData({
        pendingListsCount: (pendingLists || []).length,
        totalSuppliers: (suppliers || []).length,
        pendingUploads,
        todayProgress,
        urgentTasks
      })
    } catch (err) {
      console.error("Dashboard Fetch Error:", err)
      // Set safe defaults on error
      setData({
        pendingListsCount: 0,
        totalSuppliers: 0,
        pendingUploads: 0,
        todayProgress: 0,
        urgentTasks: []
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboardData()

    // Fetch server URL for mobile companion
    if (window.api?.getServerUrl) {
      window.api.getServerUrl().then(setServerUrl)
    }

    // Cross-Tab Synchronization
    window.addEventListener('lists-updated', fetchDashboardData)
    
    // Mobile Server Sync (from Main Process)
    if (window.electron?.ipcRenderer) {
      window.electron.ipcRenderer.on('trigger-sync', () => {
        fetchDashboardData()
        window.dispatchEvent(new Event('lists-updated'))
      })
    }

    return () => {
      window.removeEventListener('lists-updated', fetchDashboardData)
    }
  }, [])

  const handleNavigate = (path) => {
    if (typeof onNavigate === 'function') {
      onNavigate(path)
    } else {
      console.warn(`Navigation to ${path} requested but onNavigate is not a function.`)
    }
  }

  const handleResumeList = (task) => {
    if (typeof onResumeList === 'function') {
      onResumeList(task)
    } else {
      console.warn('Resume list requested but onResumeList is not a function.', task)
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-mustard" />
      </div>
    )
  }

  return (
    <div className="flex flex-col space-y-8 animate-in fade-in duration-700" dir="rtl">
      {/* Welcome Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 mb-1">
           <span className="px-3 py-1 bg-olive-dark text-white text-[10px] font-black uppercase tracking-widest rounded-full brand-font">FocusStudio</span>
           <div className="h-[1px] flex-1 bg-gray-200/50"></div>
        </div>
        <h1 className="text-3xl font-black text-olive-dark brand-font tracking-tight">مركز القيادة</h1>
        <p className="text-gray-500 font-medium mt-1">نظرة عامة على حالة سير العمل والمهام المطلوبة.</p>
      </div>

      {/* KPI Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          icon={Clock} 
          label="قوائم قيد الانتظار" 
          value={data.pendingListsCount} 
          colorClass="text-mustard" 
        />
        <StatCard 
          icon={Users} 
          label="إجمالي الموردين" 
          value={data.totalSuppliers} 
          colorClass="text-blue-600" 
        />
        <StatCard 
          icon={CloudUpload} 
          label="نواقص الرفع" 
          value={data.pendingUploads} 
          colorClass="text-orange-600" 
        />
        <StatCard 
          icon={CheckCircle2} 
          label="إنجاز اليوم" 
          value={data.todayProgress} 
          colorClass="text-green-600" 
        />
      </div>

      {/* Main Content Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Urgent Tasks (Right Column) */}
        <div className="lg:col-span-2 flex flex-col space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-lg font-bold text-olive-dark flex items-center gap-2">
              <Zap className="w-5 h-5 text-mustard fill-mustard" />
              المهام العاجلة (العدد الكلي: {data?.pendingListsCount || 0})
            </h3>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">أقدم القوائم</span>
          </div>
          
          <div className={`${isExcel ? 'bg-white border border-gray-300 rounded-md p-4' : 'glass-card flex-1 p-6'} space-y-4`}>
            {(data?.urgentTasks || []).length > 0 ? (
              (data.urgentTasks || []).map((task) => (
                <div key={task?.id || Math.random()} className={`flex items-center justify-between p-4 ${isExcel ? 'bg-gray-50 border border-gray-200 rounded' : 'bg-white/30 border border-white/50 rounded-2xl hover:bg-white/50'} transition-all group`}>
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 ${isExcel ? 'bg-gray-200' : 'bg-mustard/10'} rounded-xl flex items-center justify-center text-mustard group-hover:scale-110 transition-transform`}>
                      <Truck className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-olive-dark">{task?.supplier || task?.title || 'بدون اسم'}</h4>
                      <p className="text-[10px] text-gray-400 font-bold">{task?.updatedAt ? new Date(task.updatedAt).toLocaleDateString('ar-EG', { day: 'numeric', month: 'long' }) : 'تاريخ غير معروف'}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleResumeList(task)}
                    className={`flex items-center gap-2 px-4 py-2 bg-olive-dark text-white text-xs font-bold ${isExcel ? 'rounded' : 'rounded-xl'} hover:bg-black transition-all ${isExcel ? '' : 'shadow-md'} active:scale-95`}
                  >
                    إكمال
                    <ArrowLeft className="w-3 h-3" />
                  </button>
                </div>
              ))
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center py-12 opacity-40">
                <CheckCircle2 className="w-12 h-12 mb-4 text-green-500" />
                <p className="text-sm font-bold">لا توجد مهام عاجلة حالياً</p>
              </div>
            )}

            {(data?.urgentTasks || []).length > 0 && (
              <button 
                onClick={() => handleNavigate('pending')}
                className={`w-full mt-3 py-2 ${isExcel ? 'bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded' : 'bg-olive-dark/5 hover:bg-olive-dark/10 border border-olive-dark/10 rounded-lg'} text-olive-dark text-xs font-bold transition-all flex justify-center items-center gap-2`}
              >
                عرض كل المهام المعلقة
                <ArrowLeft className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Quick Actions (Left Column) */}
        <div className="flex flex-col space-y-4">
          <h3 className="text-lg font-bold text-olive-dark px-2">إجراءات سريعة</h3>
          
          <div className="flex flex-col gap-4">
            <button 
              onClick={() => handleNavigate('checklists')}
              className={`${isExcel ? 'bg-white border border-gray-300 rounded-md p-4' : 'glass-card p-6'} flex flex-col items-center justify-center text-center gap-3 hover:bg-white/60 transition-all group active:scale-95`}
            >
              <div className={`p-4 ${isExcel ? 'bg-gray-100' : 'bg-mustard/10'} rounded-2xl ${isExcel ? 'text-gray-600 group-hover:bg-gray-200' : 'text-mustard group-hover:bg-mustard group-hover:text-white'} transition-all duration-300`}>
                <PlusCircle className="w-8 h-8" />
              </div>
              <div>
                <h4 className="font-bold text-olive-dark">بدء قائمة جديدة</h4>
                <p className="text-[10px] text-gray-400 mt-1">إنشاء قائمة تصوير لمنتجات مورد جديد</p>
              </div>
            </button>

            <button 
              onClick={() => handleNavigate('suppliers')}
              className={`${isExcel ? 'bg-white border border-gray-300 rounded-md p-4' : 'glass-card p-6'} flex flex-col items-center justify-center text-center gap-3 hover:bg-white/60 transition-all group active:scale-95`}
            >
              <div className={`p-4 ${isExcel ? 'bg-gray-100' : 'bg-blue-50'} rounded-2xl ${isExcel ? 'text-gray-600 group-hover:bg-gray-200' : 'text-blue-600 group-hover:bg-blue-600 group-hover:text-white'} transition-all duration-300`}>
                <Users className="w-8 h-8" />
              </div>
              <div>
                <h4 className="font-bold text-olive-dark">إدارة الموردين</h4>
                <p className="text-[10px] text-gray-400 mt-1">تعديل أو إضافة بيانات الموردين</p>
              </div>
            </button>

            <button 
              onClick={() => handleNavigate('completed')}
              className={`${isExcel ? 'bg-white border border-gray-300 rounded-md p-4' : 'glass-card p-6'} flex flex-col items-center justify-center text-center gap-3 hover:bg-white/60 transition-all group active:scale-95`}
            >
              <div className={`p-4 ${isExcel ? 'bg-gray-100' : 'bg-green-50'} rounded-2xl ${isExcel ? 'text-gray-600 group-hover:bg-gray-200' : 'text-green-600 group-hover:bg-green-600 group-hover:text-white'} transition-all duration-300`}>
                <Archive className="w-8 h-8" />
              </div>
              <div>
                <h4 className="font-bold text-olive-dark">الأرشيف</h4>
                <p className="text-[10px] text-gray-400 mt-1">تصفح القوائم التي تم رفعها بنجاح</p>
              </div>
            </button>

            {/* Mobile Connect Card */}
            <div className={`${isExcel ? 'bg-white border border-gray-300 rounded-md p-4' : 'glass-card p-6'} flex flex-col items-center justify-center text-center gap-3 ${isExcel ? '' : 'border-indigo-100 bg-indigo-50/30'}`}>
              <div className={`p-4 ${isExcel ? 'bg-gray-100 text-gray-600' : 'bg-indigo-100 text-indigo-600'} rounded-2xl`}>
                <Smartphone className="w-8 h-8" />
              </div>
              <div>
                <h4 className={`font-bold ${isExcel ? 'text-olive-dark' : 'text-indigo-950'}`}>ربط الهاتف</h4>
                <p className="text-[10px] text-slate-500 mt-1 mb-2">امسح الكود أو ادخل الرابط في المتصفح</p>
                
                {serverUrl && (
                  <div className={`${isExcel ? 'bg-gray-50 p-2' : 'bg-white p-2'} rounded-xl mx-auto mb-3 ${isExcel ? '' : 'shadow-sm'} inline-block`}>
                    <QRCodeSVG value={serverUrl} size={100} />
                  </div>
                )}

                <div className={`${isExcel ? 'bg-white border border-gray-300 px-3 py-1.5 rounded' : 'bg-white/80 px-3 py-1.5 rounded-lg border border-indigo-100'}`}>
                    <code className={`text-[11px] font-black ${isExcel ? 'text-olive-dark' : 'text-indigo-600'} select-all`}>{serverUrl || 'جاري التشغيل...'}</code>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
