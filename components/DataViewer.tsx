
import React, { useState } from 'react';
import type { DataSets, DataSet } from '../types';
import { DataType, dataTypeTranslations } from '../constants';
import FileUpload from './FileUpload';
import TableComponent from './charts/TableComponent';

interface DataViewerProps {
    dataSets: DataSets;
    onDataUpload: (dataType: DataType, data: DataSet) => void;
}

const DataViewer: React.FC<DataViewerProps> = ({ dataSets, onDataUpload }) => {
    const [activeDataTab, setActiveDataTab] = useState<DataType>(DataType.ACCOUNT_BALANCES);

    const dataTypes = Object.values(DataType);
    const currentDataSet = dataSets[activeDataTab];

    return (
        <div className="flex flex-col h-full bg-slate-50 p-6">
            <h2 className="text-2xl font-bold mb-4 text-gray-900">Data Management</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
                {dataTypes.map(dt => (
                    <FileUpload
                        key={dt}
                        title={dataTypeTranslations[dt]}
                        onFileUpload={(data) => onDataUpload(dt, data)}
                    />
                ))}
            </div>

            <div className="flex-grow flex flex-col border border-gray-200 rounded-lg overflow-hidden min-w-0 min-h-0">
                <div className="flex border-b border-gray-200 overflow-x-auto pb-2">
                    {dataTypes.map(dt => (
                        <button
                            key={dt}
                            onClick={() => setActiveDataTab(dt)}
                            className={`flex-shrink-0 px-4 py-3 text-sm font-medium -mb-px border-b-2 whitespace-nowrap ${activeDataTab === dt ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                        >
                            {dataTypeTranslations[dt]}
                        </button>
                    ))}
                </div>
                <div className="flex-grow overflow-auto">
                    {currentDataSet ? (
                        <TableComponent data={currentDataSet} />
                    ) : (
                        <div className="flex items-center justify-center h-full">
                            <p className="text-gray-500">データがアップロードされていません。CSVファイルをアップロードしてください。</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DataViewer;
