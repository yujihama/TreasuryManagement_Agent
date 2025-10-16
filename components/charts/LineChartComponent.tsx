import React from 'react';
import type { LineChartContent } from '../../types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const COLORS = ['#4299E1', '#ED8936', '#48BB78', '#9F7AEA', '#F56565', '#ECC94B'];

const LineChartComponent: React.FC<LineChartContent> = ({ data, title, xKey, yKeys }) => {
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
                    <LineChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                        <XAxis dataKey={xKey} stroke={textColor} />
                        <YAxis stroke={textColor} />
                        <Tooltip 
                            contentStyle={tooltipStyle} 
                            cursor={{ stroke: gridColor, strokeWidth: 1 }}
                        />
                        <Legend wrapperStyle={{ color: textColor }}/>
                        {yKeys.map((key, index) => (
                            <Line key={key} type="monotone" dataKey={key} stroke={COLORS[index % COLORS.length]} />
                        ))}
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default LineChartComponent;