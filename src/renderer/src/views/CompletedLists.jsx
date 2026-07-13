import React, { useState, useEffect } from 'react'
import { CheckCircle2, Calendar, Trash2, Eye, Tag, MapPin, Factory, X, Square, Send, Save, Search, Smartphone, Image } from 'lucide-react'
import { db } from '../db'
import { useTheme } from '../context/ThemeContext'

const getSafeDate = (dateStr) => {
   if (!dateStr) return null;
   try {
       const d = new Date(dateStr);
       return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
   } catch(e) { return null; }
}

const CompletedLists = () => {
  const { theme } = useTheme()
  const isExcel = theme === 'excel'
  const [lists, setLists] = useState([])
  const [selectedList, setSelectedList] = useState(null)
  const [editableRows, setEditableRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0])
  const [searchQuery, setSearchQuery] = useState('')
  const [rootPath, setRootPath] = useState('')

  const fetchLists = async () => {
    setLoading(true)
    const data = await db.getLists('completed')
    setLists((data || []).sort((a, b) => new Date(b?.updatedAt || 0) - new Date(a?.updatedAt || 0)))
    setLoading(false)
  }

  useEffect(() => {
    fetchLists()
    
    const fetchRoot = async () => {
      const path = await db.getRootFolder()
      if (path) setRootPath(path)
    }
    fetchRoot()

    // Cross-Tab Synchronization
    const handleSync = () => fetchLists()
    window.addEventListener('lists-updated', handleSync)
    return () => window.removeEventListener('lists-updated', handleSync)
  }, [])

  // Initialize editable rows when a list is selected
  useEffect(() => {
    if (selectedList) {
      setEditableRows(selectedList.rows || [])
    }
  }, [selectedList])

  const handleToggleStatus = (idx, type) => {
    const newRows = [...editableRows]
    newRows[idx] = { ...newRows[idx], [type]: !newRows[idx][type] }
    setEditableRows(newRows)
  }

  const handleViewImage = async (imageName) => {
    if (!imageName || !selectedList?.country) {
      alert('المعلومات غير كافية لفتح الصورة')
      return
    }

    const row = editableRows.find(r => r.value === imageName)
    const factory = row?.factory || selectedList.factory

    // Primary path (for speed)
    const primaryPath = (factory && factory !== 'الكل') 
      ? `${rootPath}\\${selectedList.country}\\${factory}\\${imageName}.jpg`
      : null

    const result = await window.api.openExternalImage({
      fullPath: primaryPath,
      country: selectedList.country,
      imageName
    })

    if (!result?.success) {
      alert('الصورة غير موجودة في أي من مجلدات هذا البلد')
    }
  }

  const handleSaveChanges = async () => {
    try {
        // Update global product stats before saving the list
        for (const row of editableRows) {
            if (row.value) {
                await db.toggleStatus(row.value, row.mobileCaptured, row.photographed, row.uploaded);
            }
        }

        const updatedList = { ...selectedList, rows: editableRows, updatedAt: new Date().toISOString() }
        await db.saveList(updatedList)
        window.dispatchEvent(new Event('lists-updated'))
        setSelectedList(null)
    } catch (err) {
        console.error("Save error:", err)
    }
  }

  const handleDelete = async (id, e) => {
    e.stopPropagation()
    if (confirm('هل أنت متأكد من حذف هذه القائمة؟')) {
      await db.deleteList(id)
      fetchLists()
    }
  }

  if (loading) return <div className="flex h-64 items-center justify-center text-gray-500 font-bold">جاري التحميل...</div>

  return (
    <div className="flex flex-col h-full space-y-6 animate-in fade-in duration-500 bg-gray-50">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
          <CheckCircle2 className="w-8 h-8 text-green-500" />
          القوائم المكتملة
        </h2>

        <div className="flex items-center gap-4">
            {!selectedList && (
              <div className="flex items-center gap-3">
                {/* Search Bar */}
                <div className="relative group">
                    <input 
                        type="text" 
                        placeholder="بحث عن قائمة/معمل..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') setFilterDate('')
                        }}
                        className={`${isExcel ? 'bg-white border border-gray-300 rounded px-3 py-1.5 h-9' : 'bg-gray-100 border border-transparent rounded-xl px-9 py-1.5 h-9'} text-xs font-bold text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all w-48`}
                    />
                    <Search className={`absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 group-focus-within:text-indigo-500 transition-colors ${isExcel ? 'right-2' : ''}`} />
                    {searchQuery && (
                        <button 
                            onClick={() => setSearchQuery('')}
                            className="absolute left-2 top-1/2 -translate-y-1/2 p-0.5"
                        >
                            <X className="w-3 h-3 text-gray-300 hover:text-gray-500" />
                        </button>
                    )}
                </div>

                {/* Date Filter */}
                <div className="flex items-center gap-2 group relative">
                    <input 
                        type="date" 
                        value={filterDate || ''}
                        onChange={(e) => setFilterDate(e.target.value)}
                        className={`${isExcel ? 'bg-white border border-gray-300 rounded px-3 py-1.5 h-9' : 'bg-gray-100 border border-transparent rounded-xl px-3 py-1.5 h-9'} text-xs font-bold text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all appearance-none cursor-pointer`}
                    />
                    {filterDate && (
                        <button 
                            onClick={() => setFilterDate('')}
                            className="absolute left-2 top-1/2 -translate-y-1/2 p-0.5 bg-gray-200 hover:bg-gray-300 text-gray-500 rounded-lg transition-all"
                        >
                            <X className="w-3 h-3" />
                        </button>
                    )}
                </div>
              </div>
            )}

            <span className={`text-sm font-bold bg-green-50 text-green-700 px-4 py-1.5 h-9 flex items-center ${isExcel ? 'rounded border border-green-200' : 'rounded-xl border border-green-100 shadow-sm'}`}>
              {(lists || []).filter(l => {
                const matchesDate = !filterDate || filterDate === '' || (l?.listDate ? l.listDate === filterDate : getSafeDate(l?.updatedAt) === filterDate);
                const matchesSearch = !searchQuery || 
                  (l?.supplier?.toLowerCase() || '').includes(searchQuery.toLowerCase()) || 
                  (l?.factory?.toLowerCase() || '').includes(searchQuery.toLowerCase()) || 
                  (l?.title?.toLowerCase() || '').includes(searchQuery.toLowerCase());
                return matchesDate && matchesSearch;
              }).length} قائمة منشورة
            </span>
      </div>
    </div>

    {selectedList ? (
        <div className={`${isExcel ? 'bg-white border border-gray-300 rounded-md' : 'bg-white shadow-sm rounded-2xl'} flex-1 flex flex-col overflow-hidden animate-in zoom-in-95 duration-300`}>
          <div className="p-3 px-6 border-b border-gray-200">
            <div className="flex items-center justify-between w-full">
              {/* Right Side: Title, Back, and Metadata */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 border-l border-gray-100 pe-4">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <h3 className="text-sm font-bold text-gray-900">{selectedList?.supplier || selectedList?.factory || selectedList?.title || 'بدون اسم'}</h3>
                </div>

                <button 
                  onClick={() => setSelectedList(null)}
                  className={`${isExcel ? 'bg-gray-100 text-gray-600 py-1 px-3 rounded text-[10px] font-bold hover:bg-gray-200' : 'bg-gray-100 text-gray-600 py-1 px-3 rounded-xl text-[10px] font-bold hover:bg-gray-200 transition-all flex items-center gap-1.5 shadow-sm'} flex items-center gap-1.5 transition-all`}
                >
                  <X className="w-3 h-3" />
                  رجوع
                </button>

                <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-tight">
                  <span className={`flex items-center gap-1 ${isExcel ? 'bg-gray-50 px-2 py-0.5 rounded border border-gray-200' : 'bg-gray-50 px-2 py-0.5 rounded-lg border border-gray-100'}`}>
                    <MapPin className="w-2.5 h-2.5 text-gray-300"/> {selectedList?.country || 'غير محدد'}
                  </span>
                  <span className={`flex items-center gap-1 ${isExcel ? 'bg-gray-50 px-2 py-0.5 rounded border border-gray-200' : 'bg-gray-50 px-2 py-0.5 rounded-lg border border-gray-100'}`}>
                    <Factory className="w-2.5 h-2.5 text-gray-300"/> {selectedList?.factory || 'غير محدد'}
                  </span>
                  {selectedList?.supplier && (
                    <span className={`flex items-center gap-1 ${isExcel ? 'bg-gray-50 px-2 py-0.5 rounded border border-gray-200' : 'bg-gray-50 px-2 py-0.5 rounded-lg border border-gray-100'}`}>
                      <Tag className="w-2.5 h-2.5 text-gray-300"/> {selectedList?.supplier}
                    </span>
                  )}
                </div>
              </div>

              {/* Left Side: Date and Save button */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-[10px] font-bold">
                  <span className="text-gray-400 uppercase">تاريخ النشر:</span>
                  <span className="font-mono text-gray-500">
                    {selectedList?.listDate ? new Date(selectedList.listDate).toLocaleDateString('ar-EG') : (selectedList?.updatedAt ? new Date(selectedList.updatedAt).toLocaleDateString('ar-EG') : 'غير محدد')}
                  </span>
                </div>

                <button 
                  onClick={handleSaveChanges}
                  className={`${isExcel ? 'bg-olive-dark text-white py-1 px-4 rounded text-[10px] font-bold hover:bg-black' : 'bg-indigo-600 text-white py-1 px-4 rounded-xl text-[10px] font-bold hover:bg-indigo-700 shadow-sm'} transition-all flex items-center gap-1.5`}
                >
                  <Save className="w-3 h-3" />
                  حفظ التعديلات
                </button>
              </div>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6 space-y-2 custom-scrollbar">
            {(editableRows || []).map((row, idx) => (
              <div key={idx} className={`flex items-center gap-4 p-3 ${isExcel ? 'bg-white border border-gray-200 rounded hover:border-gray-400' : 'bg-white border border-gray-100 rounded-xl hover:border-indigo-200'} transition-all group/row`}>
                <span className="text-[11px] font-mono text-gray-300 w-5">{idx + 1}</span>
                <span className="flex-1 text-sm font-bold text-gray-900">{row.value}</span>
                
                <div className="flex items-center gap-2">
                  {/* View Image Button */}
                  {row.value && (
                    <button
                      onClick={() => handleViewImage(row.value)}
                      className={`p-1.5 text-gray-400 ${isExcel ? 'hover:text-olive-dark hover:bg-gray-100 rounded' : 'hover:text-indigo-500 hover:bg-indigo-50 rounded-lg'} transition-all`}
                      title="عرض في ويندوز"
                    >
                      <Image className="w-4 h-4" />
                    </button>
                  )}

                    {/* Mobile Captured Toggle */}
                    <button
                        onClick={() => handleToggleStatus(idx, 'mobileCaptured')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 ${isExcel ? 'rounded text-[10px]' : 'rounded-lg text-[10px]'} font-bold transition-all border ${
                            row.mobileCaptured 
                                ? 'bg-indigo-50 text-indigo-600 border-indigo-100' 
                                : 'bg-gray-100 text-gray-400 border-gray-200'
                        }`}
                    >
                        {row.mobileCaptured ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Smartphone className="w-3.5 h-3.5" />}
                        هاتف
                    </button>

                    {/* Photographed Toggle */}
                    <button
                        onClick={() => handleToggleStatus(idx, 'photographed')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 ${isExcel ? 'rounded text-[10px]' : 'rounded-lg text-[10px]'} font-bold transition-all border ${
                            row.photographed 
                                ? 'bg-green-50 text-green-600 border-green-100' 
                                : 'bg-gray-100 text-gray-400 border-gray-200'
                        }`}
                    >
                        {row.photographed ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                        تصوير
                    </button>

                    {/* Uploaded Toggle */}
                    <button
                        onClick={() => handleToggleStatus(idx, 'uploaded')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 ${isExcel ? 'rounded text-[10px]' : 'rounded-lg text-[10px]'} font-bold transition-all border ${
                            row.uploaded 
                                ? 'bg-amber-50 text-amber-600 border-amber-100' 
                                : 'bg-gray-100 text-gray-400 border-gray-200'
                        }`}
                    >
                        {row.uploaded ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                        رفع
                    </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className={`${isExcel ? 'bg-white border border-gray-300 rounded-md' : 'bg-white shadow-sm rounded-2xl'} overflow-hidden w-full overflow-y-auto max-h-[calc(100vh-220px)] custom-scrollbar`}>
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className={`${isExcel ? 'bg-gray-100 border-b border-gray-300' : 'bg-gray-50'}`}>
                <th className={`p-4 text-gray-500 font-bold border-b ${isExcel ? 'border-gray-300' : 'border-gray-100'} text-[11px] uppercase tracking-wider`}>اسم القائمة</th>
                <th className={`p-4 text-gray-500 font-bold border-b ${isExcel ? 'border-gray-300' : 'border-gray-100'} text-[11px] uppercase tracking-wider`}>التاريخ</th>
                <th className={`p-4 text-gray-500 font-bold border-b ${isExcel ? 'border-gray-300' : 'border-gray-100'} text-[11px] uppercase tracking-wider`}>عدد السجلات</th>
                <th className={`p-4 text-gray-500 font-bold border-b ${isExcel ? 'border-gray-300' : 'border-gray-100'} text-[11px] uppercase tracking-wider`}>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {(lists || [])
                .filter(list => {
                  const matchesDate = !filterDate || filterDate === '' || (list?.listDate ? list.listDate === filterDate : getSafeDate(list?.updatedAt) === filterDate);
                  const matchesSearch = !searchQuery || 
                    (list?.supplier?.toLowerCase() || '').includes(searchQuery.toLowerCase()) || 
                    (list?.factory?.toLowerCase() || '').includes(searchQuery.toLowerCase()) || 
                    (list?.title?.toLowerCase() || '').includes(searchQuery.toLowerCase());
                  return matchesDate && matchesSearch;
                })
                .map(list => (
                <tr key={list?.id || Math.random()} className={`hover:bg-gray-50 transition-colors duration-200 border-b ${isExcel ? 'border-gray-300' : 'border-gray-100'} last:border-0 group`}>
                  <td className="p-4 text-gray-900 font-bold">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 bg-green-50 flex items-center justify-center text-green-500 ${isExcel ? 'rounded border border-green-200' : 'rounded-xl shadow-sm border border-green-100'}`}>
                        <Tag className="w-4 h-4" />
                      </div>
                      <span className="whitespace-normal break-words max-w-xs">{list?.supplier || list?.title || list?.factory || 'بدون اسم'}</span>
                    </div>
                  </td>
                  <td className="p-4 text-gray-500 text-sm font-bold">
                    {list?.listDate ? new Date(list.listDate).toLocaleDateString('ar-EG') : (list?.updatedAt ? new Date(list.updatedAt).toLocaleDateString('ar-EG') : 'غير محدد')}
                  </td>
                  <td className="p-4 text-gray-500 text-sm font-bold">
                    {list?.rows?.length || 0} سجل
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => setSelectedList(list)}
                        className={`flex items-center gap-2 ${isExcel ? 'bg-white hover:bg-gray-100 text-olive-dark px-4 py-1.5 rounded text-xs font-bold border border-gray-300' : 'bg-white hover:bg-indigo-50 text-indigo-600 px-4 py-1.5 rounded-xl text-xs font-bold border border-gray-200 shadow-sm'} transition-all`}
                      >
                        <Eye className="w-3.5 h-3.5" />
                        عرض التفاصيل
                      </button>
                      <button 
                        onClick={(e) => handleDelete(list?.id, e)}
                        className={`p-1.5 text-gray-300 hover:text-red-500 ${isExcel ? 'hover:bg-red-50 rounded' : 'hover:bg-red-50 rounded-lg'} transition-all`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default CompletedLists
