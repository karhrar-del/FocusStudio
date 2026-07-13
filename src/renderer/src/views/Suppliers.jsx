import React, { useState, useEffect } from 'react'
import { Truck, Plus, Trash2, Search, UserPlus, AlertCircle } from 'lucide-react'
import { db } from '../db'
import { useTheme } from '../context/ThemeContext'

const Suppliers = () => {
    const { theme } = useTheme()
    const isExcel = theme === 'excel'
    const [suppliers, setSuppliers] = useState([])
    const [newName, setNewName] = useState('')
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')

    const fetchSuppliers = async () => {
        setLoading(true)
        const data = await db.getSuppliers()
        setSuppliers(data || [])
        setLoading(false)
    }

    useEffect(() => {
        fetchSuppliers()
    }, [])

    const handleAdd = async (e) => {
        e.preventDefault()
        if (!newName.trim()) return
        await db.addSupplier(newName.trim())
        setNewName('')
        fetchSuppliers()
    }

    const handleDelete = async (id) => {
        if (confirm('هل أنت متأكد من حذف هذا المورد؟')) {
            await db.deleteSupplier(id)
            fetchSuppliers()
        }
    }

    const filteredSuppliers = (suppliers || []).filter(s => 
        (s?.name || '').toLowerCase().includes(searchQuery.toLowerCase())
    )

    if (loading) return <div className="flex h-64 items-center justify-center text-mustard font-bold animate-pulse">جاري التحميل...</div>

    return (
        <div className="flex flex-col h-full space-y-6 animate-in fade-in duration-500">
            {/* Header Area */}
            <div className="flex items-center justify-between mb-2">
                <h2 className="text-2xl font-bold text-olive-dark flex items-center gap-3">
                    <Truck className="w-8 h-8 text-mustard" />
                    إدارة الموردين
                </h2>
                
                <div className={`text-sm font-bold ${isExcel ? 'bg-white text-olive-dark px-4 py-1.5 h-9 flex items-center rounded border border-gray-300' : 'bg-white/60 text-olive-dark px-4 py-1.5 h-9 flex items-center rounded-full border border-gray-100 shadow-sm'}`}>
                    {(suppliers || []).length} مورد مسجل
                </div>
            </div>

            {/* Main Action Bar */}
            <div className={`${isExcel ? 'bg-white border border-gray-300 rounded-md p-4' : 'glass-card p-6'} flex flex-col md:flex-row items-center gap-6`}>
                <form onSubmit={handleAdd} className="flex-1 flex gap-3 w-full">
                    <div className="relative flex-1">
                        <UserPlus className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input 
                            type="text" 
                            placeholder="اسم المورد الجديد..."
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            className={`w-full ${isExcel ? 'bg-white border border-gray-300 rounded px-10 py-2 text-sm' : 'bg-white/50 border border-gray-200 rounded-xl px-10 py-2.5 text-sm'} font-bold text-olive-dark focus:ring-2 focus:ring-mustard/40 outline-none transition-all`}
                        />
                    </div>
                    <button 
                        type="submit"
                        className={`${isExcel ? 'bg-olive-dark hover:bg-black text-white px-6 py-2 rounded text-sm font-bold flex items-center gap-2 whitespace-nowrap' : 'btn-accent px-6 flex items-center gap-2 shadow-lg shadow-mustard/20 whitespace-nowrap'}`}
                    >
                        <Plus className="w-4 h-4" />
                        إضافة مورد
                    </button>
                </form>

                <div className="relative w-full md:w-64">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input 
                        type="text" 
                        placeholder="بحث في الموردين..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className={`w-full ${isExcel ? 'bg-white border border-gray-300 rounded px-10 py-2 text-xs' : 'bg-white/40 border border-gray-100 rounded-xl px-10 py-2 text-xs'} font-bold text-olive-dark focus:outline-none transition-all`}
                    />
                </div>
            </div>

            {/* List Area */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-y-auto pb-10 custom-scrollbar">
                {(filteredSuppliers || []).length === 0 ? (
                    <div className={`col-span-full ${isExcel ? 'bg-white border border-gray-300 rounded-md p-10 text-center flex flex-col items-center' : 'glass-card p-20 text-center flex flex-col items-center'}`}>
                        <div className={`${isExcel ? 'bg-gray-50 text-gray-400 p-6 rounded border border-dashed border-gray-200 inline-block mb-4' : 'bg-gray-50 text-gray-400 p-8 rounded-3xl border border-dashed border-gray-200 inline-block mb-4'}`}>
                            <AlertCircle className="w-16 h-16 mx-auto opacity-20" />
                        </div>
                        <p className="text-lg font-bold text-olive-dark opacity-50 italic">
                            {searchQuery ? 'لا توجد نتائج لمورد بهذا الاسم.' : 'لم يتم إضافة موردين بعد.'}
                        </p>
                    </div>
                ) : (
                    (filteredSuppliers || []).map((supplier) => (
                        <div 
                            key={supplier?.id || Math.random()}
                            className={`${isExcel ? 'bg-white border border-gray-200 rounded-md p-3 hover:border-gray-400' : 'glass-card p-5 group hover:border-mustard/40'} transition-all flex items-center justify-between animate-in zoom-in-95 duration-300`}
                        >
                            <div className="flex items-center gap-4">
                                <div className={`w-10 h-10 ${isExcel ? 'bg-gray-100 rounded flex items-center justify-center text-gray-500' : 'bg-mustard/10 rounded-xl flex items-center justify-center text-mustard group-hover:bg-mustard group-hover:text-white'} transition-all duration-300`}>
                                    <Truck className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-olive-dark">{supplier?.name || 'بدون اسم'}</h3>
                                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">مورد معتمد</p>
                                </div>
                            </div>
                            
                            <button 
                                onClick={() => handleDelete(supplier?.id)}
                                className={`p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 ${isExcel ? 'rounded' : 'rounded-xl'} transition-all ${isExcel ? '' : 'opacity-0 group-hover:opacity-100 duration-300'}`}
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}

export default Suppliers
