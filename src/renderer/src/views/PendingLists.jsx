import React, { useState, useEffect, useRef } from 'react'
import { Clock, Calendar, Trash2, Play, MapPin, Factory, AlertCircle, X, Search, CheckCircle2, Square, Smartphone, Save, Loader2, MousePointer2, Eye, ChevronDown, Download, Send, Image } from 'lucide-react'
import { db } from '../db'
import { useTheme } from '../context/ThemeContext'

const getSafeDate = (dateStr) => {
   if (!dateStr) return null;
   try {
       const d = new Date(dateStr);
       return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
   } catch(e) { return null; }
}

const PendingLists = ({ onResume }) => {
  const { theme } = useTheme()
  const isExcel = theme === 'excel'
  const [lists, setLists] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0])
  const [searchQuery, setSearchQuery] = useState('')
  
  // Detailed View State
  const [selectedList, setSelectedList] = useState(null)
  const [editableRows, setEditableRows] = useState([])
  const [isSaving, setIsSaving] = useState(false)
  
  // Autocomplete State
  const [activeRowId, setActiveRowId] = useState(null)
  const [suggestions, setSuggestions] = useState([])
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const [factoryItems, setFactoryItems] = useState([])
  
  // Split Dropdown State
  const [showDropdown, setShowDropdown] = useState(false)
  const [isCollecting, setIsCollecting] = useState(false)
  const [rootPath, setRootPath] = useState('')
  const debounceRef = useRef(null)

  const fetchLists = async () => {
    setLoading(true)
    const data = await db.getLists('pending')
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

  const handleDelete = async (id, e) => {
    e.stopPropagation()
    if (confirm('هل أنت متأكد من حذف هذه القائمة المعلقة؟')) {
      await db.deleteList(id)
      fetchLists()
    }
  }

  const openDetailedView = async (list) => {
    setSelectedList(list)
    setEditableRows(list?.rows || [])
    
    // Pre-fetch factory items for autocomplete — country-only deep search
    if (list.country) {
      const items = await db.listImages(list.country, list.factory || 'الكل')
      setFactoryItems(items)
    }
  }

  const closeDetailedView = () => {
    setSelectedList(null)
    setEditableRows([])
    setSuggestions([])
    setActiveRowId(null)
  }

  const handleInputChange = (id, val) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    setEditableRows(prev => prev.map(row => 
      row.id === id ? { ...row, value: val } : row
    ))
    
    // Filter suggestions
    const filtered = factoryItems.filter(item => 
      (item?.name?.toLowerCase() || '').includes(val?.toLowerCase() || '')
    )
    setSuggestions(filtered)
    setHighlightedIndex(-1)

    if (val) {
      debounceRef.current = setTimeout(async () => {
        try {
          const stats = await db.processList([val])
          if (stats && stats[0]) {
            setEditableRows(prev => prev.map(row => 
              row.id === id ? { 
                ...row, 
                mobileCaptured: stats[0].mobileCaptured, 
                photographed: stats[0].photographed, 
                uploaded: stats[0].uploaded 
              } : row
            ))
          }
        } catch (err) {
          console.error("Global State Fetch Error:", err)
        }
      }, 300)
    }
  }

  const selectSuggestion = async (id, val) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    
    try {
      const stats = await db.processList([val.name])
      const isMobileCaptured = stats[0]?.mobileCaptured || false
      const isPhotographed = stats[0]?.photographed || false
      const isUploaded = stats[0]?.uploaded || false

      setEditableRows(prev => prev.map(row => 
        row.id === id ? { 
          ...row, 
          value: val.name, 
          factory: val.factory,
          mobileCaptured: isMobileCaptured,
          photographed: isPhotographed,
          uploaded: isUploaded
        } : row
      ))
      setSuggestions([])
      setActiveRowId(null)
      setHighlightedIndex(-1)
    } catch (err) {
      console.error("Select Suggestion Error:", err)
    }
  }

  const handleToggleStatus = (id, type) => {
    setEditableRows(prev => prev.map(row => 
      row.id === id ? { ...row, [type]: !row[type] } : row
    ))
  }

  const handleSaveChanges = async () => {
    if (!selectedList) return
    setIsSaving(true)
    try {
      const updatedList = {
        ...selectedList,
        rows: editableRows,
        updatedAt: new Date().toISOString()
      }
      
      // Update individual product stats in DB
      for (const row of editableRows) {
        if (row.value) {
          await db.toggleStatus(row.value, row.mobileCaptured, row.photographed, row.uploaded)
        }
      }
      
      await db.saveList(updatedList)
      window.dispatchEvent(new Event('lists-updated'))
      setIsSaving(false)
      closeDetailedView()
      fetchLists()
    } catch (err) {
      console.error("Save Changes Error:", err)
      setIsSaving(false)
      alert('فشل حفظ التغييرات')
    }
  }

  const handleKeyDown = (e, id) => {
    if (e.key === 'Enter' && highlightedIndex >= 0 && suggestions[highlightedIndex]) {
      e.preventDefault()
      selectSuggestion(id, suggestions[highlightedIndex])
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIndex(prev => (prev > 0 ? prev - 1 : 0))
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : prev))
    } else if (e.key === 'Escape') {
      setSuggestions([])
      setActiveRowId(null)
    }
  }

  const handleViewImage = async (imageName) => {
    if (!imageName || !rootPath || !selectedList?.country) {
      alert('المعلومات غير كافية لفتح الصورة')
      return
    }

    const extensions = ['.jpg', '.jpeg', '.png', '.webp']
    const row = editableRows.find(r => r.value === imageName)
    const factory = row?.factory || selectedList.factory
    
    const baseDir = factory === 'الكل' 
      ? `${rootPath}\\${selectedList.country}`
      : `${rootPath}\\${selectedList.country}\\${factory}`
    
    for (const ext of extensions) {
      const fullPath = `${baseDir}\\${imageName}${ext}`
      const result = await window.api.openExternalImage({
        fullPath,
        country: selectedList.country,
        imageName
      })
      if (result?.success) return
      if (result?.error && result.error !== 'File not found') {
        alert(`خطأ: ${result.error}`)
        return
      }
    }
    
    alert('الصورة غير موجودة في المسار المحدد')
  }

  const handleCollectImages = async () => {
    if (!selectedList) return
    
    // 1. Check if collection folder is configured in localStorage
    const collectionFolder = localStorage.getItem('collectionFolderPath')
    if (!collectionFolder) {
      alert('يرجى ضبط "مجلد التجميع الرئيسي" في الإعدادات أولاً.')
      return
    }

    setIsCollecting(true)
    setShowDropdown(false)

    try {
      const result = await window.api.collectImagesProcess({
        listName: selectedList.supplier || selectedList.title || selectedList.factory,
        country: selectedList.country,
        factory: selectedList.factory,
        products: editableRows
      })

      if (result.success > 0) {
        alert(`تم تجميع ${result.success} صورة بنجاح في:\n${result.path}`)
      } else {
        alert('لم يتم العثور على صور لتجميعها.')
      }
    } catch (err) {
      console.error("Collection Error:", err)
      alert('حدث خطأ أثناء تجميع الصور.')
    } finally {
      setIsCollecting(false)
    }
  }

  const handlePublish = async () => {
    if (!selectedList) return
    setIsSaving(true)
    setShowDropdown(false)
    try {
      const updatedList = {
        ...selectedList,
        rows: editableRows,
        status: 'completed',
        updatedAt: new Date().toISOString()
      }
      
      // Update individual product stats in DB
      for (const row of editableRows) {
        if (row.value) {
          await db.toggleStatus(row.value, row.mobileCaptured, row.photographed, row.uploaded)
        }
      }
      
      await db.saveList(updatedList)
      window.dispatchEvent(new Event('lists-updated'))
      setIsSaving(false)
      closeDetailedView()
      fetchLists()
    } catch (err) {
      console.error("Publish Error:", err)
      setIsSaving(false)
      alert('فشل نشر القائمة')
    }
  }

  if (loading) return <div className="flex h-64 items-center justify-center text-gray-500 font-bold">جاري التحميل...</div>

  return (
    <>
      <div className="flex flex-col h-full space-y-6 animate-in fade-in duration-500 bg-gray-50">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
          <Clock className="w-8 h-8 text-amber-500" />
          القوائم غير المكتملة
        </h2>
        
        <div className="flex items-center gap-4">
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

            <span className={`text-sm font-bold bg-amber-50 text-amber-700 px-4 py-1.5 h-9 flex items-center ${isExcel ? 'rounded border border-amber-200' : 'rounded-xl border border-amber-100 shadow-sm'}`}>
              {(lists || []).filter(l => {
                const matchesDate = !filterDate || filterDate === '' || (l?.listDate ? l.listDate === filterDate : getSafeDate(l?.updatedAt) === filterDate);
                const matchesSearch = !searchQuery || 
                  (l?.supplier?.toLowerCase() || '').includes(searchQuery.toLowerCase()) || 
                  (l?.factory?.toLowerCase() || '').includes(searchQuery.toLowerCase()) || 
                  (l?.title?.toLowerCase() || '').includes(searchQuery.toLowerCase());
                return matchesDate && matchesSearch;
              }).length} قائمة معلقة
            </span>
        </div>
      </div>

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
                    <div className={`w-8 h-8 bg-amber-50 flex items-center justify-center text-amber-500 ${isExcel ? 'rounded border border-amber-200' : 'rounded-xl shadow-sm border border-amber-100'}`}>
                      <Clock className="w-4 h-4" />
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
                      onClick={() => onResume && onResume(list)}
                      className={`flex items-center gap-2 ${isExcel ? 'bg-olive-dark hover:bg-black text-white px-4 py-1.5 rounded text-xs font-bold active:scale-95' : 'bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-xl text-xs font-bold shadow-sm active:scale-95'} transition-all`}
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      استكمال
                    </button>
                    <button 
                      onClick={() => openDetailedView(list)}
                      className={`flex items-center gap-2 ${isExcel ? 'bg-white hover:bg-gray-100 text-olive-dark px-4 py-1.5 rounded text-xs font-bold border border-gray-300' : 'bg-white hover:bg-gray-50 text-gray-600 px-4 py-1.5 rounded-xl text-xs font-bold border border-gray-200 shadow-sm'} transition-all`}
                    >
                      <Eye className="w-3.5 h-3.5" />
                      التفاصيل
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
    </div>

      {/* Detailed View Overlay */}
      {selectedList && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-300">
          <div className="absolute inset-0 bg-black/40" onClick={closeDetailedView}></div>
          
          <div className={`${isExcel ? 'bg-white border border-gray-300 rounded-md' : 'bg-white shadow-sm rounded-2xl'} w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden relative z-10`}>
            {/* Header */}
            <div className={`p-4 border-b ${isExcel ? 'border-gray-300' : 'border-gray-200'} flex items-center justify-between`}>
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 ${isExcel ? 'bg-amber-500 text-white rounded flex items-center justify-center' : 'bg-amber-500 text-white rounded-2xl flex items-center justify-center shadow-sm'}`}>
                  <Clock className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{selectedList?.supplier || selectedList?.title || 'بدون اسم'}</h3>
                  <div className="flex items-center gap-4 mt-1">
                    <span className="text-[10px] font-bold text-gray-400 uppercase flex items-center gap-1">
                      <MapPin className="w-3 h-3"/> {selectedList?.country || 'غير محدد'}
                    </span>
                    <span className="text-[10px] font-bold text-gray-400 uppercase flex items-center gap-1">
                      <Factory className="w-3 h-3"/> {selectedList?.factory || 'الكل'}
                    </span>
                  </div>
                </div>
              </div>
              <button 
                onClick={closeDetailedView}
                className="p-2 hover:bg-gray-100 rounded-xl transition-all text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Content - Scrollable Rows */}
            <div className={`flex-1 overflow-y-auto ${isExcel ? 'p-4' : 'p-6'} space-y-2 custom-scrollbar`}>
              <div className="flex items-center justify-between mb-4 px-2">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">محتويات القائمة - تعديل مباشر</span>
                <span className={`text-[10px] font-bold bg-amber-50 text-amber-600 px-2 py-0.5 ${isExcel ? 'rounded' : 'rounded-full'}`}>{(editableRows || []).length} سجل</span>
              </div>

              {(editableRows || []).map((row) => (
                <div key={row.id} className="relative group">
                  <div className={`flex items-center gap-3 p-2 ${isExcel ? 'bg-white hover:bg-gray-50 rounded border border-gray-200' : 'bg-white hover:bg-gray-50 rounded-xl border border-gray-100'} transition-all`}>
                    <div className="flex-1 relative">
                      <input 
                        type="text"
                        value={row.value}
                        onChange={(e) => handleInputChange(row.id, e.target.value)}
                        onFocus={() => {
                          setActiveRowId(row.id)
                          handleInputChange(row.id, row.value)
                        }}
                        onKeyDown={(e) => handleKeyDown(e, row.id)}
                        className="w-full bg-gray-100 border border-transparent rounded-lg px-2 py-1.5 text-sm font-bold text-gray-900 focus:outline-none focus:bg-white focus:border-gray-300"
                        placeholder="اسم المنتج..."
                      />

                      {/* Autocomplete Suggestions */}
                      {activeRowId === row?.id && (suggestions || []).length > 0 && (
                        <div className={`absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 ${isExcel ? 'rounded shadow-lg' : 'rounded-xl shadow-lg'} z-50 max-h-40 overflow-y-auto border-t ${isExcel ? 'border-t-gray-400' : 'border-t-indigo-500 border-t-2'}`}>
                          {(suggestions || []).map((s, i) => (
                            <button
                              key={(s?.name || '') + (s?.factory || i)}
                              onClick={() => selectSuggestion(row.id, s)}
                              className={`w-full text-right px-4 py-2 text-xs font-bold border-b border-gray-50 last:border-0 flex items-center justify-between ${highlightedIndex === i ? (isExcel ? 'bg-gray-100 text-olive-dark' : 'bg-indigo-50 text-indigo-600') : 'hover:bg-gray-50 text-gray-600'}`}
                            >
                              <div className="flex flex-col items-start">
                                <span>{s?.name || ''}</span>
                                {(!selectedList?.factory || selectedList?.factory === 'الكل') && <span className="text-[8px] text-gray-400 font-normal">معمل: {s?.factory || 'غير محدد'}</span>}
                              </div>
                              <MousePointer2 className={`w-3.5 h-3.5 ${highlightedIndex === i ? 'opacity-100' : 'opacity-0'} ${isExcel ? 'text-olive-dark' : 'text-indigo-500'}`} />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

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

                      {/* Mobile Capture */}
                      {!row.photographed && (
                        <button
                          onClick={() => handleToggleStatus(row.id, 'mobileCaptured')}
                          className={`flex items-center gap-1.5 px-3 py-1.5 ${isExcel ? 'rounded text-[10px]' : 'rounded-lg text-[10px]'} font-bold transition-all border ${
                            row.mobileCaptured 
                              ? 'bg-indigo-50 text-indigo-600 border-indigo-100' 
                              : 'bg-gray-100 text-gray-400 border-gray-200'
                          }`}
                        >
                          <Smartphone className="w-3 h-3" />
                          هاتف
                        </button>
                      )}

                      {/* Photographed */}
                      <button
                        onClick={() => handleToggleStatus(row.id, 'photographed')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 ${isExcel ? 'rounded text-[10px]' : 'rounded-lg text-[10px]'} font-bold transition-all border ${
                          row.photographed 
                            ? 'bg-green-50 text-green-600 border-green-100' 
                            : 'bg-gray-100 text-gray-400 border-gray-200'
                        }`}
                      >
                        {row.photographed ? <CheckCircle2 className="w-3 h-3" /> : <Square className="w-3 h-3" />}
                        تصوير
                      </button>

                      {/* Uploaded */}
                      <button
                        onClick={() => handleToggleStatus(row.id, 'uploaded')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 ${isExcel ? 'rounded text-[10px]' : 'rounded-lg text-[10px]'} font-bold transition-all border ${
                          row.uploaded 
                            ? 'bg-amber-50 text-amber-600 border-amber-100' 
                            : 'bg-gray-100 text-gray-400 border-gray-200'
                        }`}
                      >
                        {row.uploaded ? <CheckCircle2 className="w-3 h-3" /> : <Square className="w-3 h-3" />}
                        رفع
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer Actions */}
            <div className={`p-4 border-t ${isExcel ? 'border-gray-300 bg-gray-50' : 'border-gray-200 bg-gray-50'} flex items-center justify-between`}>
              <button 
                onClick={closeDetailedView}
                className="px-6 py-2 text-gray-500 font-bold text-sm hover:text-gray-700 transition-all"
              >
                إغلاق
              </button>

              <div className="flex items-center gap-3">
                <button 
                  onClick={handleSaveChanges}
                  disabled={isSaving || isCollecting}
                  className={`flex items-center gap-2 ${isExcel ? 'bg-white text-gray-700 border border-gray-300 px-6 py-2 rounded text-sm font-bold hover:bg-gray-50 active:scale-95 disabled:opacity-50' : 'bg-white text-gray-700 border border-gray-200 px-6 py-2 rounded-xl text-sm font-bold hover:bg-gray-50 shadow-sm active:scale-95 disabled:opacity-50'} transition-all`}
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  حفظ التغييرات
                </button>
                
                {/* Split Dropdown Action Button */}
                <div className="relative flex items-center group">
                    <button 
                        onClick={handlePublish}
                        disabled={isSaving || isCollecting}
                        className={`flex items-center gap-2 ${isExcel ? 'bg-olive-dark text-white px-6 py-2 rounded-r text-sm font-bold hover:bg-black active:scale-95 disabled:opacity-50' : 'bg-indigo-600 text-white px-6 py-2 rounded-r-xl text-sm font-bold hover:bg-indigo-700 shadow-sm active:scale-95 disabled:opacity-50'} transition-all`}
                    >
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        نشر القائمة
                    </button>
                    <button 
                        onClick={() => setShowDropdown(!showDropdown)}
                        disabled={isSaving || isCollecting}
                        className={`${isExcel ? 'bg-olive-dark text-white px-2 rounded-l hover:bg-black h-[36px]' : 'bg-indigo-600 text-white px-2 rounded-l-xl hover:bg-indigo-700 h-[36px]'} transition-all flex items-center justify-center disabled:opacity-50`}
                    >
                        <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${showDropdown ? 'rotate-180' : ''}`} />
                    </button>

                    {showDropdown && (
                        <div className={`absolute bottom-full mb-2 left-0 right-0 bg-white border border-gray-200 ${isExcel ? 'rounded shadow-lg' : 'rounded-xl shadow-lg'} animate-in fade-in slide-in-from-bottom-2 duration-200 z-[60] min-w-[160px]`}>
                            <button 
                                onClick={handleCollectImages}
                                disabled={isCollecting}
                                className="w-full text-right px-4 py-3 text-sm font-bold text-gray-700 hover:bg-amber-50 hover:text-amber-600 flex items-center gap-3 transition-colors border-b border-gray-50 last:border-0"
                            >
                                {isCollecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                                تجميع (Collection)
                            </button>
                            <button 
                                onClick={handlePublish}
                                className="w-full text-right px-4 py-3 text-sm font-bold text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 flex items-center gap-3 transition-colors"
                            >
                                <Send className="w-4 h-4" />
                                نشر القائمة
                            </button>
                        </div>
                    )}
                </div>

                <button 
                  onClick={() => {
                    onResume && onResume(selectedList)
                    closeDetailedView()
                  }}
                  disabled={isSaving || isCollecting}
                  className={`flex items-center gap-2 bg-amber-500 text-white px-6 py-2 ${isExcel ? 'rounded text-sm' : 'rounded-xl text-sm'} font-bold hover:bg-amber-600 transition-all ${isExcel ? '' : 'shadow-sm'} active:scale-95 disabled:opacity-50`}
                >
                  <Play className="w-4 h-4 fill-current" />
                  استكمال
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default PendingLists
