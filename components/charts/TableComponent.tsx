import React, { useState, useMemo } from 'react';
import type { DataSet } from '../../types';

interface TableComponentProps {
    data: DataSet;
    title?: string;
    isCompact?: boolean;
}

const TableComponent: React.FC<TableComponentProps> = ({ data, title, isCompact = false }) => {
    const [currentPage, setCurrentPage] = useState(1);
    const rowsPerPage = isCompact ? 5 : 10;

    const paginatedData = useMemo(() => {
        const startIndex = (currentPage - 1) * rowsPerPage;
        return data.data.slice(startIndex, startIndex + rowsPerPage);
    }, [data.data, currentPage, rowsPerPage]);

    const totalPages = Math.ceil(data.data.length / rowsPerPage);

    // For AnalysisPlanPanel
    if (isCompact) {
        return (
            <div className={`bg-white dark:bg-gray-900 shadow-sm rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 ${isCompact ? 'text-sm' : ''}`}>
                {title && (
                    <div className={`p-2 border-b border-gray-200 dark:border-gray-700`}>
                        <h3 className="font-semibold text-gray-800 dark:text-gray-200">{title}</h3>
                    </div>
                )}
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 dark:bg-gray-800">
                            <tr>
                                {data.stats.columnNames.map(col => <th key={col} className="text-left font-medium text-gray-600 dark:text-gray-300 p-2">{col}</th>)}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {paginatedData.map((row, i) => (
                                <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                    {data.stats.columnNames.map(col => <td key={col} className="p-2 text-gray-700 dark:text-gray-300">{String(row[col])}</td>)}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {totalPages > 1 && (
                    <div className="p-2 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
                        <span className="text-sm text-gray-600 dark:text-gray-400">ページ {currentPage} / {totalPages}</span>
                        <div>
                            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-3 py-1 border rounded-md disabled:opacity-50 text-xs">前へ</button>
                            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="ml-2 px-3 py-1 border rounded-md disabled:opacity-50 text-xs">次へ</button>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // For DataViewer
    return (
        <div className="h-full flex flex-col bg-white dark:bg-gray-900">
            <div className="flex-grow overflow-auto">
                <table className="w-full border-collapse">
                    <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-800">
                        <tr>
                            {data.stats.columnNames.map(col => (
                                <th key={col} className="text-left font-semibold text-gray-600 dark:text-gray-300 p-3 border-b border-gray-200 dark:border-gray-700">
                                    {col}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                        {paginatedData.map((row, i) => (
                            <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                {data.stats.columnNames.map(col => (
                                    <td key={col} className="p-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                                        {String(row[col] ?? '')}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {totalPages > 1 && (
                <div className="flex-shrink-0 p-4 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-400">ページ {currentPage} / {totalPages}</span>
                    <div>
                        <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-3 py-1 border rounded-md disabled:opacity-50">前へ</button>
                        <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="ml-2 px-3 py-1 border rounded-md disabled:opacity-50">次へ</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TableComponent;
