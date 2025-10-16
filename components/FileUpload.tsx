
import React, { useCallback } from 'react';
import type { DataSet, CsvRow } from '../types';
import { UploadIcon } from './icons';

declare const Papa: any;

interface FileUploadProps {
    onFileUpload: (data: DataSet) => void;
    title: string;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFileUpload, title }) => {
    const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            Papa.parse(file, {
                header: true,
                skipEmptyLines: true,
                dynamicTyping: true,
                complete: (results: { data: CsvRow[] }) => {
                    const data = results.data;
                    if (data.length > 0) {
                        const columnNames = Object.keys(data[0]);
                        const newDataSet: DataSet = {
                            name: file.name,
                            data: data,
                            stats: {
                                rows: data.length,
                                columns: columnNames.length,
                                columnNames: columnNames,
                            },
                        };
                        onFileUpload(newDataSet);
                    }
                },
            });
        }
        event.target.value = ''; // Reset file input
    }, [onFileUpload]);

    return (
        <label htmlFor={`file-upload-${title}`} className="cursor-pointer w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate pr-2">{title}</span>
            <UploadIcon className="w-5 h-5 text-gray-400 flex-shrink-0" />
            <input
                id={`file-upload-${title}`}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileChange}
            />
        </label>
    );
};

export default FileUpload;
