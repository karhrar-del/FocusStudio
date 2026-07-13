import React, { useState, useEffect, useRef } from 'react'
import { CheckCircle2, Circle, Square, Plus, Trash2, ChevronDown, Search, FolderPlus, Loader2, MousePointer2, Save, Send, Clock as ClockIcon, Smartphone, Image, MoreVertical, Copy, ArrowUpToLine, ArrowDownToLine } from 'lucide-react'
import { db } from '../db'
import { useTheme } from '../context/ThemeContext'

const Checklists = ({ onStatusChange, initialData, onSave }) => {
  const { theme } = useTheme()
  const isExcel = theme === 'excel'
  const [rootPath, setRootPath] = useState(null)
  const [countries, setCountries] = useState([])
  const [factories, setFactories] = useState([])
  const [selectedCountry, setSelectedCountry] = useState('')
  const [selectedFactory, setSelectedFactory] = useState('')
  const [suppliers, setSuppliers] = useState([])
  const [selectedSupplier, setSelectedSupplier] = useState('')
  const [listDate, setListDate] = useState(new Date().toISOString().split('T')[0])

  const [factoryItems, setFactoryItems] = useState([]) // Image objects {name, factory}
  const [rows, setRows] = useState([{ id: Date.now(), value: '', factory: '', mobileCaptured: false, photographed: false, uploaded: false, isNew: false, suggestions: [] }])
  const [loading, setLoading] = useState(true)
  const [activeRowId, setActiveRowId] = useState(null)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const [openMenuId, setOpenMenuId] = useState(null)
  const debounceRef = useRef(null)
  
  // Collection & Dropdown States
  const [showDropdown, setShowDropdown] = useState(false)
  const [isCollecting, setIsCollecting] = useState(false)
  const [collectionPath, setCollectionPath] = useState('')

  // Refs for keyboard navigation
  const inputRefs = useRef([])
  const rowsRef = useRef(rows)

  // Keep rowsRef in sync
  useEffect(() => {
    rowsRef.current = rows
  }, [rows])

  // Fetch initial config
  useEffect(() => {
    const init = async () => {
      try {
        const path = await db.getRootFolder()
        if (path) {
          setRootPath(path)
          const sub = await db.listCountries()
          setCountries(sub)
          
          const supps = await db.getSuppliers()
          setSuppliers(supps)
          
          // Persistence: Read collection path
          const cPath = localStorage.getItem('collectionFolderPath')
          if (cPath) setCollectionPath(cPath)

          if (initialData) {
            setSelectedCountry(initialData.country || '')
            setSelectedFactory(initialData.factory || '')
            setSelectedSupplier(initialData.supplier || '')
            if (initialData.listDate) setListDate(initialData.listDate)
            
            const defaultRow = { id: Date.now(), value: '', factory: '', mobileCaptured: false, photographed: false, uploaded: false, isNew: false, suggestions: [] }
            const sanitizedRows = (initialData?.rows || []).map(r => ({
                ...defaultRow,
                ...r,
                id: r.id || Date.now() + Math.random()
            }))
            setRows(sanitizedRows.length > 0 ? sanitizedRows : [defaultRow])
          }
        }
      } catch (err) {
        console.error("Checklists Init Error:", err)
      } finally {
        setLoading(false)
      }
    }
    init()
    
    // Check for localStorage updates (if coming from Settings)
    const handleStorage = () => {
        const cPath = localStorage.getItem('collectionFolderPath')
        if (cPath) setCollectionPath(cPath)
    }
    window.addEventListener('storage', handleStorage)
    
    // Real-time Sync from Mobile & Other Tabs
    const handleSync = async () => {
        const currentRows = rowsRef.current || [];
        
        // 1. If it's a saved list, we might want to sync structure first
        let baseRows = [...currentRows];
        if (initialData?.id) {
            try {
                const data = await db.getLists();
                const current = (data || []).find(l => l.id === initialData.id);
                if (current) {
                    baseRows = (current.rows || []).map(r => ({
                        ...r,
                        id: r.id || Date.now() + Math.random()
                    }));
                }
            } catch (err) {
                console.error("Fetch Lists Error:", err);
            }
        }

        // 2. Re-verify ALL visible rows against the global database for latest status
        const names = baseRows.map(r => r.value).filter(v => v && v.trim() !== '');
        if (names.length === 0) {
            if (initialData?.id) setRows(baseRows);
            return;
        }

        try {
            const stats = await db.processList(names);
            const statusMap = {};
            (stats || []).forEach(s => {
                if (s?.name) {
                    statusMap[s.name] = {
                        mobileCaptured: !!s.mobileCaptured,
                        photographed: !!s.photographed,
                        uploaded: !!s.uploaded || !!s.isUploaded
                    };
                }
            });

            const finalizedRows = baseRows.map(r => {
                const global = statusMap[r.value];
                if (global) {
                    return {
                        ...r,
                        mobileCaptured: global.mobileCaptured,
                        photographed: global.photographed,
                        uploaded: global.uploaded,
                        isUploaded: global.uploaded // Keep both for compatibility
                    };
                }
                return r;
            });
            setRows(finalizedRows);
        } catch (err) {
            console.error("Global Status Sync Error:", err);
            if (initialData?.id) setRows(baseRows);
        }
    }
    window.addEventListener('lists-updated', handleSync);
    
    return () => {
        window.removeEventListener('storage', handleStorage);
        window.removeEventListener('lists-updated', handleSync);
    }
  }, [initialData])

  // Update factories when country changes
  useEffect(() => {
    const updateFactories = async () => {
      if (selectedCountry) {
        const sub = await db.listFactories(selectedCountry)
        setFactories(['الكل', ...sub]) // Prepend "الكل" option

        // Only reset if picking a new country manually (not the initialData country)
        if (!initialData || selectedCountry !== initialData.country) {
          setSelectedFactory('')
          setFactoryItems([])
        }
      }
    }
    updateFactories()
  }, [selectedCountry])

  // Get factory contents (Images) for autocomplete — country-only deep search
  useEffect(() => {
    const getItems = async () => {
      if (selectedCountry) {
        const images = await db.listImages(selectedCountry, selectedFactory || 'الكل')
        setFactoryItems(images)
      }
    }
    getItems()
  }, [selectedFactory, selectedCountry])

  // Outside Click Logic for Autocomplete
  useEffect(() => {
    const handleClickOutside = (e) => {
      // Find if we clicked inside an active row container
      if (activeRowId) {
        const isClickInside = e.target.closest(`[data-active-row="true"]`)
        if (!isClickInside) {
          setActiveRowId(null)
          setHighlightedIndex(-1)
          setOpenMenuId(null)
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [activeRowId, openMenuId])
  
  // Auto-scroll highlighted suggestion into view
  useEffect(() => {
    if (highlightedIndex >= 0) {
      const element = document.getElementById(`suggestion-item-${highlightedIndex}`)
      if (element) {
        element.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }
    }
  }, [highlightedIndex])

  const addRow = (index) => {
    const newRow = { id: Date.now() + Math.random(), value: '', factory: '', mobileCaptured: false, photographed: false, uploaded: false, isNew: false, suggestions: [] }
    const newRows = [...rows]
    if (typeof index === 'number') {
      newRows.splice(index + 1, 0, newRow)
    } else {
      newRows.push(newRow)
    }
    setRows(newRows)

    // Auto focus the new input after render
    setTimeout(() => {
      const targetIndex = typeof index === 'number' ? index + 1 : newRows.length - 1;
      if (inputRefs.current[targetIndex]) {
        inputRefs.current[targetIndex].focus()
      }
    }, 10)
  }

  const handleMenuAction = (action, row, index) => {
    setOpenMenuId(null)
    const newRows = [...rows]
    
    if (action === 'duplicate') {
      const cloned = { ...row, id: Date.now() + Math.random(), suggestions: [] }
      setRows([...newRows, cloned])
    } else if (action === 'delete') {
      removeRow(row.id)
    } else if (action === 'insertAbove') {
      const emptyRow = { id: Date.now() + Math.random(), value: '', factory: '', mobileCaptured: false, photographed: false, uploaded: false, isNew: false, suggestions: [] }
      newRows.splice(index, 0, emptyRow)
      setRows(newRows)
    } else if (action === 'insertBelow') {
      const emptyRow = { id: Date.now() + Math.random(), value: '', factory: '', mobileCaptured: false, photographed: false, uploaded: false, isNew: false, suggestions: [] }
      newRows.splice(index + 1, 0, emptyRow)
      setRows(newRows)
    }
  }

  const resetList = () => {
    if (window.confirm('هل أنت متأكد من تصفير القائمة الحالية؟')) {
      setRows([{ id: Date.now(), value: '', factory: '', mobileCaptured: false, photographed: false, uploaded: false, isNew: false, suggestions: [] }])
    }
  }

  const removeRow = (id) => {
    if (rows.length > 1) {
      setRows(rows.filter(r => r.id !== id))
    }
  }

  const handleInputChange = (id, val, index) => {
    // Implement debounce to prevent freeze
    if (debounceRef.current) clearTimeout(debounceRef.current)

    // Auto-append row if typing in the last row
    if (index === rows.length - 1 && val.length > 0) {
      const newRow = { id: Date.now() + Math.random(), value: '', factory: '', mobileCaptured: false, photographed: false, uploaded: false, isNew: false, suggestions: [] }
      setRows(prevRows => {
        const updatedRows = prevRows.map(row => row.id === id ? { ...row, value: val, factory: selectedFactory !== 'الكل' ? selectedFactory : row.factory } : row)
        return [...updatedRows, newRow]
      })
    } else {
      setRows(prevRows => prevRows.map(row =>
        row.id === id ? { ...row, value: val, factory: selectedFactory !== 'الكل' ? selectedFactory : row.factory } : row
      ))
    }

    setHighlightedIndex(-1) // Reset selection when typing

    debounceRef.current = setTimeout(async () => {
      // 1. Filter suggestions from factoryItems (Image objects)
      const suggestions = (Array.isArray(factoryItems) ? factoryItems : []).filter(item =>
        (item?.name?.toLowerCase() || '').includes(val?.toLowerCase() || '')
      )

      // 2. Check if this product is already in our photography DB
      let photographed = false
      let uploaded = false
      if (val) {
        try {
          const stats = await db.processList([val])
          const product = stats[0] || {}
          const isMobileCaptured = !!product.mobileCaptured
          const isPhotographed = !!product.photographed
          const isUploaded = !!product.uploaded || !!product.isUploaded
          const isNew = !factoryItems.some(item => item.name === val)

          // 3. Update complex state
          setRows(prevRows => prevRows.map(row =>
            row.id === id ? { 
                ...row, 
                suggestions, 
                mobileCaptured: isMobileCaptured, 
                photographed: isPhotographed, 
                uploaded: isUploaded, 
                isUploaded: isUploaded,
                isNew 
            } : row
          ))
        } catch (err) {
          console.error("DB Process Error:", err)
        }
      }
    }, 250) // 250ms debounce
  }

  const selectSuggestion = async (id, val, index) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    let photographed = false
    let uploaded = false
    try {
      const stats = await db.processList([val.name])
      const product = stats[0] || {}
      const isMobileCaptured = !!product.mobileCaptured
      const isPhotographed = !!product.photographed
      const isUploaded = !!product.uploaded || !!product.isUploaded

      setRows(prevRows => prevRows.map(r =>
        r.id === id ? { 
          ...r, 
          value: val.name, 
          factory: val.factory,
          suggestions: [], 
          mobileCaptured: isMobileCaptured, 
          photographed: isPhotographed, 
          uploaded: isUploaded, 
          isUploaded: isUploaded,
          isNew: false 
        } : r
      ))

      setActiveRowId(null) // Hide after selection
      setHighlightedIndex(-1)

      // Move focus to next row
      if (typeof index === 'number' && inputRefs.current[index + 1]) {
        setTimeout(() => inputRefs.current[index + 1].focus(), 10)
      }
    } catch (err) {
      console.error("DB Process Error:", err)
    }
  }

  const handleToggle = async (name, id, statusType) => {
    try {
      const row = rows.find(r => r.id === id)
      if (!row) return

      const newStatus = !row[statusType]
      // Determine all statuses for DB update
      const mobileCaptured = statusType === 'mobileCaptured' ? newStatus : row.mobileCaptured
      const photographed = statusType === 'photographed' ? newStatus : row.photographed
      const uploaded = statusType === 'uploaded' ? newStatus : row.uploaded

      await db.toggleStatus(name, mobileCaptured, photographed, uploaded)
      setRows(rows.map(r => r.id === id ? { ...r, [statusType]: newStatus } : r))
      if (onStatusChange) onStatusChange()
    } catch (err) {
      console.error(`Error toggling ${statusType}:`, err)
    }
  }

  const handleSaveList = async (status) => {
    if (rows.filter(r => r.value.trim()).length === 0) {
      alert('القائمة فارغة!')
      return
    }

    const listData = {
      id: initialData?.id || Date.now(),
      title: selectedSupplier || `${selectedFactory || 'قائمة جديدة'} - ${new Date(listDate).toLocaleDateString('ar-EG')}`,
      country: selectedCountry,
      factory: selectedFactory,
      supplier: selectedSupplier,
      listDate: listDate,
      rows: rows.filter(r => r.value.trim() !== ''),
      status,
      updatedAt: new Date(listDate).toISOString()
    }

    try {
      // 1. Update individual product stats in global DB before saving the list
      for (const row of rows) {
        if (row.value.trim()) {
          await db.toggleStatus(row.value, row.mobileCaptured, row.photographed, row.uploaded)
        }
      }

      await db.saveList(listData)
      // Dispatch custom event for cross-tab synchronization
      window.dispatchEvent(new Event('lists-updated'))

      if (onSave) onSave()
      if (onStatusChange) onStatusChange()
    } catch (err) {
      console.error("Save Error:", err)
    }
  }

  const handleCollectImages = async () => {
    const cPath = localStorage.getItem('collectionFolderPath')
    if (!cPath) {
      alert('يرجى تحديد مجلد التجميع من الإعدادات أولاً')
      return
    }

    if (rows.filter(r => r.value.trim()).length === 0) {
      alert('القائمة فارغة!')
      return
    }

    setIsCollecting(true)
    setShowDropdown(false)

    try {
      const listName = selectedSupplier || `${selectedFactory || 'تجميع'} - ${new Date(listDate).toLocaleDateString('ar-EG')}`
      
      const result = await window.api.collectImagesProcess({
        listName,
        country: selectedCountry,
        factory: selectedFactory,
        products: rows.filter(r => r.value.trim() !== ''),
        collectionPath: cPath
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

  const handleViewImage = async (imageName) => {
    if (!imageName || !selectedCountry) {
      alert('يرجى اختيار البلد وتحديد اسم المنتج أولاً')
      return
    }

    const row = rows.find(r => r.value === imageName)
    const factory = row?.factory || selectedFactory
    
    // Primary path (for speed)
    const primaryPath = (factory && factory !== 'الكل') 
      ? `${rootPath}\\${selectedCountry}\\${factory}\\${imageName}.jpg`
      : null

    const result = await window.api.openExternalImage({
      fullPath: primaryPath,
      country: selectedCountry,
      imageName
    })

    if (!result?.success) {
      alert('الصورة غير موجودة في أي من مجلدات هذا البلد')
    }
  }

  // Keyboard navigation logic
  const handleKeyDown = (e, index, row) => {
    const suggestions = row.suggestions || []

    if (e.key === 'Enter') {
      e.preventDefault()
      if (highlightedIndex >= 0 && suggestions[highlightedIndex]) {
        selectSuggestion(row.id, suggestions[highlightedIndex], index)
      } else {
        // Move focus to next row
        if (index < rows.length - 1 && inputRefs.current[index + 1]) {
          inputRefs.current[index + 1].focus()
        } else if (index === rows.length - 1) {
          // If it's the last row, addRow will handle it
          addRow(index)
        }
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (suggestions.length > 0 && activeRowId === row.id) {
        setHighlightedIndex(prev => (prev > 0 ? prev - 1 : 0))
      } else if (index > 0 && inputRefs.current[index - 1]) {
        inputRefs.current[index - 1].focus()
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (suggestions.length > 0 && activeRowId === row.id) {
        setHighlightedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : prev))
      } else if (index < rows.length - 1 && inputRefs.current[index + 1]) {
        inputRefs.current[index + 1].focus()
      }
    } else if (e.key === 'Escape') {
      setActiveRowId(null)
      setHighlightedIndex(-1)
    }
  }

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-mustard" /></div>

  if (!rootPath) return (
    <div className={`${isExcel ? 'bg-white border border-gray-300 rounded-md p-8 text-center' : 'glass-card p-12 text-center'}`}>
      <div className={`bg-amber-50 text-amber-600 p-6 ${isExcel ? 'rounded border border-amber-200' : 'rounded-2xl border border-amber-100'} mb-6 font-bold`}>
        عذراً، يجب تحديد "مجلد الصور الرئيسي" من الإعدادات أولاً لتفعيل ميزات الاقتراح التلقائي.
      </div>
    </div>
  )

  return (
    <div className="flex flex-col h-full space-y-4 animate-in fade-in duration-500">
      {/* Compact Top Control Bar Refactored for Relocated Buttons */}
      <div className={`${isExcel ? 'bg-white border border-gray-300 rounded-md p-2 px-4 flex flex-row items-center justify-between gap-1.5 relative overflow-visible z-[60]' : 'glass-card p-2 px-4 flex flex-row items-center justify-between gap-1.5 relative overflow-visible z-[60]'}`}>
        {/* Right Side (RTL) - Filters */}
        <div className="flex items-center gap-2">
          <button
            onClick={resetList}
            className="flex items-center justify-center bg-olive-dark text-white w-8 h-8 rounded-lg hover:bg-black/80 transition-all shadow-sm shrink-0"
            title="قائمة جديدة"
          >
            <Plus className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2 border-r border-gray-100 ps-3">
            <label className="text-[9px] font-bold text-olive-dark uppercase opacity-70">البلد</label>
            <div className="relative">
              <select
                value={selectedCountry}
                onChange={(e) => setSelectedCountry(e.target.value)}
                className="bg-white border border-gray-200 rounded-lg px-2 py-0.5 h-8 appearance-none focus:outline-none focus:ring-1 focus:ring-mustard/50 text-xs text-gray-700 font-bold w-24"
              >
                <option value="">اختر...</option>
                {(countries || []).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <ChevronDown className="absolute left-1.5 top-1/2 -translate-y-1/2 text-gray-400 w-3 h-3 pointer-events-none" />
            </div>
          </div>

          <div className="flex items-center gap-2 border-r border-gray-100 ps-3">
            <label className="text-[9px] font-bold text-olive-dark uppercase opacity-70">المعمل (اختياري)</label>
            <div className="relative">
              <select
                value={selectedFactory}
                onChange={(e) => setSelectedFactory(e.target.value)}
                disabled={!selectedCountry}
                className="bg-white border border-gray-200 rounded-lg px-2 py-0.5 h-8 appearance-none focus:outline-none focus:ring-1 focus:ring-mustard/50 text-xs text-gray-700 font-bold w-24 disabled:opacity-40"
              >
                <option value="">اختر...</option>
                {(factories || []).map(f => <option key={f} value={f}>{f}</option>)}
              </select>
              <ChevronDown className="absolute left-1.5 top-1/2 -translate-y-1/2 text-gray-400 w-3 h-3 pointer-events-none" />
            </div>
          </div>

          <div className="flex items-center gap-2 border-r border-gray-100 ps-3">
            <label className="text-[9px] font-bold text-olive-dark uppercase opacity-70">التاريخ</label>
            <input
              type="date"
              value={listDate}
              onChange={(e) => setListDate(e.target.value)}
              className="bg-white border border-gray-200 rounded-lg px-2 py-0.5 h-8 appearance-none focus:outline-none focus:ring-1 focus:ring-mustard/50 text-xs text-gray-700 font-bold w-28 cursor-pointer"
            />
          </div>
        </div>

        {/* Left Side (RTL) - Relocated Actions */}
        <div className="flex items-center gap-2 animate-in fade-in duration-500">
          <div className="flex items-center gap-2 border-l border-gray-100 pe-3">
            <label className="text-[9px] font-bold text-olive-dark uppercase opacity-70">المورد</label>
            <div className="relative">
              <select
                value={selectedSupplier}
                onChange={(e) => setSelectedSupplier(e.target.value)}
                className="bg-white border border-gray-200 rounded-lg px-2 py-0.5 h-8 appearance-none focus:outline-none focus:ring-1 focus:ring-mustard/50 text-xs text-gray-700 font-bold w-28"
              >
                <option value="">اختر مورد...</option>
                {(suppliers || []).map(s => <option key={s?.id || Math.random()} value={s?.name || ''}>{s?.name || ''}</option>)}
              </select>
              <ChevronDown className="absolute left-1.5 top-1/2 -translate-y-1/2 text-gray-400 w-3 h-3 pointer-events-none" />
            </div>
          </div>

          <div className="flex flex-col text-right px-3 border-l border-gray-100 ps-3">
            <span className="text-[9px] text-olive-dark/40 font-bold uppercase tracking-wider">حالة الحفظ</span>
            <span className="text-[10px] font-bold text-olive-dark">قيد التعديل</span>
          </div>

          <button
            onClick={() => handleSaveList('pending')}
            className="flex items-center gap-2 px-3 h-8 bg-amber-50 hover:bg-amber-100 text-amber-600 rounded-lg text-xs font-bold transition-all border border-amber-100 shadow-sm active:scale-95"
          >
            <ClockIcon className="w-3.5 h-3.5" />
            ترحيل
          </button>

          {/* Split Dropdown Action Button */}
          <div className="relative flex items-center">
            <button
              onClick={() => handleSaveList('completed')}
              disabled={isCollecting}
              className="flex items-center gap-2 ps-4 pe-3 h-8 bg-olive-dark text-white rounded-r-lg text-[11px] font-bold transition-all shadow-md hover:bg-black active:scale-95 disabled:opacity-50 border-l border-white/20"
            >
              {isCollecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              نشر القائمة
            </button>
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              disabled={isCollecting}
              className="bg-olive-dark text-white px-1.5 h-8 rounded-l-lg hover:bg-black transition-all border-l border-white/10 flex items-center justify-center shadow-md disabled:opacity-50"
            >
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-300 ${showDropdown ? 'rotate-180' : ''}`} />
            </button>

            {showDropdown && (
              <div className="absolute top-full mt-2 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 z-[999] min-w-[160px] ring-1 ring-black/5">
                <button
                  onClick={handleCollectImages}
                  disabled={isCollecting}
                  className="w-full text-right px-4 py-3 text-[11px] font-bold text-gray-700 hover:bg-amber-50 hover:text-amber-600 flex items-center gap-2.5 transition-colors border-b border-gray-50 last:border-0"
                >
                  {isCollecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FolderPlus className="w-3.5 h-3.5" />}
                  تجميع (Collect)
                </button>
                <button
                  onClick={() => {
                    handleSaveList('completed')
                    setShowDropdown(false)
                  }}
                  className="w-full text-right px-4 py-3 text-[11px] font-bold text-gray-700 hover:bg-olive-dark/5 hover:text-olive-dark flex items-center gap-2.5 transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                  نشر القائمة
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Dense Product List Area */}
      <div className={`${isExcel ? 'bg-white border border-gray-300 rounded-md flex-1 p-3 overflow-hidden flex flex-col' : 'glass-card flex-1 p-3 overflow-hidden flex flex-col'}`}>
        <div className="flex justify-between items-center mb-2 pb-1.5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 ${isExcel ? 'bg-gray-400' : 'bg-mustard'} rounded-full animate-pulse`}></span>
            <h3 className="text-[11px] font-bold text-olive-dark/60 uppercase tracking-widest">عرض القائمة التنفيذي</h3>
          </div>
          <span className={`text-[10px] font-bold bg-gray-100 text-gray-500 px-2 py-0.5 ${isExcel ? 'rounded' : 'rounded-full'}`}>{(rows || []).length} سجل</span>
        </div>

        <div className="flex-1 overflow-y-auto space-y-1 custom-scrollbar pe-1 pb-56">
          {(rows || []).map((row, index) => (
            <div
              key={row.id}
              data-active-row={activeRowId === row.id}
              style={{ zIndex: 500 - index }}
              className={`relative group animate-in zoom-in-95 duration-200 transition-all p-1 ${isExcel ? 'rounded even:bg-gray-50 odd:bg-transparent hover:bg-gray-100' : 'rounded-xl even:bg-green-50/80 odd:bg-transparent hover:bg-yellow-50'} ${activeRowId === row.id ? (isExcel ? 'bg-white' : 'bg-white/60 shadow-sm') : ''}`}
            >
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-gray-300 font-mono w-4">{index + 1}</span>
                <div className="flex items-center gap-1">
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setOpenMenuId(openMenuId === row.id ? null : row.id)
                      }}
                      className={`p-1 rounded-md transition-all ${openMenuId === row.id ? 'bg-mustard text-white' : 'text-gray-300 hover:text-mustard hover:bg-mustard/5'}`}
                    >
                      <MoreVertical className="w-3.5 h-3.5" />
                    </button>

                    {openMenuId === row.id && (
                      <div className="absolute top-0 right-full mr-2 min-w-[140px] bg-white border border-gray-200 rounded-xl shadow-xl z-[100] overflow-hidden animate-in fade-in slide-in-from-right-2 duration-200 ring-1 ring-black/5">
                        <button
                          onClick={() => handleMenuAction('duplicate', row, index)}
                          className="w-full text-right px-3 py-2 text-[10px] font-bold text-gray-600 hover:bg-mustard/5 hover:text-mustard flex items-center justify-between transition-colors border-b border-gray-50"
                        >
                          <span>تكرار</span>
                          <Copy className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleMenuAction('insertAbove', row, index)}
                          className="w-full text-right px-3 py-2 text-[10px] font-bold text-gray-600 hover:bg-mustard/5 hover:text-mustard flex items-center justify-between transition-colors border-b border-gray-50"
                        >
                          <span>إدراج للأعلى</span>
                          <ArrowUpToLine className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleMenuAction('insertBelow', row, index)}
                          className="w-full text-right px-3 py-2 text-[10px] font-bold text-gray-600 hover:bg-mustard/5 hover:text-mustard flex items-center justify-between transition-colors border-b border-gray-50"
                        >
                          <span>إدراج للأسفل</span>
                          <ArrowDownToLine className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleMenuAction('delete', row, index)}
                          className="w-full text-right px-3 py-2 text-[10px] font-bold text-red-500 hover:bg-red-50 flex items-center justify-between transition-colors"
                        >
                          <span>حذف</span>
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                  <div 
                    className="w-1/2 min-w-[400px] max-w-2xl relative"
                    onClick={() => inputRefs.current[index]?.focus()}
                  >
                  <input
                    ref={el => inputRefs.current[index] = el}
                    type="text"
                    value={row.value}
                    onKeyDown={(e) => handleKeyDown(e, index, row)}
                    onChange={(e) => {
                      handleInputChange(row.id, e.target.value, index)
                    }}
                    onFocus={(e) => {
                      setActiveRowId(row.id)
                      setHighlightedIndex(-1)
                      // Auto-scroll to center to ensure space for suggestions
                      e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      
                      // Trigger immediate suggestion fetch
                      const currentVal = row?.value || ''
                      const suggestions = (factoryItems || []).filter(item =>
                        (item?.name || '').toLowerCase().includes(currentVal.toLowerCase())
                      )
                      setRows(prev => prev.map(r => r.id === row.id ? { ...r, suggestions } : r))
                    }}
                    onBlur={() => {
                      // Defensive fallback to prevent input freezing
                      setTimeout(() => {
                        setActiveRowId(prev => prev === row.id ? null : prev)
                        setHighlightedIndex(-1)
                      }, 200)
                    }}
                    placeholder="اسم المنتج..."
                    className="w-full bg-white border border-gray-300 rounded-lg shadow-sm px-4 py-2 text-xs text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  />

                  {/* Duplicate Badge */}
                  {row.value && rows.some(r => r.id !== row.id && r.value.trim() !== '' && r.value.trim() === row.value.trim()) && (
                    <div className="absolute left-2 top-1/2 -translate-y-1/2 flex items-center gap-1 bg-red-50/80 backdrop-blur-md text-red-500 border border-red-100 px-1.5 py-0.5 rounded text-[9px] font-bold animate-in fade-in zoom-in-95 duration-200">
                      مكرر
                    </div>
                  )}

                  {/* Compact Autocomplete Suggestions */}
                  {(row?.suggestions || []).length > 0 && activeRowId === row?.id && (
                    <div 
                      tabIndex="-1"
                      className="absolute top-full right-0 left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-[100] max-h-36 overflow-y-auto border-t-mustard border-t-2"
                    >
                      {(row?.suggestions || []).map((s, i) => (
                        <button
                          key={(s?.name || '') + (s?.factory || i)}
                          id={`suggestion-item-${i}`}
                          onMouseDown={(e) => {
                            e.preventDefault() // Prevent blur from firing before selection
                            selectSuggestion(row.id, s, index)
                          }}
                          className={`w-full text-right px-3 py-1.5 text-[11px] text-gray-600 font-bold transition-colors border-b border-gray-50 last:border-0 flex items-center justify-between ${highlightedIndex === i ? 'bg-mustard/10 text-mustard' : 'hover:bg-mustard/5'}`}
                        >
                          <div className="flex flex-col items-start">
                            <span>{s?.name || ''}</span>
                            {(!selectedFactory || selectedFactory === 'الكل') && <span className="text-[8px] text-gray-400 font-normal">معمل: {s?.factory || 'غير محدد'}</span>}
                          </div>
                          <MousePointer2 className={`w-3 h-3 ${highlightedIndex === i ? 'opacity-100' : 'opacity-0'} group-hover:opacity-100 text-mustard`} />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Dead Zone for keyboard dismissal */}
              <div className="flex-1 min-w-[50px] cursor-default"></div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {row.value && row.isNew && (
                    <button
                      onClick={() => handleToggle(row.value, row.id)}
                      className="flex items-center gap-1 bg-mustard/5 text-mustard px-2 h-7 rounded-md text-[10px] font-bold hover:bg-mustard/10 transition-all border border-mustard/10"
                    >
                      <FolderPlus className="w-3 h-3" />
                      إضافة
                    </button>
                  )}

                  {row.value && !row.isNew && (
                    <div className="flex items-center gap-1.5 h-8">
                      {/* Mobile Captured Status */}
                      {!row.photographed && (
                        <button
                          onClick={() => handleToggle(row.value, row.id, 'mobileCaptured')}
                          className={`flex items-center gap-1 px-2 h-7 ${isExcel ? 'rounded' : 'rounded-md'} text-[10px] font-bold transition-all border ${row.mobileCaptured
                              ? 'bg-indigo-50/80 text-indigo-600 border-indigo-100'
                              : 'bg-gray-50 text-gray-400 border-gray-100'
                            }`}
                          title="التقاط هاتف"
                        >
                          {row.mobileCaptured ? <CheckCircle2 className="w-3 h-3" /> : <Smartphone className="w-3 h-3" />}
                          هاتف
                        </button>
                      )}

                      {/* Photographed Status */}
                      <button
                        onClick={() => handleToggle(row.value, row.id, 'photographed')}
                        className={`flex items-center gap-1 px-2 h-7 ${isExcel ? 'rounded' : 'rounded-md'} text-[10px] font-bold transition-all border ${row.photographed
                            ? 'bg-green-50/80 text-green-600 border-green-100'
                            : 'bg-gray-50 text-gray-400 border-gray-100'
                          }`}
                        title="تصوير كمبيوتر"
                      >
                        {row.photographed ? <CheckCircle2 className="w-3 h-3" /> : <Square className="w-3 h-3" />}
                        تصوير
                      </button>

                      {/* Uploaded Status Indicator (Global Sync - Read Only) */}
                      <div
                        className={`flex items-center gap-1 px-2 h-7 ${isExcel ? 'rounded' : 'rounded-md'} text-[10px] font-bold transition-all border ${row.uploaded
                            ? 'bg-green-50/80 text-green-600 border-green-100'
                            : 'bg-gray-50 text-gray-400 border-gray-100 opacity-40'
                          }`}
                        title="حالة الرفع (سجل) - هذه الحالة تُقرأ من الأرشيف ولا يمكن تعديلها يدوياً هنا"
                      >
                        {row.uploaded ? <CheckCircle2 className="w-3 h-3" /> : <Circle className="w-3 h-3" />}
                        <span>رفع</span>
                        <span className="text-[8px] opacity-60 ms-0.5">(سجل)</span>
                      </div>
                    </div>
                  )}

                  {row.value && (
                    <button
                      onClick={() => handleViewImage(row.value)}
                      className="p-1 text-gray-300 hover:text-mustard hover:bg-mustard/5 rounded-md transition-all"
                      title="عرض في ويندوز"
                    >
                      <Image className="w-3.5 h-3.5" />
                    </button>
                  )}
                  
                  <button
                    onClick={() => removeRow(row.id)}
                    className="p-1 text-gray-200 hover:text-red-400 hover:bg-red-50 rounded-md transition-all"
                    title="حذف السطر"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-2 text-[9px] text-gray-400 text-center font-bold uppercase tracking-tighter opacity-50">
          استخدم الأسهم للتنقل • Enter لإضافة سطر جديد
        </div>
      </div>
    </div>
  )
}

export default Checklists
