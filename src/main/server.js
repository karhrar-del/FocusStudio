const express = require('express');
const cors = require('cors');
const os = require('os');
const path = require('path');
const db = require('./db');
const multer = require('multer');
const fs = require('fs');
const archiver = require('archiver');
const AdmZip = require('adm-zip');
const fse = require('fs-extra');

// Configure Multer for Dynamic Storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const { mobileUploadPath, listName } = req.body;
        if (!mobileUploadPath) {
            return cb(new Error('Mobile upload path is not set'));
        }
        
        // Clean folder name
        const subfolder = (listName || 'General').replace(/[\\/:*?"<>|]/g, '_');
        const finalPath = path.join(mobileUploadPath, subfolder);
        
        // Ensure directory exists
        if (!fs.existsSync(finalPath)) {
            fs.mkdirSync(finalPath, { recursive: true });
        }
        
        cb(null, finalPath);
    },
    filename: (req, file, cb) => {
        const productName = req.body.productName || 'product';
        const timestamp = Date.now();
        const ext = path.extname(file.originalname);
        cb(null, `${productName}_${timestamp}${ext}`);
    }
});

const upload = multer({ storage });

// Mobile UI as a string to avoid build/path issues with electron-vite
const MOBILE_HTML = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
    <title>FStudio Mobile Companion</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&family=Outfit:wght@400;700;900&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'Inter', 'Outfit', sans-serif; background-color: #F2F4F3; -webkit-tap-highlight-color: transparent; }
        .card { background: #ffffff; border: 1px solid #e5e7eb; }
        .active-row { border-right: 4px solid #C19A5B; background: rgba(193, 154, 91, 0.06); }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        .animate-fade-in { animation: fadeIn 0.4s ease-out forwards; }
        .animate-slide-up { animation: slideUp 0.3s ease-out forwards; }
        .pb-safe { padding-bottom: env(safe-area-inset-bottom); }
        .tab-active { color: #C19A5B !important; }
        .tab-inactive { color: rgba(255,255,255,0.5) !important; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .snap-y { scroll-snap-type: y mandatory; }
        .snap-center { scroll-snap-align: center; }
        .year-btn { transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1); }
    </style>
</head>
<body class="min-h-screen text-gray-700 pb-24 bg-[#F2F4F3]">
    <div id="mobile-root" class="min-h-screen w-full bg-[#F2F4F3] z-50 relative">
    <header class="sticky top-0 z-50 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between mb-4">
        <div class="flex flex-col">
            <h1 class="text-xl font-black text-[#3F524C] tracking-tight">FStudio</h1>
            <p class="text-[10px] font-bold text-gray-400 uppercase tracking-widest">مساعد التصوير الهاتفي</p>
        </div>
        <button id="back-btn" class="hidden p-2 bg-[#F2F4F3] text-[#3F524C] rounded-xl active:scale-95 transition-all">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
    </header>

    <main id="app-container" class="px-4">
        <!-- Loading State -->
        <div id="loading" class="flex flex-col items-center justify-center py-20 gap-4">
            <div class="w-10 h-10 border-4 border-[#E8E9E6] border-t-[#C19A5B] rounded-full animate-spin"></div>
            <p class="text-sm font-bold text-gray-400">جاري الاتصال بالنظام...</p>
        </div>

        <!-- View: Pending & Completed Lists -->
        <div id="lists-view" class="hidden space-y-4">
            <h2 id="view-title" class="text-lg font-black text-[#3F524C] px-2 flex items-center gap-2">
                <span class="w-2 h-6 bg-[#C19A5B] rounded-full"></span>
                القوائم
            </h2>
            <div id="month-filter-container" class="hidden px-2 mt-2"></div>
            <div id="lists-container" class="space-y-3"></div>
        </div>

        <!-- View: Products -->
        <div id="products-view" class="hidden space-y-4">
            <div class="bg-white border border-gray-200 p-4 mb-6">
                <div class="flex items-center justify-between">
                    <div>
                        <h2 id="current-list-title" class="text-lg font-black text-[#3F524C]">---</h2>
                        <div class="flex gap-4 mt-2 text-[10px] font-bold text-gray-400 uppercase">
                            <span id="current-list-country">---</span>
                            <span id="current-list-factory">---</span>
                        </div>
                    </div>
                    <button onclick="showCompileSheet()" id="compile-btn" class="shrink-0 bg-[#C19A5B] text-white px-3 py-2 text-[10px] font-black active:scale-95 transition-all flex items-center gap-1.5">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M12 12v9"/><path d="m8 17 4 4 4-4"/></svg>
                        تجميع
                    </button>
                </div>
            </div>
            <div id="products-container" class="space-y-3"></div>
        </div>

        <!-- View: Create New List -->
        <div id="create-view" class="hidden space-y-6">
            <h2 class="text-lg font-black text-[#3F524C] px-2 flex items-center gap-2">
                <span class="w-2 h-6 bg-[#C19A5B] rounded-full"></span>
                إنشاء قائمة جديدة
            </h2>
            
            <div class="bg-white border border-gray-200 p-5 space-y-4">
                <div>
                    <label class="block text-[10px] font-black text-gray-400 uppercase mb-2 mr-1">البلد</label>
                    <select id="create-country" onchange="loadFactories(this.value)" class="w-full bg-[#F2F4F3] px-4 py-3 text-sm font-bold text-[#3F524C] focus:ring-2 focus:ring-[#C19A5B] outline-none transition-all">
                        <option value="">اختر البلد...</option>
                    </select>
                </div>

                <div>
                    <label class="block text-[10px] font-black text-gray-400 uppercase mb-2 mr-1">المعمل</label>
                    <select id="create-factory" class="w-full bg-[#F2F4F3] px-4 py-3 text-sm font-bold text-[#3F524C] focus:ring-2 focus:ring-[#C19A5B] outline-none transition-all disabled:opacity-50">
                        <option value="">اختر المعمل...</option>
                    </select>
                </div>

                <div>
                    <label class="block text-[10px] font-black text-gray-400 uppercase mb-2 mr-1">المورد (اختياري)</label>
                    <select id="create-supplier" class="w-full bg-[#F2F4F3] px-4 py-3 text-sm font-bold text-[#3F524C] focus:ring-2 focus:ring-[#C19A5B] outline-none transition-all">
                        <option value="">اختر المورد...</option>
                    </select>
                </div>
            </div>

            <div class="bg-white border border-gray-200 p-5 space-y-4">
                <div class="relative">
                    <label class="block text-[10px] font-black text-gray-400 uppercase mb-2 mr-1">إضافة منتج</label>
                    <div class="flex gap-2">
                        <input type="text" id="product-input" oninput="fetchSuggestions(this.value)" placeholder="ابحث أو اكتب اسم المنتج..." class="flex-1 bg-[#F2F4F3] px-4 py-3 text-sm font-bold text-[#3F524C] placeholder-gray-300 focus:ring-2 focus:ring-[#C19A5B] outline-none transition-all">
                        <button onclick="addProductToList()" class="bg-[#C19A5B] text-white p-3 active:scale-95 transition-all">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>
                        </button>
                    </div>
                    <div id="suggestions-box" class="absolute top-full left-0 right-0 z-[60] mt-2 bg-white border border-gray-200 overflow-hidden hidden max-h-48 overflow-y-auto"></div>
                </div>

                <div id="new-list-items" class="space-y-2 max-h-64 overflow-y-auto">
                    <p class="text-center text-xs font-bold text-gray-400 py-4">لم يتم إضافة منتجات بعد</p>
                </div>
            </div>

            <button onclick="submitNewList()" id="submit-btn" class="w-full bg-[#C19A5B] text-white py-4 font-black active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50">
                ترحيل القائمة
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 7-7 7 7"/><path d="M12 19V5"/></svg>
            </button>
        </div>
    </main>

    <nav class="fixed bottom-0 left-0 right-0 z-[100] bg-[#3F524C] px-6 py-3 flex items-center justify-around pb-safe">
        <button onclick="switchTab('pending')" id="nav-pending" class="flex flex-col items-center gap-1 tab-active transition-all active:scale-90">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 12h.01"/><path d="M16 6V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><path d="M22 13a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2Z"/><path d="M2 13a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2"/><path d="M12 12v6"/></svg>
            <span class="text-[9px] font-black">المعلقة</span>
        </button>
        <button onclick="switchTab('create')" id="nav-create" class="flex flex-col items-center gap-1 tab-inactive transition-all active:scale-90">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v8"/><path d="M8 12h8"/></svg>
            <span class="text-[9px] font-black">إنشاء</span>
        </button>
        <button onclick="switchTab('completed')" id="nav-completed" class="flex flex-col items-center gap-1 tab-inactive transition-all active:scale-90">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 11 3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
            <span class="text-[9px] font-black">المكتملة</span>
        </button>
    </nav>

    <div id="calendar-modal" class="fixed inset-0 z-[300] bg-black/30 hidden flex items-end justify-center animate-fade-in">
        <div class="bg-white w-full max-w-sm rounded-t-2xl p-6 animate-slide-up shadow-xl" onclick="event.stopPropagation()">
            <div class="flex items-center justify-between mb-6">
                <button onclick="closeCalendar()" class="p-2 text-gray-400 hover:text-gray-600 transition-all">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
                </button>
                <h3 class="text-sm font-black text-[#3F524C]">اختر التاريخ</h3>
                <button onclick="clearDate()" class="text-[10px] font-bold text-gray-400 hover:text-[#C19A5B] transition-all">إلغاء</button>
            </div>
            <!-- Calendar Header -->
            <div class="flex items-center justify-between mb-4">
                <button onclick="prevMonth()" class="p-2 text-gray-400 hover:text-[#3F524C] transition-all">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                </button>
                <span id="calendar-header" class="text-base font-black text-[#3F524C]"></span>
                <button onclick="nextMonth()" class="p-2 text-gray-400 hover:text-[#3F524C] transition-all">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                </button>
            </div>
            <!-- Weekday Headers -->
            <div class="grid grid-cols-7 mb-2">
                <div class="text-center text-[10px] font-bold text-gray-400 py-1">ح</div>
                <div class="text-center text-[10px] font-bold text-gray-400 py-1">ن</div>
                <div class="text-center text-[10px] font-bold text-gray-400 py-1">ث</div>
                <div class="text-center text-[10px] font-bold text-gray-400 py-1">ر</div>
                <div class="text-center text-[10px] font-bold text-gray-400 py-1">خ</div>
                <div class="text-center text-[10px] font-bold text-gray-400 py-1">ج</div>
                <div class="text-center text-[10px] font-bold text-gray-400 py-1">س</div>
            </div>
            <!-- Days Grid -->
            <div id="calendar-days" class="grid grid-cols-7 gap-1"></div>
        </div>
    </div>

    <div id="upload-overlay" class="fixed inset-0 z-[200] bg-[#F2F4F3] hidden flex flex-col items-center justify-center animate-fade-in">
        <div id="upload-status-icon" class="w-16 h-16 bg-white border border-gray-200 flex items-center justify-center mb-4"></div>
        <p id="upload-text" class="font-black text-[#3F524C]">جاري الرفع...</p>
    </div>

    <div id="image-viewer" class="fixed inset-0 z-[400] bg-[#F2F4F3] hidden flex flex-col animate-fade-in">
        <div class="flex items-center justify-between px-6 py-5 border-b border-gray-200 bg-white">
            <h3 id="viewer-title" class="font-black text-[#3F524C] truncate max-w-[70%]">معاينة المنتج</h3>
            <button onclick="closeViewer()" class="p-2 bg-[#F2F4F3] text-gray-400 active:scale-90 transition-all">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
        </div>
        <div class="flex-1 flex items-center justify-center p-6">
            <div class="bg-white border border-gray-200 p-2 w-full max-w-sm aspect-square flex items-center justify-center overflow-hidden relative">
                <img id="viewer-img" src="" alt="" class="w-full h-full object-contain">
                <div id="no-image-text" class="hidden text-center flex flex-col items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-gray-300 mb-3"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                    <p class="font-black text-gray-400 text-sm">الصورة غير متوفرة</p>
                </div>
            </div>
        </div>
    </div>
        <button id="close-overlay" class="mt-8 px-8 py-3 bg-[#C19A5B] text-white font-bold hidden">موافق</button>
    </div>

    <div id="compile-sheet" class="fixed inset-0 z-[400] bg-black/30 hidden flex items-end justify-center animate-fade-in" onclick="closeCompileSheet()">
        <div class="bg-white w-full max-w-sm rounded-t-2xl p-6 animate-slide-up shadow-xl" onclick="event.stopPropagation()">
            <div class="flex items-center justify-between mb-6">
                <div></div>
                <h3 class="text-sm font-black text-[#3F524C]">تجميع القائمة</h3>
                <button onclick="closeCompileSheet()" class="p-1 text-gray-400 hover:text-gray-600 transition-all">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
                </button>
            </div>
            <div class="space-y-3">
                <button onclick="compileOnPC()" class="w-full bg-[#3F524C] text-white py-5 px-4 font-black text-sm active:scale-[0.98] transition-all flex items-center gap-4 rounded-xl">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="8" x="5" y="2" rx="2"/><rect width="20" height="8" x="2" y="14" rx="2"/><path d="M6 18h2"/><path d="M16 18h2"/></svg>
                    تجميع في الحاسوب
                </button>
                <button onclick="downloadToPhone()" id="download-btn" class="w-full bg-[#C19A5B] text-white py-5 px-4 font-black text-sm active:scale-[0.98] transition-all flex items-center gap-4 rounded-xl">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    تنزيل إلى الهاتف
                </button>
            </div>
        </div>
    </div>

    <div id="toast" class="fixed top-4 left-1/2 -translate-x-1/2 z-[500] bg-[#3F524C] text-white px-5 py-3 text-sm font-bold shadow-lg hidden animate-fade-in"></div>

    <script>
        const state = { 
            tab: 'pending', 
            view: 'lists', 
            lists: [], 
            selectedList: null, 
            uploading: {}, 
            newList: { country: '', factory: '', supplier: '', rows: [] }, 
            suggestions: [],
            selectedDate: null,
            calendarOpen: false,
            calendarMonth: new Date().getMonth(),
            calendarYear: new Date().getFullYear()
        };
        const elements = {
            loading: document.getElementById('loading'),
            listsView: document.getElementById('lists-view'),
            listsContainer: document.getElementById('lists-container'),
            productsView: document.getElementById('products-view'),
            productsContainer: document.getElementById('products-container'),
            createView: document.getElementById('create-view'),
            backBtn: document.getElementById('back-btn'),
            viewTitle: document.getElementById('view-title'),
            listTitle: document.getElementById('current-list-title'),
            listCountry: document.getElementById('current-list-country'),
            listFactory: document.getElementById('current-list-factory'),
            suggestionsBox: document.getElementById('suggestions-box'),
            newListItems: document.getElementById('new-list-items'),
            createCountry: document.getElementById('create-country'),
            createFactory: document.getElementById('create-factory'),
            createSupplier: document.getElementById('create-supplier'),
            monthFilter: document.getElementById('month-filter-container'),
            calendarModal: document.getElementById('calendar-modal'),
            calendarDays: document.getElementById('calendar-days'),
            calendarHeader: document.getElementById('calendar-header'),
            imageViewer: document.getElementById('image-viewer'),
            viewerImg: document.getElementById('viewer-img'),
            viewerTitle: document.getElementById('viewer-title'),
            noImageText: document.getElementById('no-image-text')
        };

        async function switchTab(tab) {
            state.tab = tab;
            state.selectedList = null;
            ['pending', 'create', 'completed'].forEach(t => {
                const nav = document.getElementById('nav-' + t);
                nav.classList.toggle('tab-active', t === tab);
                nav.classList.toggle('tab-inactive', t !== tab);
            });
            elements.listsView.classList.add('hidden');
            elements.productsView.classList.add('hidden');
            elements.createView.classList.add('hidden');
            elements.backBtn.classList.add('hidden');
            elements.monthFilter.classList.add('hidden');
            if (tab === 'pending') {
                elements.viewTitle.innerHTML = '<span class="w-2 h-6 bg-[#C19A5B] rounded-full"></span> القوائم المعلقة';
                fetchLists('/api/pending');
            } else if (tab === 'completed') {
                elements.viewTitle.innerHTML = '<span class="w-2 h-6 bg-[#C19A5B] rounded-full"></span> القوائم المكتملة';
                elements.monthFilter.classList.remove('hidden');
                fetchLists('/api/completed');
            } else if (tab === 'create') {
                elements.createView.classList.remove('hidden');
                loadMetadata();
            }
        }

        async function fetchLists(url) {
            elements.loading.classList.remove('hidden');
            try {
                const res = await fetch(url);
                state.lists = await res.json();
                renderLists();
            } catch (err) { console.error(err); }
            elements.loading.classList.add('hidden');
        }

        function renderLists() {
            elements.listsView.classList.remove('hidden');
            if (state.tab === 'completed') {
                renderMonthFilter();
                
                // Filter by selected date (day-level) or show all
                const filtered = (state.lists || []).filter(list => {
                    if (!state.selectedDate) return true;
                    const listDate = list.listDate || new Date(list.updatedAt).toISOString().split('T')[0];
                    return listDate === state.selectedDate;
                });

                if (filtered.length === 0) {
                    elements.listsContainer.innerHTML = \`
                        <div class="bg-white border border-gray-200 p-12 text-center animate-fade-in mt-4 flex flex-col items-center gap-4">
                            <div class="w-16 h-16 bg-[#F2F4F3] text-gray-300 flex items-center justify-center">
                                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/><path d="m9 16 2 2 4-4"/></svg>
                            </div>
                            <p class="text-sm font-bold text-gray-400">\${state.selectedDate ? 'لا توجد قوائم مكتملة لهذا التاريخ' : 'لا توجد قوائم مكتملة'}</p>
                        </div>
                    \`;
                    return;
                }

                // Group by date
                const groups = {};
                filtered.forEach(list => {
                    const d = list.listDate || new Date(list.updatedAt).toISOString().split('T')[0];
                    if (!groups[d]) groups[d] = [];
                    groups[d].push(list);
                });
                const sortedDates = Object.keys(groups).sort((a, b) => new Date(b) - new Date(a));
                
                elements.listsContainer.innerHTML = sortedDates.map(date => \`
                    <div class="mb-6">
                        <div class="sticky top-[72px] z-10 bg-white border-b border-gray-200 px-4 py-2 mb-3 flex items-center justify-between border-r-4 border-r-[#C19A5B]">
                            <span class="text-[10px] font-black text-[#3F524C] uppercase tracking-widest">\${new Date(date).toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                            <span class="text-[8px] font-bold text-gray-400 uppercase">\${groups[date].length} سجل</span>
                        </div>
                        <div class="space-y-3">
                            \${groups[date].map(list => \`
                                <div onclick="openItems(\${list.id})" class="bg-white border border-gray-200 p-5 flex items-center justify-between active:scale-[0.98] transition-all animate-fade-in">
                                    <div class="flex items-center gap-4">
                                        <div class="w-10 h-10 bg-[#F2F4F3] text-[#3F524C] flex items-center justify-center">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 11 3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                                        </div>
                                        <div>
                                            <h3 class="font-black text-[#3F524C] text-base leading-tight">\${list.supplier || list.title || 'بدون اسم'}</h3>
                                            <p class="text-[10px] font-bold text-gray-400 mt-1 uppercase tracking-tight">\${list.country || ''} • \${list.factory || ''} • \${(list.rows || []).length} سجل</p>
                                        </div>
                                    </div>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                                </div>
                            \`).join('')}
                        </div>
                    </div>
                \`).join('');
            } else {
                // Flat list for pending
                elements.listsContainer.innerHTML = (state.lists || []).length > 0 
                    ? state.lists.map(list => \`
                        <div onclick="openItems(\${list.id})" class="bg-white border border-gray-200 p-5 flex items-center justify-between active:scale-[0.98] transition-all animate-fade-in">
                            <div class="flex items-center gap-4">
                                <div class="w-10 h-10 bg-[#F2F4F3] text-[#3F524C] flex items-center justify-center">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 12h.01"/><path d="M16 6V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><path d="M22 13a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2Z"/><path d="M2 13a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2"/><path d="M12 12v6"/></svg>
                                </div>
                                <div>
                                    <h3 class="font-black text-[#3F524C] text-base leading-tight">\${list.supplier || list.title || 'بدون اسم'}</h3>
                                    <p class="text-[10px] font-bold text-gray-400 mt-1 uppercase tracking-tight">\${list.country || ''} • \${list.factory || ''} • \${(list.rows || []).length} سجل</p>
                                </div>
                            </div>
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                        </div>
                    \`).join('')
                    : '<div class="py-20 text-center text-gray-400 font-bold">لا توجد قوائم حالياً</div>';
            }
        }

        function renderMonthFilter() {
            const monthNames = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
            const displayText = state.selectedDate
                ? new Date(state.selectedDate + 'T00:00:00').toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' })
                : 'كل التواريخ';
            elements.monthFilter.innerHTML = \`
                <button onclick="openCalendar()" class="w-full bg-white border border-gray-200 py-4 px-6 flex items-center justify-between active:scale-[0.98] transition-all">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 bg-[#F2F4F3] text-[#C19A5B] flex items-center justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
                        </div>
                        <div class="flex flex-col items-start">
                            <span class="text-[10px] font-black text-gray-400 uppercase tracking-widest mr-1">تصفية الأرشيف</span>
                            <span id="filter-label" class="text-base font-black text-[#3F524C]">\${displayText}</span>
                        </div>
                    </div>
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                </button>
            \`;
        }

        function openCalendar() {
            state.calendarOpen = true;
            state.calendarMonth = state.selectedDate
                ? new Date(state.selectedDate + 'T00:00:00').getMonth()
                : new Date().getMonth();
            state.calendarYear = state.selectedDate
                ? new Date(state.selectedDate + 'T00:00:00').getFullYear()
                : new Date().getFullYear();
            elements.calendarModal.classList.remove('hidden');
            renderCalendar();
        }

        function closeCalendar() {
            state.calendarOpen = false;
            elements.calendarModal.classList.add('hidden');
        }

        function clearDate() {
            state.selectedDate = null;
            closeCalendar();
            renderMonthFilter();
            renderLists();
        }

        function prevMonth() {
            state.calendarMonth--;
            if (state.calendarMonth < 0) { state.calendarMonth = 11; state.calendarYear--; }
            renderCalendar();
        }

        function nextMonth() {
            state.calendarMonth++;
            if (state.calendarMonth > 11) { state.calendarMonth = 0; state.calendarYear++; }
            renderCalendar();
        }

        function renderCalendar() {
            const monthNames = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
            elements.calendarHeader.innerText = monthNames[state.calendarMonth] + ' ' + state.calendarYear;

            const firstDay = new Date(state.calendarYear, state.calendarMonth, 1).getDay();
            const daysInMonth = new Date(state.calendarYear, state.calendarMonth + 1, 0).getDate();
            const today = new Date();
            const todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');

            let html = '';
            // Empty cells before first day
            for (let i = 0; i < firstDay; i++) {
                html += '<div></div>';
            }
            // Day cells
            for (let d = 1; d <= daysInMonth; d++) {
                const dateStr = state.calendarYear + '-' + String(state.calendarMonth + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
                const isSelected = dateStr === state.selectedDate;
                const isToday = dateStr === todayStr;
                html += \`
                    <button onclick="selectDate('\${dateStr}')" class="aspect-square flex items-center justify-center text-xs font-bold rounded-full transition-all \${
                        isSelected ? 'bg-blue-600 text-white' : 
                        isToday ? 'bg-gray-100 text-[#3F524C] hover:bg-gray-200' : 
                        'text-gray-600 hover:bg-gray-100'
                    }">\${d}</button>
                \`;
            }
            elements.calendarDays.innerHTML = html;
        }

        function selectDate(dateStr) {
            state.selectedDate = dateStr;
            closeCalendar();
            renderMonthFilter();
            renderLists();
        }

        function openItems(listId) {
            const list = state.lists.find(l => l.id === listId);
            if (!list) return;
            state.selectedList = list;
            state.view = 'products'; // Update view state
            elements.listsView.classList.add('hidden');
            elements.productsView.classList.remove('hidden');
            elements.backBtn.classList.remove('hidden');
            elements.listTitle.innerText = list.supplier || list.title;
            elements.listCountry.innerText = list.country || '';
            elements.listFactory.innerText = list.factory || '';
            renderProducts();
        }

        function renderProducts() {
            elements.productsContainer.innerHTML = (state.selectedList?.rows || []).map((row, index) => \`
                <div id="row-\${row.id}" class="bg-white border border-gray-200 p-4 flex items-center justify-between transition-all animate-fade-in \${row.mobileCaptured ? 'active-row' : ''}">
                    <div class="flex-1 min-w-0 px-2 text-right flex items-center gap-2">
                        <span class="text-[10px] font-bold text-gray-300 min-w-[18px]">(\${index + 1})</span>
                        <div class="flex flex-col flex-1">
                            <p class="font-bold text-[#3F524C] text-sm whitespace-normal break-words leading-tight">\${row.value}</p>
                            \${row.photographed ? '<span class="text-[8px] font-bold text-gray-400 uppercase">تم التصوير في PC</span>' : ''}
                        </div>
                    </div>
                    <div class="flex items-center gap-1.5">
                        \${state.tab === 'pending' ? \`
                            <button onclick="viewProductImage('\${row.value.replace(/'/g, "\\\\'")}', '\${state.selectedList.country}', '\${state.selectedList.factory}')" class="shrink-0 w-8 h-8 bg-transparent text-gray-300 hover:text-gray-400 flex items-center justify-center active:scale-90 transition-all" title="عرض الصورة">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0z"/><circle cx="12" cy="12" r="3"/></svg>
                            </button>
                            \${row.photographed 
                                ? \`<span class="shrink-0 text-[10px] font-bold text-gray-400 bg-transparent">مصور</span>\`
                                : \`<button onclick="toggleCapture(\${state.selectedList.id}, \${row.id}, this)" class="shrink-0 flex items-center gap-1 px-2 py-1.5 text-xs font-black transition-all \${row.mobileCaptured ? 'text-[#C19A5B]' : 'text-gray-300 hover:text-gray-400'}"><span>\${row.mobileCaptured ? 'تم الالتقاط' : 'التقاط'}</span><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/></svg></button>\`
                            }
                            <label class="shrink-0 w-8 h-8 bg-transparent flex items-center justify-center text-[#C19A5B] hover:text-[#D4A373] active:scale-90 transition-all cursor-pointer \${state.uploading[row.id] ? 'opacity-50 pointer-events-none' : ''}" title="رفع الصور"><input type="file" class="hidden" accept="image/*" multiple onchange="handleFileUpload(this, \${row.id}, '\${row.value.replace(/'/g, "\\\\'")}')" \${state.uploading[row.id] ? 'disabled' : ''}>\${state.uploading[row.id] ? '<div class="w-4 h-4 border-2 border-[#C19A5B] border-t-transparent rounded-full animate-spin"></div>' : '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="pointer-events-none"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>'}</label>
                        \` : \`
                             <button onclick="viewProductImage('\${row.value.replace(/'/g, "\\\\'")}', '\${state.selectedList.country}', '\${state.selectedList.factory}')" class="shrink-0 w-8 h-8 bg-transparent text-gray-300 hover:text-gray-400 flex items-center justify-center active:scale-90 transition-all" title="عرض الصورة">
                                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0z"/><circle cx="12" cy="12" r="3"/></svg>
                             </button>
                             <span class="shrink-0 text-[10px] font-bold \${row.isUploaded ? 'text-[#3F524C]' : 'text-gray-300'}">\${row.isUploaded ? 'تم الرفع' : 'رفع'}</span>
                        \`}
                    </div>
                </div>
            \`).join('');
        }

        async function updateStatus(listId, rowId, update) {
            const btn = document.querySelector(\`#row-\${rowId} button\`);
            let originalContent = null;
            if (btn) {
                originalContent = btn.innerHTML;
                btn.innerHTML = '<div class="w-3 h-3 border-2 border-[#C19A5B] border-t-transparent rounded-full animate-spin mx-auto"></div>';
                btn.disabled = true;
            }

            // Optimistic Update
            const row = state.selectedList?.rows?.find(r => r.id === rowId);
            if (row) {
                Object.assign(row, update);
                if (update.mobileCaptured) row.photographed = true;
                renderProducts();
            }

            try {
                const res = await fetch('/api/update-global-status', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ listId, rowId, statusUpdate: update })
                });
                if (!res.ok) throw new Error('Sync failed');
            } catch (err) {
                console.error(err);
                alert('فشل المزامنة مع PC');
                if (row) { 
                    // Simple Rollback
                    if (update.mobileCaptured !== undefined) row.mobileCaptured = !update.mobileCaptured;
                    renderProducts(); 
                }
            }
        }

        async function toggleCapture(listId, rowId, btn) {
            const row = state.selectedList.rows.find(r => r.id === rowId);
            if (!row) return;
            updateStatus(listId, rowId, { mobileCaptured: !row.mobileCaptured });
        }

        function viewProductImage(productName, country, factory) {
            elements.viewerTitle.innerText = productName;
            elements.viewerImg.classList.add('hidden');
            elements.noImageText.classList.add('hidden');
            
            elements.viewerImg.onload = () => {
                elements.viewerImg.classList.remove('hidden');
                elements.noImageText.classList.add('hidden');
            };
            
            elements.viewerImg.onerror = () => {
                elements.viewerImg.classList.add('hidden');
                elements.noImageText.classList.remove('hidden');
            };

            elements.viewerImg.src = \`/api/view-image?productName=\${encodeURIComponent(productName)}&country=\${encodeURIComponent(country)}&factory=\${encodeURIComponent(factory)}\`;
            elements.imageViewer.classList.remove('hidden');
        }

        function closeViewer() {
            elements.imageViewer.classList.add('hidden');
            elements.viewerImg.src = '';
            elements.viewerImg.classList.add('hidden');
            elements.noImageText.classList.add('hidden');
        }
        async function handleFileUpload(input, rowId, productName) {
            if (!input.files || input.files.length === 0) return;
            const res = await fetch('/api/mobile-settings');
            const settings = await res.json();
            if (!settings.mobileUploadPath) { alert('ضبط المسار في PC أولاً'); return; }
            state.uploading[rowId] = true; renderProducts();
            const files = Array.from(input.files); input.value = '';
            try {
                const formData = new FormData();
                formData.append('mobileUploadPath', settings.mobileUploadPath);
                formData.append('listName', state.selectedList.supplier || state.selectedList.title);
                formData.append('productName', productName);
                for (let file of files) formData.append('images', file);
                const upRes = await fetch('/api/upload-mobile-image', { method: 'POST', body: formData });
                if (upRes.ok) {
                    const row = state.selectedList.rows.find(r => r.id === rowId);
                    if (row && !row.mobileCaptured) toggleCapture(state.selectedList.id, rowId, document.querySelector(\`#row-\${rowId} button\`));
                }
            } catch (err) { console.error(err); } finally { state.uploading[rowId] = false; renderProducts(); }
        }

        async function toggleCapture(listId, rowId, btn) {
            const row = state.selectedList.rows.find(r => r.id === rowId);
            if (!row) return;
            row.mobileCaptured = !row.mobileCaptured;
            if (btn) {
                const container = document.getElementById(\`row-\${rowId}\`);
                container.classList.toggle('active-row', row.mobileCaptured);
                btn.classList.toggle('bg-[#C19A5B]', row.mobileCaptured);
                btn.classList.toggle('text-white', row.mobileCaptured);
                btn.querySelector('span').innerText = row.mobileCaptured ? 'تم الالتقاط' : 'التقاط';
            }
            fetch('/api/capture', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ listId, rowId, mobileCaptured: row.mobileCaptured }) });
        }

        async function loadMetadata() {
            try {
                const res = await fetch('/api/metadata');
                const data = await res.json();
                elements.createCountry.innerHTML = '<option value="">اختر البلد...</option>' + data.countries.map(c => \`<option value="\${c}">\${c}</option>\`).join('');
                elements.createSupplier.innerHTML = '<option value="">اختر المورد...</option>' + data.suppliers.map(s => \`<option value="\${s.name}">\${s.name}</option>\`).join('');
            } catch (err) { console.error(err); }
        }

        async function loadFactories(country) {
            if (!country) return;
            try {
                const res = await fetch('/api/factories/' + country);
                const factories = await res.json();
                elements.createFactory.innerHTML = '<option value="">اختر المعمل...</option><option value="الكل">الكل</option>' + factories.map(f => \`<option value="\${f}">\${f}</option>\`).join('');
            } catch (err) { console.error(err); }
        }

        async function fetchSuggestions(q) {
            if (!q || q.length < 2) { elements.suggestionsBox.classList.add('hidden'); return; }
            
            const country = elements.createCountry.value;

            try {
                const res = await fetch(\`/api/suggestions?q=\${encodeURIComponent(q)}&country=\${encodeURIComponent(country)}\`);
                let results = await res.json();
                
                state.suggestions = results;

                if (state.suggestions.length > 0) {
                    elements.suggestionsBox.innerHTML = state.suggestions.map(s => \`
                        <div onclick="selectSuggestion('\${s.name.replace(/'/g, "\\\\'")}', \${s.photographed})" class="p-4 border-b border-gray-200 active:bg-[#F2F4F3] flex items-center justify-between">
                            <span class="font-bold text-sm text-[#3F524C]">\${s.name}</span>
                            \${s.photographed ? '<span class="text-[8px] bg-[#F2F4F3] text-gray-400 px-2 py-1 font-black uppercase tracking-tight">مصور</span>' : ''}
                        </div>
                    \`).join('');
                    elements.suggestionsBox.classList.remove('hidden');
                } else elements.suggestionsBox.classList.add('hidden');
            } catch (err) { console.error(err); }
        }

        function selectSuggestion(name, photographed) {
            document.getElementById('product-input').value = name;
            elements.suggestionsBox.classList.add('hidden');
            addProductToList(photographed);
        }

        function addProductToList(globalPhotographed = false) {
            const input = document.getElementById('product-input');
            const name = input.value.trim(); if (!name) return;
            state.newList.rows.push({ id: Date.now(), value: name, photographed: globalPhotographed, mobileCaptured: false, uploaded: false });
            input.value = ''; renderNewListItems();
        }

        function renderNewListItems() {
            elements.newListItems.innerHTML = state.newList.rows.length > 0
                ? state.newList.rows.map(row => \`
                    <div class="flex items-center justify-between p-3 bg-white border border-gray-200 animate-fade-in mb-2">
                        <div class="flex items-center gap-2 overflow-hidden">
                            <span class="text-xs font-bold text-[#3F524C] truncate">\${row.value}</span>
                            \${row.photographed ? '<span class="text-[8px] bg-[#F2F4F3] text-gray-400 px-1 font-black">✓ مصور</span>' : ''}
                        </div>
                        <div class="flex items-center gap-2">
                            <button onclick="viewProductImage('\${row.value.replace(/'/g, "\\\\'")}', '\${elements.createCountry.value}', '\${elements.createFactory.value}')" class="w-8 h-8 bg-[#F2F4F3] text-gray-400 flex items-center justify-center active:scale-90 transition-all">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0z"/><circle cx="12" cy="12" r="3"/></svg>
                            </button>
                            <button onclick="removeProductFromList(\${row.id})" class="w-8 h-8 bg-[#F2F4F3] text-red-300 flex items-center justify-center active:scale-90 transition-all">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
                            </button>
                        </div>
                    </div>
                \`).reverse().join('')
                : '<p class="text-center text-xs font-bold text-gray-400 py-4">لا يوجد منتجات في القائمة الحالية</p>';
        }

        function removeProductFromList(id) { state.newList.rows = state.newList.rows.filter(r => r.id !== id); renderNewListItems(); }

        async function submitNewList() {
            const country = elements.createCountry.value, 
                  factory = elements.createFactory.value, 
                  supplier = elements.createSupplier.value;
            
            if (!country || state.newList.rows.length === 0) { 
                alert('يرجى إكمال البيانات (البلد وقائمة المنتجات)'); 
                return; 
            }
            
            const btn = document.getElementById('submit-btn'); 
            btn.disabled = true; 
            btn.innerHTML = '<div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto"></div>';
            
            try {
                const res = await fetch('/api/create-list', { 
                    method: 'POST', 
                    headers: { 'Content-Type': 'application/json' }, 
                    body: JSON.stringify({ country, factory, supplier, rows: state.newList.rows, status: 'pending' }) 
                });
                
                if (res.ok) { 
                    alert('تم ترحيل القائمة بنجاح!'); 
                    // Reset Logic
                    state.newList.rows = [];
                    elements.createCountry.value = '';
                    elements.createFactory.value = '';
                    elements.createSupplier.value = '';
                    document.getElementById('product-input').value = '';
                    renderNewListItems();
                    switchTab('pending'); 
                } else {
                    alert('فشل ترحيل القائمة. تأكد من اتصال الـ PC');
                }
            } catch (err) { 
                console.error(err); 
                alert('حدث خطأ في الشبكة');
            } finally { 
                btn.disabled = false; 
                btn.innerText = 'ترحيل القائمة'; 
            }
        }

        function showToast(msg, isError) {
            const t = document.getElementById('toast');
            t.textContent = msg;
            t.className = 'fixed top-4 left-1/2 -translate-x-1/2 z-[500] px-5 py-3 text-sm font-bold shadow-lg animate-fade-in ' + (isError ? 'bg-red-600 text-white' : 'bg-[#3F524C] text-white');
            t.classList.remove('hidden');
            setTimeout(() => t.classList.add('hidden'), 3000);
        }

        function showCompileSheet() {
            const list = state.selectedList;
            if (!list || !list.rows || list.rows.length === 0) { showToast('لا توجد منتجات في القائمة', true); return; }
            document.getElementById('compile-sheet').classList.remove('hidden');
        }

        function closeCompileSheet() {
            document.getElementById('compile-sheet').classList.add('hidden');
        }

        async function compileOnPC() {
            const list = state.selectedList;
            closeCompileSheet();
            const btn = document.getElementById('compile-btn');
            btn.disabled = true; btn.innerHTML = '<div class="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto"></div>';
            try {
                const res = await fetch('/api/compile-list', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        listName: list.supplier || list.title || 'قائمة',
                        country: list.country,
                        factory: list.factory,
                        products: list.rows
                    })
                });
                const result = await res.json();
                if (res.ok && result.success > 0) {
                    showToast('تم تجميع ' + result.success + ' صورة بنجاح في:\\n' + result.path);
                } else if (res.ok && result.success === 0) {
                    showToast('لم يتم العثور على صور لتجميعها', true);
                } else {
                    showToast(result.error || 'فشلت عملية التجميع', true);
                }
            } catch (err) {
                showToast('حدث خطأ في الاتصال', true);
            } finally {
                btn.disabled = false;
                btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M12 12v9"/><path d="m8 17 4 4 4-4"/></svg> تجميع';
            }
        }

        async function downloadToPhone() {
            const list = state.selectedList;
            closeCompileSheet();
            const btn = document.getElementById('download-btn');
            const originalHtml = btn.innerHTML;
            btn.disabled = true; btn.innerHTML = '<div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto"></div>';
            try {
                const res = await fetch('/api/download-list', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        listName: list.supplier || list.title || 'قائمة',
                        country: list.country,
                        factory: list.factory,
                        products: list.rows
                    })
                });
                const contentType = res.headers.get('Content-Type') || '';
                if (!res.ok || contentType.includes('json')) {
                    const errData = contentType.includes('json') ? await res.json().catch(() => ({})) : {};
                    showToast(errData.error || 'فشل تحميل الملف', true);
                    return;
                }
                const blob = await res.blob();
                if (blob.size === 0) {
                    showToast('الملف فارغ، لم يتم العثور على صور', true);
                    return;
                }
                const disposition = res.headers.get('Content-Disposition') || '';
                const match = disposition.match(/filename="?(.+?)"?$/);
                const filename = match ? match[1] : (list.supplier || list.title || 'قائمة') + '.zip';
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                showToast('تم تحميل الملف بنجاح');
            } catch (err) {
                showToast('حدث خطأ في التحميل: ' + err.message, true);
            } finally {
                btn.disabled = false;
                btn.innerHTML = originalHtml;
            }
        }

        elements.backBtn.onclick = () => { 
            state.view = 'lists'; 
            elements.productsView.classList.add('hidden'); 
            elements.listsView.classList.remove('hidden'); 
            elements.backBtn.classList.add('hidden'); 
        };

        // Real-Time Polling for Instant PC Sync
        setInterval(async () => {
            if (state.tab === 'create') return;
            try {
                const url = state.tab === 'pending' ? '/api/pending' : '/api/completed';
                const res = await fetch(url);
                const lists = await res.json();
                state.lists = lists;
                
                // If viewing a specific list, update its local row data
                if (state.selectedList) {
                    const updated = (lists || []).find(l => l.id === state.selectedList.id);
                    if (updated) {
                        state.selectedList = updated;
                        if (state.view === 'products') renderProducts();
                    }
                }
                
                if (state.view === 'lists') renderLists();
            } catch (err) { console.error('Poll Error:', err); }
        }, 5000);

        switchTab('pending');
    </script>
    </div>
</body>
</html>`;

const EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

// Deep recursive image search — traverses ALL subdirectories regardless of depth
function findImageSmart(dir, name) {
    if (!fs.existsSync(dir)) return null;
    try {
        const entries = fs.readdirSync(dir, { withFileTypes: true, recursive: true });
        const targetNameClean = String(name).trim().normalize('NFC').toLowerCase();
        for (const entry of entries) {
            if (entry.isFile()) {
                const parentDir = entry.parentPath || entry.path;
                const parsed = path.parse(entry.name);
                const itemNameClean = parsed.name.trim().normalize('NFC').toLowerCase();
                if (itemNameClean === targetNameClean && EXTENSIONS.includes(parsed.ext.toLowerCase())) {
                    return path.join(parentDir, entry.name);
                }
            }
        }
    } catch (err) {
        console.warn(`[findImageSmart] Error scanning ${dir}:`, err.message);
    }
    return null;
}

function httpGetBuffer(url) {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? require('https') : require('http');
        const parsedUrl = new URL(url);
        const opts = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || (url.startsWith('https') ? 443 : 80),
            path: parsedUrl.pathname + parsedUrl.search,
            method: 'GET',
            headers: { 'User-Agent': 'FocusStudio' }
        };
        const req = protocol.request(opts, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                res.resume();
                const redirectUrl = new URL(res.headers.location, url).href;
                return resolve(httpGetBuffer(redirectUrl));
            }
            if (res.statusCode !== 200) {
                res.resume();
                return reject(new Error('HTTP ' + res.statusCode));
            }
            const chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => resolve(Buffer.concat(chunks)));
        });
        req.on('error', reject);
        req.end();
    });
}

