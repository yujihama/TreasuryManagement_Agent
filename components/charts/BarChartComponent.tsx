import React from 'react';
import type { BarChartContent } from '../../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const BarChartComponent: React.FC<BarChartContent> = ({ data, title, categoryKey, valueKey }) => {

    const gridColor = '#e5e7eb'; // gray-200
    const textColor = '#6b7280'; // gray-500
    const tooltipStyle = {
        backgroundColor: '#ffffff', // white
        borderColor: '#d1d5db', // gray-300
        color: '#111827', // gray-900
    };

    return (
        <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold mb-4 text-gray-800">{title}</h3>
            <div style={{ width: '100%', height: 300 }}>
                <ResponsiveContainer>
                    <BarChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                        <XAxis dataKey={categoryKey} stroke={textColor} />
                        <YAxis stroke={textColor} />
                        <Tooltip 
                            contentStyle={tooltipStyle} 
                            cursor={{ fill: 'rgba(0, 0, 0, 0.05)' }} 
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