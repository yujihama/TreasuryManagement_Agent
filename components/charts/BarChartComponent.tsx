import React from 'react';
import type { BarChartContent } from '../../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const BarChartComponent: React.FC<BarChartContent> = ({ data, title, categoryKey, valueKey }) => {
    const isDarkMode = typeof window !== 'undefined' && document.documentElement.classList.contains('dark');

    const gridColor = isDarkMode ? '#4A5568' : '#e5e7eb'; // gray-600 / gray-200
    const textColor = isDarkMode ? '#9CA3AF' : '#6b7280'; // gray-400 / gray-500
    const tooltipStyle = {
        backgroundColor: isDarkMode ? '#1f2937' : '#ffffff', // gray-800 / white
        borderColor: isDarkMode ? '#374151' : '#d1d5db', // gray-700 / gray-300
        color: isDarkMode ? '#f9fafb' : '#111827', // gray-50 / gray-900
    };

    return (
        <div className="p-4 bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-200">{title}</h3>
            <div style={{ width: '100%', height: 300 }}>
                <ResponsiveContainer>
                    <BarChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                        <XAxis dataKey={categoryKey} stroke={textColor} />
                        <YAxis stroke={textColor} />
                        <Tooltip 
                            contentStyle={tooltipStyle} 
                            cursor={{ fill: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)' }} 
                        />
                        <Legend wrapperStyle={{ color: textColor }} />
                        <Bar dataKey={valueKey} fill="#4299E1" />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default BarChartComponent;