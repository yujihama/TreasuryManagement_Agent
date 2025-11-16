
import React from 'react';
import type { WaterfallChartContent } from '../../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';

const WaterfallChartComponent: React.FC<WaterfallChartContent> = ({ data, title, categoryKey, valueKey }) => {
    const gridColor = '#e5e7eb';
    const textColor = '#6b7280';
    const positiveColor = '#48BB78'; // green-500
    const negativeColor = '#F56565'; // red-500
    const totalColor = '#4299E1'; // blue-400
    const tooltipStyle = {
        backgroundColor: '#ffffff',
        borderColor: '#d1d5db',
        color: '#111827',
    };

    let runningTotal = 0;
    const processedData = data.map((d) => {
      const value = Number(d[valueKey]);
      const start = runningTotal;
      runningTotal += value;
      return {
        ...d,
        _value: value,
        _start: value >= 0 ? start : runningTotal,
        _valueAbs: Math.abs(value),
      };
    });

    processedData.push({
      [categoryKey]: 'Total',
      _value: runningTotal,
      _start: 0,
      _valueAbs: runningTotal,
    });

    return (
        <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold mb-4 text-gray-800">{title}</h3>
            <div style={{ width: '100%', height: 300 }}>
                <ResponsiveContainer>
                    <BarChart data={processedData}>
                        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                        <XAxis dataKey={categoryKey} stroke={textColor} />
                        <YAxis stroke={textColor} />
                        <Tooltip
                            contentStyle={tooltipStyle}
                            formatter={(value, name, props) => {
                                // Show the actual change value, not the stacked value
                                return [props.payload._value, valueKey];
                            }}
                        />
                        <ReferenceLine y={0} stroke={textColor} />
                        <Bar dataKey="_start" stackId="a" fill="transparent" />
                        <Bar dataKey="_valueAbs" stackId="a">
                            {processedData.map((entry, index) => {
                                let color = totalColor;
                                if (entry[categoryKey] !== 'Total') {
                                    color = entry._value >= 0 ? positiveColor : negativeColor;
                                }
                                return <Cell key={`cell-${index}`} fill={color} />;
                            })}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default WaterfallChartComponent;