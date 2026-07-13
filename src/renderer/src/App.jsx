import React, { useState, useEffect } from 'react'
import { LayoutDashboard, ClipboardList, Clock, Settings as SettingsIcon, CheckCircle2, CloudUpload, Search, PlusCircle, Users, Truck } from 'lucide-react'
import StatCard from './components/StatCard'
import Dashboard from './views/Dashboard'
import Checklists from './views/Checklists'
import Settings from './views/Settings'
import CompletedLists from './views/CompletedLists'
import PendingLists from './views/PendingLists'
import Suppliers from './views/Suppliers'
import { db } from './db'
import { X, ChevronLeft, ChevronRight, Menu } from 'lucide-react'
import { ThemeProvider } from './context/ThemeContext'

const App = () => {
  const [tabs, setTabs] = useState([{ id: 'dashboard', type: 'dashboard', label: 'الرئيسية' }])
  const [activeTabId, setActiveTabId] = useState('dashboard')
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [stats, setStats] = useState({ newPhotos: 0, uploaded: 0 })

  const fetchStats = async () => {
    try {
      const data = await db.getStats()
      setStats(data)
    } catch (err) {
      console.error("Stats Error:", err)
    }
  }

  useEffect(() => {
    fetchStats()

    // Real-time Sync from Mobile
    if (window.electron && window.electron.ipcRenderer) {
      window.electron.ipcRenderer.on('trigger-sync', () => {
        window.dispatchEvent(new CustomEvent('lists-updated'));
        fetchStats();
      });
    }
  }, [])

  const navItems = [
    { id: 'dashboard', label: 'لوحة الإحصائيات', icon: LayoutDashboard },
    { id: 'checklists', label: 'قوائم التصوير', icon: ClipboardList },
    { id: 'pending', label: 'القوائم غير المكتملة', icon: Clock },
    { id: 'completed', label: 'القوائم المكتملة', icon: CheckCircle2 },
    { id: 'suppliers', label: 'قسم الموردين', icon: Truck },
    { id: 'settings', label: 'الإعدادات', icon: SettingsIcon },
  ]

  const handleNavClick = (id) => {
    if (id === 'checklists') {
      const newTabId = `checklist-${Date.now()}`
      setTabs([...tabs, { id: newTabId, type: 'checklists', label: `قائمة تجريبية` }])
      setActiveTabId(newTabId)
    } else {
      const existing = tabs.find(t => t.id === id)
      if (existing) {
        setActiveTabId(id)
      } else {
        const item = navItems.find(n => n.id === id)
        setTabs([...tabs, { id: item.id, type: item.id, label: item.label }])
        setActiveTabId(id)
      }
    }
  }

  const closeTab = (e, id) => {
    e.stopPropagation()
    if (tabs.length === 1) return
    const newTabs = tabs.filter(t => t.id !== id)
    setTabs(newTabs)
    if (activeTabId === id) {
      setActiveTabId(newTabs[newTabs.length - 1].id)
    }
  }

  const resumeList = (list) => {
    const existing = tabs.find(t => t.listId === list.id)
    if (existing) {
      setActiveTabId(existing.id)
    } else {
      const newTabId = `checklist-${Date.now()}`
      setTabs([...tabs, { 
        id: newTabId, 
        type: 'checklists', 
        label: list.title || 'قائمة مستأنفة',
        initialData: list,
        listId: list.id
      }])
      setActiveTabId(newTabId)
    }
  }

  const renderView = (tab) => {
    switch(tab.type) {
      case 'dashboard': return <Dashboard onNavigate={handleNavClick} onResumeList={resumeList} />
      case 'checklists': return <Checklists onStatusChange={fetchStats} initialData={tab.initialData} onSave={() => closeTab({ stopPropagation: () => {} }, tab.id)} />
      case 'settings': return <Settings />
      case 'completed': return <CompletedLists />
      case 'pending': return <PendingLists onResume={resumeList} />
      case 'suppliers': return <Suppliers />
      default: return <Dashboard />
    }
  }

  return (
    <ThemeProvider>
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside 
        onMouseLeave={() => setIsSidebarOpen(false)}
        className={`glass-sidebar flex flex-col transition-all duration-300 ${isSidebarOpen ? 'w-64 px-6 items-start' : 'w-20 items-center'} py-8`}
      >
        <div className="mb-10 w-full flex items-center justify-between">
          <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center font-bold text-white shrink-0 brand-font text-xl border border-white/20 shadow-lg">
            F
          </div>
          {isSidebarOpen && <span className="text-white font-extrabold text-2xl tracking-tight transition-all brand-font ml-3">FStudio</span>}
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className={`p-2 rounded-xl text-white/50 hover:text-white hover:bg-white/10 transition-all ${!isSidebarOpen ? 'absolute top-10' : ''}`}
          >
            <Menu className="w-6 h-6" />
          </button>
        </div>

        <nav className="flex-1 w-full space-y-4">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              title={!isSidebarOpen ? item.label : ''}
              className={`sidebar-link w-full flex items-center gap-4 p-3 rounded-2xl transition-all duration-300 ${tabs.some(t => t.id === item.id && activeTabId === item.id) ? 'active bg-white/10 text-white shadow-xl scale-105' : 'text-white/50 hover:text-white hover:bg-white/5'} ${!isSidebarOpen ? 'justify-center' : 'justify-start px-4'}`}
            >
              <item.icon className="w-6 h-6 shrink-0" />
              {isSidebarOpen && <span className="font-bold text-sm whitespace-nowrap">{item.label}</span>}
            </button>
          ))}
        </nav>

        <div className="mt-auto w-full flex flex-col items-center gap-4">
           {!isSidebarOpen ? (
              <>
                <div title="النظام يعمل بكفاءة" className="w-2 h-2 bg-green-400 rounded-full animate-pulse shadow-[0_0_10px_rgba(74,222,128,0.5)]"></div>
                <div className="text-[10px] text-white/30 font-bold vertical-text uppercase tracking-[0.2em] leading-none mb-4 brand-font">FStudio</div>
              </>
           ) : (
              <div className="glass-card bg-white/5 p-4 border-white/5 w-full flex items-center gap-3">
                 <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                 <span className="text-[10px] text-white/50 font-bold uppercase tracking-wider leading-none">Status: Healthy</span>
              </div>
           )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden bg-[#f8fbff]">
        {/* Browser-like Tab Bar */}
        <div className="h-12 flex items-end px-4 gap-1 border-b border-gray-100 bg-white/60 backdrop-blur-md">
           {tabs.map((tab) => (
              <div 
                key={tab.id}
                onClick={() => setActiveTabId(tab.id)}
                className={`group flex items-center gap-2 px-4 py-2 rounded-t-xl transition-all cursor-pointer font-bold text-xs h-9 border-t border-x ${activeTabId === tab.id ? 'bg-[#f8fbff] border-gray-100 text-olive-dark z-10 -mb-[1px]' : 'bg-transparent border-transparent text-gray-400 hover:bg-white/40'}`}
              >
                 <span className="max-w-[120px] truncate">{tab.label}</span>
                 <X 
                  className={`w-3 h-3 hover:text-red-500 hover:bg-red-50 rounded-sm transition-all ${activeTabId === tab.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                  onClick={(e) => closeTab(e, tab.id)}
                 />
              </div>
           ))}
        </div>

        {/* Top Header / Stats (Conditionally shown for dashboard) */}

        {/* Dynamic View Area with state preservation */}
        <section className="flex-1 relative overflow-hidden">
          {tabs.map((tab) => (
            <div 
              key={tab.id} 
              className={`absolute inset-0 p-8 overflow-y-auto custom-scrollbar transition-opacity duration-300 ${activeTabId === tab.id ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}
            >
              {renderView(tab)}
            </div>
          ))}
        </section>
      </main>
    </div>
    </ThemeProvider>
  )
}


export default App
