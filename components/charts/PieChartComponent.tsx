import React from 'react';
import type { PieChartContent } from '../../types';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const COLORS = ['#4299E1', '#ED8936', '#48BB78', '#9F7AEA', '#F56565', '#ECC94B'];

const PieChartComponent: React.FC<PieChartContent> = ({ data, title, nameKey, valueKey }) => {
    const isDarkMode = typeof window !== 'undefined' && document.documentElement.classList.contains('dark');
    
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
                    <PieChart>
                        <Pie
                            data={data}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            outerRadius={100}
                            fill="#8884d8"
                            dataKey={valueKey}
                            nameKey={nameKey}
                        >
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip contentStyle={tooltipStyle} />
                        <Legend wrapperStyle={{ color: textColor }} />
                    </PieChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default PieChartComponent;