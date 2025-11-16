
import React from 'react';
import type { ScatterPlotContent } from '../../types';
import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const ScatterPlotComponent: React.FC<ScatterPlotContent> = ({ data, title, xKey, yKey }) => {
    const gridColor = '#e5e7eb';
    const textColor = '#6b7280';
    const tooltipStyle = {
        backgroundColor: '#ffffff',
        borderColor: '#d1d5db',
        color: '#111827',
    };

    return (
        <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold mb-4 text-gray-800">{title}</h3>
            <div style={{ width: '100%', height: 300 }}>
                <ResponsiveContainer>
                    <ScatterChart
                        margin={{
                            top: 20,
                            right: 20,
                            bottom: 20,
                            left: 20,
                        }}
                    >
                        <CartesianGrid stroke={gridColor} strokeDasharray="3 3" />
                        <XAxis type="number" dataKey={xKey} name={xKey} stroke={textColor} />
                        <YAxis type="number" dataKey={yKey} name={yKey} stroke={textColor} />
                        <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={tooltipStyle} />
                        <Legend wrapperStyle={{ color: textColor }} />
                        <Scatter name={title} data={data} fill="#4299E1" />
                    </ScatterChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default ScatterPlotComponent;