function compareVersions(v1, v2) {
    const p1 = v1.split('.').map(Number);
    const p2 = v2.split('.').map(Number);
    for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
        const n1 = p1[i] || 0;
        const n2 = p2[i] || 0;
        if (n1 > n2) return 1;
        if (n1 < n2) return -1;
    }
    return 0;
}

function startServer(mainWindow) {
    const app = express();
    const port = 3000;

    app.use(cors());
    app.use(express.json());

    // Serve Product Repository Statics
    const root = db.getRootFolder();
    if (root && fs.existsSync(root)) {
        app.use('/repository', express.static(root));
        console.log(`📂 Product repository served from: ${root}`);
    }


    // Health Check / Root Route
    app.get('/', (req, res) => {
        res.send('✅ Mobile Server is Alive and Working!');
    });

    app.get('/api/health', (req, res) => {
        res.json({ status: "ok" });
    });

    app.get('/api/view-image', (req, res) => {
        console.log('GET /api/view-image', req.query);
        try {
            const { productName, country, factory } = req.query;
            const root = db.getRootFolder();
            if (!root || !productName || !country) {
                return res.status(400).send('Missing parameters');
            }

            // Robust decoding and normalization for Arabic/Spaces
            // Express already URL-decodes query params, but normalize NFC for Arabic
            const decodedName = String(productName).trim().normalize('NFC');
            const decodedCountry = String(country).trim().normalize('NFC');
            const decodedFactory = factory ? String(factory).trim().normalize('NFC') : '';

            let match = null;

            // Level 1: Search in the specified factory folder first (fastest, most precise)
            if (decodedFactory && decodedFactory !== 'الكل') {
                const primaryPath = path.join(root, decodedCountry, decodedFactory);
                match = findImageSmart(primaryPath, decodedName);
            }

            // Level 2: Cross-factory fallback — search ALL factory folders within the country
            if (!match) {
                const countryPath = path.join(root, decodedCountry);
                match = findImageSmart(countryPath, decodedName);
            }

            // Level 3: Global fallback — search all countries in the root folder
            if (!match) {
                match = findImageSmart(root, decodedName);
            }

            if (match) {
                res.sendFile(match);
            } else {
                console.log(`[view-image] Not found: "${decodedName}" in country="${decodedCountry}" factory="${decodedFactory}"`);
                res.status(404).send('Image not found');
            }
        } catch (err) {
            console.error('View Image Error:', err);
            res.status(500).json({ error: err.message });
        }
    });

    app.patch('/api/update-global-status', async (req, res) => {
        console.log('PATCH /api/update-global-status');
        try {
            const { listId, rowId, statusUpdate } = req.body;
            const data = db.getData();
            const list = data.lists.find(l => l.id === listId);
            if (!list) return res.status(404).json({ error: 'List not found' });
            
            const row = (list.rows || []).find(r => r.id === rowId);
            if (!row) return res.status(404).json({ error: 'Row not found' });

            const productName = row.value;

            if (statusUpdate.mobileCaptured) {
                statusUpdate.photographed = true;
            }
            if (statusUpdate.isUploaded !== undefined) {
                statusUpdate.uploaded = statusUpdate.isUploaded;
            }

            db.toggleProductStatus(
                productName,
                statusUpdate.mobileCaptured,
                statusUpdate.photographed,
                statusUpdate.uploaded
            );

            data.lists.forEach(l => {
                (l.rows || []).forEach(r => {
                    if (r.value === productName) {
                        if (statusUpdate.mobileCaptured !== undefined) r.mobileCaptured = statusUpdate.mobileCaptured;
                        if (statusUpdate.photographed !== undefined) r.photographed = statusUpdate.photographed;
                        if (statusUpdate.isUploaded !== undefined) r.isUploaded = statusUpdate.isUploaded;
                        if (statusUpdate.uploaded !== undefined) r.uploaded = statusUpdate.uploaded;
                        if (r.mobileCaptured) r.photographed = true;
                    }
                });
            });

            db.saveData(data);
            
            if (mainWindow) {
                mainWindow.webContents.send('trigger-sync');
            }
            res.json({ success: true });
        } catch (error) {
            console.error('Update Global Status Error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    app.patch('/api/update-row-status', async (req, res) => {
        // Redirect old endpoint to the new unified sync system
        const { listId, rowId, field, value } = req.body;
        const statusUpdate = { [field]: value };
        req.body.statusUpdate = statusUpdate;
        
        // Inline logic for simplicity
        try {
            const data = db.getData();
            const list = data.lists.find(l => l.id === listId);
            const row = (list.rows || []).find(r => r.id === rowId);
            if (!row) return res.status(404).json({ error: 'Row not found' });
            Object.assign(row, statusUpdate);
            if (row.mobileCaptured) row.photographed = true;
            db.toggleProductStatus(row.value, row.mobileCaptured, row.photographed, row.uploaded || row.isUploaded);
            data.lists.forEach(l => {
                (l.rows || []).forEach(r => {
                    if (r.value === row.value) {
                        if (statusUpdate.mobileCaptured !== undefined) r.mobileCaptured = statusUpdate.mobileCaptured;
                        if (statusUpdate.photographed !== undefined) r.photographed = statusUpdate.photographed;
                        if (statusUpdate.isUploaded !== undefined) r.isUploaded = statusUpdate.isUploaded;
                        if (statusUpdate.uploaded !== undefined) r.uploaded = statusUpdate.uploaded;
                        if (r.mobileCaptured) r.photographed = true;
                    }
                });
            });
            db.saveData(data);
            if (mainWindow) mainWindow.webContents.send('trigger-sync');
            res.json({ success: true });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // Mobile UI Route
    app.get('/app', (req, res) => {
        res.send(MOBILE_HTML);
    });

    // API: Get Pending Lists (With Global Status Sync)
    app.get('/api/pending', async (req, res) => {
        try {
            const data = db.getData();
            const lists = (data.lists || []).filter(l => l.status === 'pending');
            
            // Source of Truth Sync
            const sanitized = lists.map(list => ({
                ...list,
                rows: (list.rows || []).map(row => {
                    const global = data.products.find(p => p.name === row.value);
                    const isUploaded = global ? (!!global.uploaded || !!global.isUploaded) : (!!row.uploaded || !!row.isUploaded);
                    return {
                        ...row,
                        uploaded: isUploaded,
                        isUploaded: isUploaded,
                        photographed: global ? !!global.photographed : !!row.photographed,
                        mobileCaptured: global ? !!global.mobileCaptured : !!row.mobileCaptured
                    };
                })
            }));
            res.json(sanitized);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // API: Get Completed Lists (With Global Status Sync)
    app.get('/api/completed', async (req, res) => {
        try {
            const data = db.getData();
            const lists = (data.lists || []).filter(l => l.status === 'completed');
            
            // Source of Truth Sync
            const sanitized = lists.map(list => ({
                ...list,
                rows: (list.rows || []).map(row => {
                    const global = data.products.find(p => p.name === row.value);
                    const isUploaded = global ? (!!global.uploaded || !!global.isUploaded) : (!!row.uploaded || !!row.isUploaded);
                    return {
                        ...row,
                        uploaded: isUploaded,
                        isUploaded: isUploaded,
                        photographed: global ? !!global.photographed : !!row.photographed,
                        mobileCaptured: global ? !!global.mobileCaptured : !!row.mobileCaptured
                    };
                })
            }));
            res.json(sanitized);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // API: Get Global Suggestions
    app.get('/api/suggestions', async (req, res) => {
        const query = (req.query.q || '').toLowerCase();
        const country = req.query.country;
        const factory = req.query.factory;

        try {
            const data = db.getData();
            let suggestions = [];

            if (country) {
                // Search filesystem images in the entire country directory (recursive)
                const countryImages = db.listImagesInCountry(country);
                suggestions = countryImages
                    .filter(img => img.name.toLowerCase().includes(query))
                    .map(img => {
                        const global = data.products.find(p => p.name === img.name);
                        return {
                            name: img.name,
                            factory: img.factory,
                            photographed: global ? !!global.photographed : false
                        };
                    });
            }

            // If no country or no filesystem results, fallback to global product list
            if (suggestions.length === 0) {
                suggestions = data.products
                    .filter(p => p.name.toLowerCase().includes(query))
                    .map(p => ({
                        name: p.name,
                        factory: p.factory || '',
                        photographed: !!p.photographed
                    }));
            }

            res.json(suggestions.slice(0, 10));
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // API: Get Metadata (Countries, Factories, Suppliers)
    app.get('/api/metadata', async (req, res) => {
        try {
            const countries = db.listCountries();
            const suppliers = db.getSuppliers();
            res.json({ countries, suppliers });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    app.get('/api/factories/:country', async (req, res) => {
        try {
            const factories = db.listFactoriesInCountry(req.params.country);
            res.json(factories);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // API: Get Mobile Settings
    app.get('/api/mobile-settings', async (req, res) => {
        try {
            const path = db.getMobileUploadPath();
            res.json({ mobileUploadPath: path });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // API: Upload Mobile Image
    app.post('/api/upload-mobile-image', upload.array('images'), async (req, res) => {
        try {
            res.json({ success: true, files: req.files });
        } catch (error) {
            console.error('Upload Error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // API: Compile/Collect List Images (Mobile trigger matching desktop fs:collect-images-process)
    app.post('/api/compile-list', async (req, res) => {
        console.log('POST /api/compile-list');
        try {
            const { listName, country, factory, products } = req.body;
            const root = db.getRootFolder();
            const baseCollection = db.getCollectionFolder();

            if (!root || !baseCollection) {
                return res.status(400).json({ error: 'Paths not configured. Please set root and collection folders in Settings.' });
            }

            let targetName = (listName || 'New Collection').replace(/[\\/:*?"<>|]/g, '_');
            let targetPath = path.join(baseCollection, targetName);
            let counter = 1;
            while (fs.existsSync(targetPath)) {
                targetPath = path.join(baseCollection, targetName + '_' + counter);
                counter++;
            }

            fs.mkdirSync(targetPath, { recursive: true });

            const searchBase = (!factory || factory === 'الكل')
                ? path.join(root, country)
                : path.join(root, country, factory);

            const result = { success: 0, total: products.length, path: targetPath };

            for (let i = 0; i < products.length; i++) {
                const productName = products[i].value || products[i].name;
                if (!productName) continue;

                const sourcePath = findImageSmart(searchBase, productName);
                if (sourcePath) {
                    const ext = path.extname(sourcePath);
                    const destPath = path.join(targetPath, (i + 1) + ext);
                    fs.copyFileSync(sourcePath, destPath);
                    result.success++;
                }
            }

            console.log('[Compile] Done:', result);
            res.json(result);
        } catch (error) {
            console.error('Compile Error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // API: Download List as ZIP (reuses findImageSmart for locating images)
    app.post('/api/download-list', async (req, res) => {
        console.log('POST /api/download-list');
        try {
            const { listName, country, factory, products } = req.body;
            if (!country) {
                return res.status(400).json({ error: 'Country is required.' });
            }
            const root = db.getRootFolder();
            if (!root) {
                return res.status(400).json({ error: 'Root folder not configured.' });
            }
            if (!products || !Array.isArray(products) || products.length === 0) {
                return res.status(400).json({ error: 'No products in list.' });
            }

            const searchBase = (!factory || factory === 'الكل')
                ? path.join(root, country)
                : path.join(root, country, factory);

            const safeName = (listName || 'checklist').replace(/[\\/:*?"<>|]/g, '_');

            // Pre-scan: decode paths safely and verify existence BEFORE setting headers
            const validFiles = [];
            for (let i = 0; i < products.length; i++) {
                const productName = products[i].value || products[i].name;
                if (!productName) continue;

                const sourcePath = findImageSmart(searchBase, productName);
                if (!sourcePath) continue;

                let decodedPath;
                try {
                    decodedPath = decodeURIComponent(sourcePath);
                } catch {
                    // Not URI-encoded; use as-is
                    decodedPath = sourcePath;
                }

                if (!fs.existsSync(decodedPath)) {
                    console.warn('[Download] Skipping missing file: ' + decodedPath);
                    continue;
                }

                validFiles.push({ path: decodedPath, index: i });
            }

            if (validFiles.length === 0) {
                return res.status(404).json({ error: 'لم يتم العثور على صور للتحميل' });
            }

            res.setHeader('Content-Type', 'application/zip');
            res.setHeader('Content-Disposition', 'attachment; filename="' + safeName + '.zip"');

            const archive = archiver('zip', { zlib: { level: 5 } });

            // Fault-tolerant: log archiver errors but do NOT abort the stream
            archive.on('error', (err) => {
                console.warn('[Archiver Warning]', err.message);
            });

            archive.pipe(res);

            for (const { path: filePath, index } of validFiles) {
                const ext = path.extname(filePath);
                try {
                    archive.file(filePath, { name: (index + 1) + ext });
                } catch (err) {
                    console.warn('[Download] Skipping unreadable file: ' + filePath, err.message);
                }
            }

            await archive.finalize();
            console.log('[Download] Zipped ' + validFiles.length + ' images for ' + safeName);
        } catch (error) {
            console.error('[Download Error]', error.message);
            if (!res.headersSent) {
                res.status(500).json({ error: error.message });
            } else {
                // Headers already sent (streaming started); destroy the connection
                res.destroy();
            }
        }
    });

    // API: Internal OTA Update — download, extract, and replace production out/ files
    const DEFAULT_UPDATE_URL = 'https://raw.githubusercontent.com/antigravity/focus-studio/main/version.json';

    app.post('/api/check-internal-update', async (req, res) => {
        console.log('POST /api/check-internal-update');
        try {
            const { app } = require('electron');
            const pkgPath = path.join(app.getAppPath(), 'package.json');
            const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
            const currentVersion = pkg.version;

            // 1. Fetch remote version.json
            const versionUrl = DEFAULT_UPDATE_URL;
            console.log('[Update] Fetching version info from ' + versionUrl);
            const versionBuffer = await httpGetBuffer(versionUrl);
            const remote = JSON.parse(versionBuffer.toString('utf-8'));
            const remoteVersion = (remote.version || '').trim();

            if (!remoteVersion) {
                return res.json({ status: 'error', message: 'ملف الإصدارات البعيد غير صالح' });
            }

            if (compareVersions(remoteVersion, currentVersion) <= 0) {
                console.log('[Update] Already up to date: ' + currentVersion);
                return res.json({ status: 'uptodate', version: currentVersion });
            }

            // 2. Download update.zip
            const zipUrl = remote.zipUrl;
            if (!zipUrl) {
                return res.json({ status: 'error', message: 'رابط التحديث غير موجود في ملف الإصدارات' });
            }

            console.log('[Update] Downloading update from ' + zipUrl);
            const zipBuffer = await httpGetBuffer(zipUrl);
            if (zipBuffer.length === 0) {
                return res.json({ status: 'error', message: 'ملف التحديث فارغ' });
            }

            // 3. Extract to temp directory
            const appPath = app.getAppPath();
            const extractPath = path.join(appPath, 'update-tmp');
            if (fs.existsSync(extractPath)) {
                fse.removeSync(extractPath);
            }
            fs.mkdirSync(extractPath, { recursive: true });

            const zip = new AdmZip(Buffer.from(zipBuffer));
            zip.extractAllTo(extractPath, true);

            // 4. Verify extraction
            const extractedOut = path.join(extractPath, 'out');
            if (!fs.existsSync(path.join(extractedOut, 'main', 'index.js'))) {
                fse.removeSync(extractPath);
                return res.json({ status: 'error', message: 'ملف التحديث لا يحتوي على الملفات المطلوبة' });
            }

            // 5. Copy files to production out/
            const targetOut = path.join(appPath, 'out');
            await fse.copy(extractedOut, targetOut, { overwrite: true, errorOnExist: false });

            // 6. Clean up temp
            fse.removeSync(extractPath);

            console.log('[Update] Successfully updated from ' + currentVersion + ' to ' + remoteVersion);
            res.json({ status: 'success', version: remoteVersion, previousVersion: currentVersion });
        } catch (error) {
            console.error('[Update Error]', error.message);
            res.json({ status: 'error', message: error.message });
        }
    });

    app.post('/api/create-list', async (req, res) => {
        console.log('POST /api/create-list');
        try {
            const listData = req.body;
            const data = db.getData();
            
            const sanitizedRows = (listData.rows || []).map(row => {
                const globalProduct = data.products.find(p => p.name === row.value);
                return {
                    id: row.id || Date.now() + Math.random(),
                    value: row.value || '',
                    factory: row.factory || listData.factory || '',
                    country: row.country || listData.country || '',
                    photographed: globalProduct ? !!globalProduct.photographed : !!row.photographed,
                    uploaded: globalProduct ? !!globalProduct.uploaded : !!row.uploaded,
                    isUploaded: globalProduct ? !!globalProduct.uploaded : !!row.isUploaded,
                    mobileCaptured: globalProduct ? !!globalProduct.mobileCaptured : !!row.mobileCaptured,
                    isNew: !!row.isNew,
                    imagePath: row.imagePath || ''
                };
            });

            const newList = {
                ...listData,
                rows: sanitizedRows,
                id: Date.now(),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            data.lists.push(newList);

            for (const row of sanitizedRows) {
                db.toggleProductStatus(row.value, row.mobileCaptured, row.photographed, row.uploaded);
            }

            db.saveData(data);

            if (mainWindow) {
                mainWindow.webContents.send('trigger-sync');
            }
            res.json({ success: true, list: newList });
        } catch (error) {
            console.error('Mobile Create List Error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    app.post('/api/capture', async (req, res) => {
        console.log('POST /api/capture');
        try {
            const { listId, rowId, mobileCaptured } = req.body;
            const lists = await db.getLists('pending');
            const list = lists.find(l => l.id === listId);
            
            if (!list) return res.status(404).json({ error: 'List not found' });
            
            const row = list.rows.find(r => r.id === rowId);
            if (!row) return res.status(404).json({ error: 'Product not found' });

            row.mobileCaptured = mobileCaptured;
            await db.saveList(list);
            await db.toggleProductStatus(row.value, row.mobileCaptured, row.photographed, row.uploaded);

            if (mainWindow) {
                mainWindow.webContents.send('trigger-sync');
            }

            res.json({ success: true, row });
        } catch (error) {
            console.error('Mobile Capture Error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    const PORT = 3000;
    const HOST = '0.0.0.0';
    const serverInstance = app.listen(PORT, HOST, () => {
        console.log(`✅ Server bound to all network interfaces on port ${PORT}`);
    });

    serverInstance.on('error', (err) => {
        console.error('❌ Express Server Error:', err.message);
        if (err.code === 'EADDRINUSE') {
            console.error(`Port ${PORT} is already in use by another application!`);
        }
    });
}

function getLocalIp() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const net of interfaces[name]) {
            // Node 18+ might return 4 instead of 'IPv4'
            if ((net.family === 'IPv4' || net.family === 4) && !net.internal) {
                return net.address;
            }
        }
    }
    return 'localhost';
}

module.exports = { startServer, getLocalIp };
