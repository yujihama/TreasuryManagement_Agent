import React from 'react';
import type { LineChartContent } from '../../types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const COLORS = ['#4299E1', '#ED8936', '#48BB78', '#9F7AEA', '#F56565', '#ECC94B'];

const LineChartComponent: React.FC<LineChartContent> = ({ data, title, xKey, yKeys }) => {
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