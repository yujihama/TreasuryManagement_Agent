
import React from 'react';
import type { PieChartContent } from '../../types';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const COLORS = ['#4299E1', '#ED8936', '#48BB78', '#9F7AEA', '#F56565', '#ECC94B'];

const PieChartComponent: React.FC<PieChartContent> = ({ data, title, categoryKey, valueKey }) => {
    
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
                    <PieChart>
                        <Pie
                            data={data}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            outerRadius={100}
                            fill="#8884d8"
                            dataKey={valueKey}
                            nameKey={categoryKey}
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