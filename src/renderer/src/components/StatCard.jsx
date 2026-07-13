import React from 'react'
import { useTheme } from '../context/ThemeContext'

const StatCard = ({ icon: Icon, label, value, colorClass }) => {
  const { theme } = useTheme()
  const isExcel = theme === 'excel'

  return (
    <div className={`${isExcel ? 'bg-white border border-gray-300 rounded-md p-4' : 'glass-card p-6'} flex items-center gap-4 flex-1`}>
      <div className={`p-3 rounded-xl ${isExcel ? 'bg-gray-100' : 'bg-white/50'} ${colorClass}`}>
        {Icon && <Icon className="w-6 h-6" />}
      </div>
      <div>
        <p className="text-sm font-medium text-gray-500">{label}</p>
        <p className="text-3xl font-bold text-olive-dark">{value}</p>
      </div>
    </div>
  )
}

export default StatCard
