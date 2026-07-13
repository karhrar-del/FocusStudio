export const themes = {
  glass: {
    id: 'glass',
    name: 'الوضع الزجاجي (الافتراضي)',
    description: 'ألوان هادئة مع تأثير زجاجي',
    colors: {
      '--app-bg': '#F2F4F3',
      '--app-text': '#1f2937',
      '--glass-bg': 'rgba(255, 255, 255, 0.4)',
      '--glass-border': 'rgba(255, 255, 255, 0.5)',
      '--sidebar-bg': 'rgba(63, 82, 76, 0.95)', // olive-dark
      '--sidebar-border': 'rgba(255, 255, 255, 0.1)',
      '--sidebar-text': 'rgba(255, 255, 255, 0.7)',
      '--sidebar-text-hover': '#ffffff',
      '--sidebar-text-active': '#ffffff',
      '--sidebar-bg-hover': 'rgba(255, 255, 255, 0.1)',
      '--sidebar-bg-active': 'rgba(255, 255, 255, 0.15)',
      '--accent-main': '#C19A5B', // mustard
      '--accent-light': '#D4A373', // mustard-light
      '--olive-dark': '#3F524C',
      '--olive-light': '#566B64',
    }
  },
  dark: {
    id: 'dark',
    name: 'الوضع الداكن',
    description: 'مريح للعين في الإضاءة المنخفضة',
    colors: {
      '--app-bg': '#121212',
      '--app-text': '#E5E7EB',
      '--glass-bg': 'rgba(30, 30, 30, 0.5)',
      '--glass-border': 'rgba(255, 255, 255, 0.1)',
      '--sidebar-bg': 'rgba(15, 15, 15, 0.95)',
      '--sidebar-border': 'rgba(255, 255, 255, 0.05)',
      '--sidebar-text': 'rgba(255, 255, 255, 0.6)',
      '--sidebar-text-hover': '#ffffff',
      '--sidebar-text-active': '#ffffff',
      '--sidebar-bg-hover': 'rgba(255, 255, 255, 0.05)',
      '--sidebar-bg-active': 'rgba(255, 255, 255, 0.1)',
      '--accent-main': '#3b82f6', // blue-500
      '--accent-light': '#60a5fa', // blue-400
      '--olive-dark': '#1f2937', // mapping for compatibility
      '--olive-light': '#374151',
    }
  },
  ocean: {
    id: 'ocean',
    name: 'المحيط',
    description: 'أزرق هادئ مستوحى من البحر',
    colors: {
      '--app-bg': '#e0f2fe',
      '--app-text': '#0c4a6e',
      '--glass-bg': 'rgba(255, 255, 255, 0.5)',
      '--glass-border': 'rgba(255, 255, 255, 0.6)',
      '--sidebar-bg': 'rgba(12, 74, 110, 0.95)',
      '--sidebar-border': 'rgba(255, 255, 255, 0.2)',
      '--sidebar-text': 'rgba(255, 255, 255, 0.7)',
      '--sidebar-text-hover': '#ffffff',
      '--sidebar-text-active': '#ffffff',
      '--sidebar-bg-hover': 'rgba(255, 255, 255, 0.1)',
      '--sidebar-bg-active': 'rgba(255, 255, 255, 0.15)',
      '--accent-main': '#0284c7', 
      '--accent-light': '#38bdf8',
      '--olive-dark': '#0c4a6e',
      '--olive-light': '#075985',
    }
  },
  forest: {
    id: 'forest',
    name: 'الغابة',
    description: 'أخضر هادئ مستوحى من الطبيعة',
    colors: {
      '--app-bg': '#dcfce7',
      '--app-text': '#14532d',
      '--glass-bg': 'rgba(255, 255, 255, 0.5)',
      '--glass-border': 'rgba(255, 255, 255, 0.6)',
      '--sidebar-bg': 'rgba(20, 83, 45, 0.95)',
      '--sidebar-border': 'rgba(255, 255, 255, 0.2)',
      '--sidebar-text': 'rgba(255, 255, 255, 0.7)',
      '--sidebar-text-hover': '#ffffff',
      '--sidebar-text-active': '#ffffff',
      '--sidebar-bg-hover': 'rgba(255, 255, 255, 0.1)',
      '--sidebar-bg-active': 'rgba(255, 255, 255, 0.15)',
      '--accent-main': '#16a34a',
      '--accent-light': '#4ade80',
      '--olive-dark': '#14532d',
      '--olive-light': '#166534',
    }
  },
  sunset: {
    id: 'sunset',
    name: 'الغروب',
    description: 'ألوان دافئة مستوحاة من الغروب',
    colors: {
      '--app-bg': '#ffedd5',
      '--app-text': '#7c2d12',
      '--glass-bg': 'rgba(255, 255, 255, 0.5)',
      '--glass-border': 'rgba(255, 255, 255, 0.6)',
      '--sidebar-bg': 'rgba(124, 45, 18, 0.95)',
      '--sidebar-border': 'rgba(255, 255, 255, 0.2)',
      '--sidebar-text': 'rgba(255, 255, 255, 0.7)',
      '--sidebar-text-hover': '#ffffff',
      '--sidebar-text-active': '#ffffff',
      '--sidebar-bg-hover': 'rgba(255, 255, 255, 0.1)',
      '--sidebar-bg-active': 'rgba(255, 255, 255, 0.15)',
      '--accent-main': '#ea580c',
      '--accent-light': '#fb923c',
      '--olive-dark': '#7c2d12',
      '--olive-light': '#9a3412',
    }
  }
}
