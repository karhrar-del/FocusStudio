import React, { useState, useEffect } from 'react'
import { FolderOpen, CheckCircle2, AlertCircle, LayoutDashboard, RefreshCw, Download, RotateCcw } from 'lucide-react'
import { db } from '../db'
import { useTheme } from '../context/ThemeContext'

const Settings = () => {
  const { theme, setTheme } = useTheme()
  const isExcel = theme === 'excel'
  const [rootPath, setRootPath] = useState('')
  const [collectionPath, setCollectionPath] = useState('')
  const [mobilePath, setMobilePath] = useState('')
  const [saved, setSaved] = useState(false)
  const [updateState, setUpdateState] = useState('idle') // idle | checking | downloading | ready | error | uptodate
  const [updateError, setUpdateError] = useState('')
  const [updateVersion, setUpdateVersion] = useState('')

  useEffect(() => {
    const fetchPaths = async () => {
      const rPath = await db.getRootFolder()
      if (rPath) setRootPath(rPath)
      
      const cPath = localStorage.getItem('collectionFolderPath')
      if (cPath) setCollectionPath(cPath)

      const mPath = await window.api.getMobileUploadPath()
      if (mPath) setMobilePath(mPath)
      else {
        const localMPath = localStorage.getItem('mobileUploadPath')
        if (localMPath) setMobilePath(localMPath)
      }
    }
    fetchPaths()
  }, [])

  const handleSelectFolder = async () => {
    const path = await db.selectFolder()
    if (path) {
      await db.setRootFolder(path)
      setRootPath(path)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }
  }

  const handleSelectCollectionFolder = async () => {
    const path = await db.selectFolder()
    if (path) {
      localStorage.setItem('collectionFolderPath', path)
      setCollectionPath(path)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }
  }

  const handleSelectMobilePath = async () => {
    const path = await db.selectFolder()
    if (path) {
      localStorage.setItem('mobileUploadPath', path)
      await window.api.setMobileUploadPath(path)
      setMobilePath(path)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }
  }

  const handleCheckUpdate = async () => {
    setUpdateState('checking')
    setUpdateError('')
    try {
      const res = await fetch('http://localhost:3000/api/check-internal-update', { method: 'POST' })
      const data = await res.json()
      if (data.status === 'uptodate') {
        setUpdateState('uptodate')
        setUpdateVersion(data.version)
      } else if (data.status === 'success') {
        setUpdateState('ready')
        setUpdateVersion(data.version)
      } else {
        setUpdateState('error')
        setUpdateError(data.message || 'حدث خطأ أثناء التحديث')
      }
    } catch (err) {
      setUpdateState('error')
      setUpdateError('فشل الاتصال بالخادم: ' + err.message)
    }
  }

  const handleRestart = () => {
    window.api.restartApp()
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className={`${isExcel ? 'bg-white border border-gray-300 rounded-md p-6' : 'glass-card p-10'}`}>
        <div className="flex items-center gap-4 mb-8">
          <div className={`p-3 ${isExcel ? 'bg-gray-100' : 'bg-mustard/10'} rounded-2xl`}>
            <FolderOpen className={`w-8 h-8 ${isExcel ? 'text-gray-600' : 'text-mustard'}`} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-olive-dark">إعدادات المجلدات</h2>
            <p className="text-gray-500">قم بضبط المسارات الرئيسية لتنظيم الصور وتجميع القوائم.</p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Main Photo Folder */}
          <div className={`p-4 ${isExcel ? 'bg-white border border-gray-200 rounded-md' : 'bg-white/30 border border-white/50 rounded-2xl'}`}>
            <label className="block text-olive-dark font-bold mb-3 text-sm">مجلد الصور الرئيسي (للبحث والاقتراح)</label>
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-4">
                <button
                  onClick={handleSelectFolder}
                  className={`${isExcel ? 'bg-olive-dark text-white px-4 py-2 rounded text-sm font-bold hover:bg-black transition-all' : 'btn-accent whitespace-nowrap min-w-[200px]'}`}
                >
                  اختيار مجلد الصور
                </button>
                <div className={`flex-1 ${isExcel ? 'bg-white border border-gray-300 rounded px-3 py-2' : 'bg-white/50 border border-gray-200 rounded-xl px-4 py-2.5'} text-sm text-gray-600 truncate font-mono`}>
                  {rootPath || 'لم يتم اختيار مجلد بعد...'}
                </div>
              </div>
            </div>
          </div>

          {/* Collection Folder */}
          <div className={`p-4 ${isExcel ? 'bg-white border border-gray-200 rounded-md' : 'bg-white/30 border border-white/50 rounded-2xl'}`}>
            <label className="block text-olive-dark font-bold mb-3 text-sm">مجلد التجميع الرئيسي (لتصدير الصور)</label>
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-4">
                <button
                  onClick={handleSelectCollectionFolder}
                  className={`${isExcel ? 'bg-olive-dark text-white px-4 py-2 rounded text-sm font-bold hover:bg-black transition-all' : 'btn-accent whitespace-nowrap min-w-[200px] bg-olive-dark hover:bg-olive-dark/90'}`}
                >
                  اختيار مجلد التجميع
                </button>
                <div className={`flex-1 ${isExcel ? 'bg-white border border-gray-300 rounded px-3 py-2' : 'bg-white/50 border border-gray-200 rounded-xl px-4 py-2.5'} text-sm text-gray-600 truncate font-mono`}>
                  {collectionPath || 'لم يتم اختيار مجلد التجميع بعد...'}
                </div>
              </div>
              
              {collectionPath ? (
                <div className="flex items-center gap-2 text-green-600 bg-green-50 px-4 py-2 rounded text-sm font-medium w-fit">
                  <CheckCircle2 className="w-4 h-4" />
                  تم تحديد مسار التجميع بنجاح.
                </div>
              ) : (
                <div className="flex items-center gap-2 text-amber-600 bg-amber-50 px-4 py-2 rounded text-sm font-medium w-fit">
                  <AlertCircle className="w-4 h-4" />
                  يرجى اختيار مجلد التجميع لتفعيل ميزة "تجميع الصور".
                </div>
              )}
            </div>
          </div>

          {/* Mobile Uploads Folder */}
          <div className={`p-4 ${isExcel ? 'bg-white border border-gray-200 rounded-md' : 'bg-white/30 border border-white/50 rounded-2xl'}`}>
            <label className="block text-olive-dark font-bold mb-3 text-sm">مسار استلام صور الهاتف (Direct Mobile Upload)</label>
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-4">
                <button
                  onClick={handleSelectMobilePath}
                  className={`${isExcel ? 'bg-olive-dark text-white px-4 py-2 rounded text-sm font-bold hover:bg-black transition-all' : 'btn-accent whitespace-nowrap min-w-[200px] bg-indigo-600 hover:bg-indigo-700'}`}
                >
                  اختيار مسار استلام الصور
                </button>
                <div className={`flex-1 ${isExcel ? 'bg-white border border-gray-300 rounded px-3 py-2' : 'bg-white/50 border border-gray-200 rounded-xl px-4 py-2.5'} text-sm text-gray-600 truncate font-mono`}>
                  {mobilePath || 'لم يتم اختيار مسار استلام الصور بعد...'}
                </div>
              </div>
              
              {mobilePath ? (
                <div className="flex items-center gap-2 text-green-600 bg-green-50 px-4 py-2 rounded text-sm font-medium w-fit">
                  <CheckCircle2 className="w-4 h-4" />
                  تم تحديد مسار استلام صور الهاتف بنجاح.
                </div>
              ) : (
                <div className="flex items-center gap-2 text-amber-600 bg-amber-50 px-4 py-2 rounded text-sm font-medium w-fit">
                  <AlertCircle className="w-4 h-4" />
                  يرجى اختيار مسار استلام الصور لتفعيل ميزة "الرفع المباشر من الهاتف".
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Internal Update Card */}
      <div className={`${isExcel ? 'bg-white border border-gray-300 rounded-md p-6' : 'glass-card p-10'}`}>
        <div className="flex items-center gap-4 mb-6">
          <div className={`p-3 ${isExcel ? 'bg-gray-100' : 'bg-mustard/10'} rounded-2xl`}>
            <Download className={`w-8 h-8 ${isExcel ? 'text-gray-600' : 'text-mustard'}`} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-olive-dark">التحديثات</h2>
            <p className="text-gray-500">تحقق من وجود إصدار جديد للتطبيق وقم بالتحديث داخلياً.</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="text-sm text-gray-500">
            الإصدار الحالي: <span className="font-mono font-bold text-olive-dark">v1.0.0</span>
          </div>

          {updateState === 'idle' && (
            <button
              onClick={handleCheckUpdate}
              className={`${isExcel ? 'bg-olive-dark text-white px-4 py-2 rounded text-sm font-bold hover:bg-black transition-all' : 'btn-accent whitespace-nowrap min-w-[200px] bg-olive-dark hover:bg-olive-dark/90'} flex items-center gap-2`}
            >
              <RefreshCw className="w-4 h-4" />
              التحقق من التحديثات
            </button>
          )}

          {updateState === 'checking' && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-olive-dark font-bold text-sm">
                <RefreshCw className="w-4 h-4 animate-spin" />
                جاري تحميل ملفات النظام الجديدة...
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <div className="bg-olive-dark h-full rounded-full animate-pulse" style={{ width: '60%' }}></div>
              </div>
            </div>
          )}

          {updateState === 'ready' && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-green-600 font-bold text-sm bg-green-50 px-4 py-3 rounded">
                <CheckCircle2 className="w-5 h-5" />
                تم التحديث، جاري إعادة تشغيل البرنامج...
              </div>
              <button
                onClick={handleRestart}
                className={`${isExcel ? 'bg-olive-dark text-white px-4 py-2 rounded text-sm font-bold hover:bg-black transition-all' : 'btn-accent whitespace-nowrap min-w-[200px] bg-olive-dark hover:bg-olive-dark/90'} flex items-center gap-2`}
              >
                <RotateCcw className="w-4 h-4" />
                إعادة تشغيل التطبيق
              </button>
            </div>
          )}

          {updateState === 'uptodate' && (
            <div className="flex items-center gap-3 text-green-600 font-bold text-sm bg-green-50 px-4 py-3 rounded">
              <CheckCircle2 className="w-5 h-5" />
              التطبيق محدث بالفعل (v{updateVersion})
            </div>
          )}

          {updateState === 'error' && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-red-600 font-bold text-sm bg-red-50 px-4 py-3 rounded">
                <AlertCircle className="w-5 h-5" />
                {updateError}
              </div>
              <button
                onClick={handleCheckUpdate}
                className={`${isExcel ? 'bg-olive-dark text-white px-4 py-2 rounded text-sm font-bold hover:bg-black transition-all' : 'btn-accent whitespace-nowrap min-w-[200px] bg-olive-dark hover:bg-olive-dark/90'} flex items-center gap-2`}
              >
                <RefreshCw className="w-4 h-4" />
                إعادة المحاولة
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Theme Selector */}
      <div className={`${isExcel ? 'bg-white border border-gray-300 rounded-md p-6' : 'glass-card p-10'}`}>
        <div className="flex items-center gap-4 mb-6">
          <div className={`p-3 ${isExcel ? 'bg-gray-100' : 'bg-mustard/10'} rounded-2xl`}>
            <LayoutDashboard className={`w-8 h-8 ${isExcel ? 'text-gray-600' : 'text-mustard'}`} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-olive-dark">مظهر التطبيق</h2>
            <p className="text-gray-500">اختر الوضع الذي يناسب سير عملك.</p>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <label className={`flex items-center gap-3 p-4 rounded-xl cursor-pointer transition-all border ${theme === 'glass' ? 'border-mustard bg-mustard/5' : 'border-gray-200 hover:border-gray-300'}`}>
            <input
              type="radio"
              name="theme"
              value="glass"
              checked={theme === 'glass'}
              onChange={() => setTheme('glass')}
              className="accent-mustard w-4 h-4"
            />
            <div>
              <span className="font-bold text-olive-dark text-sm">الوضع الزجاجي (الافتراضي)</span>
              <p className="text-xs text-gray-400 mt-0.5">خلفيات شفافة وتأثيرات ضبابية ولمسات عصرية</p>
            </div>
          </label>

          <label className={`flex items-center gap-3 p-4 rounded-xl cursor-pointer transition-all border ${theme === 'excel' ? 'border-mustard bg-mustard/5' : 'border-gray-200 hover:border-gray-300'}`}>
            <input
              type="radio"
              name="theme"
              value="excel"
              checked={theme === 'excel'}
              onChange={() => setTheme('excel')}
              className="accent-mustard w-4 h-4"
            />
            <div>
              <span className="font-bold text-olive-dark text-sm">وضع الإكسل</span>
              <p className="text-xs text-gray-400 mt-0.5">واجهة مسطحة بحدود رفيعة مثالية لإدخال البيانات</p>
            </div>
          </label>
        </div>
      </div>

      {saved && (
        <div className={`fixed bottom-10 left-1/2 -translate-x-1/2 ${isExcel ? 'bg-olive-dark text-white px-6 py-3 rounded' : 'bg-olive-dark text-white px-8 py-4 rounded-2xl shadow-2xl'} flex items-center gap-4 animate-in fade-in slide-in-from-bottom-8 duration-300`}>
          <CheckCircle2 className="w-5 h-5 text-mustard" />
          <span className="font-bold">تم حفظ الإعدادات بنجاح!</span>
        </div>
      )}
    </div>
  )
}

export default Settings
