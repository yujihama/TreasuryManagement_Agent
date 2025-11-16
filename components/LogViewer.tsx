
import React, { useState, useEffect, useMemo } from 'react';
import logger from '../services/loggingService';
import { DownloadIcon, TrashIcon, MagnifyingGlassIcon } from './icons';
import JsonViewer from './JsonViewer';

interface ParsedLog {
    timestamp: string;
    level: string;
    message: string;
    data?: any;
}

const parseLogEntry = (logString: string): ParsedLog | null => {
    const match = logString.match(/\[(.*?)\] \[(.*?)\] ([\s\S]*)/);
    if (!match) return null;

    const [, timestamp, level, rest] = match;
    const parts = rest.split('\n{');
    const message = parts[0];
    let data = null;

    if (parts.length > 1) {
        try {
            const jsonString = '{' + parts.slice(1).join('\n{');
            data = JSON.parse(jsonString);
        } catch (e) {
            // Not a JSON object, treat as part of the message
        }
    }

    return { timestamp, level, message, data };
};


const LogViewer: React.FC = () => {
    const [logs, setLogs] = useState<readonly string[]>(logger.getLogs());
    const [searchTerm, setSearchTerm] = useState('');
    const [filterLevel, setFilterLevel] = useState('ALL');

    useEffect(() => {
        const handleNewLog = () => {
            setLogs(logger.getLogs());
        };
        // Assuming logger can emit an event or we poll
        const interval = setInterval(() => {
             if (logger.getLogs().length !== logs.length) {
                handleNewLog();
            }
        }, 500);

        return () => clearInterval(interval);
    }, [logs.length]);

    const parsedLogs = useMemo(() => {
        return logs.map(parseLogEntry).filter((log): log is ParsedLog => log !== null);
    }, [logs]);

    const filteredLogs = useMemo(() => {
        return parsedLogs.filter(log => {
            const levelMatch = filterLevel === 'ALL' || log.level.toUpperCase() === filterLevel;
            const termMatch = searchTerm === '' || log.message.toLowerCase().includes(searchTerm.toLowerCase()) || JSON.stringify(log.data || {}).toLowerCase().includes(searchTerm.toLowerCase());
            return levelMatch && termMatch;
        });
    }, [parsedLogs, searchTerm, filterLevel]);
    
    const handleDownload = () => {
        const logContent = logger.getLogContent();
        const blob = new Blob([logContent], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `treasury_agent_log_${new Date().toISOString()}.log`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleClear = () => {
        logger.clear();
        setLogs(logger.getLogs());
    };
    
    const getLevelStyles = (level: string) => {
        switch (level.toUpperCase()) {
            case 'INFO':
                return 'border-blue-500 bg-blue-50';
            case 'SUCCESS':
                return 'border-green-500 bg-green-50';
            case 'ERROR':
                return 'border-red-500 bg-red-50';
            default:
                return 'border-gray-300 bg-gray-50';
        }
    };

    const FilterButton: React.FC<{ level: string; }> = ({ level }) => {
        const isActive = filterLevel === level;
        const baseClasses = "px-3 py-1 text-sm font-medium rounded-md border";
        const activeClasses = "bg-blue-500 text-white border-blue-500";
        const inactiveClasses = "bg-white text-gray-600 hover:bg-gray-100 border-gray-300";
        return (
            <button onClick={() => setFilterLevel(level)} className={`${baseClasses} ${isActive ? activeClasses : inactiveClasses}`}>
                {level === 'ALL' ? 'All' : level.charAt(0).toUpperCase() + level.slice(1).toLowerCase()}
            </button>
        );
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 p-6">
            <div className="flex justify-between items-center mb-4 flex-shrink-0 gap-4">
                <h2 className="text-2xl font-bold text-gray-900">Execution Logs</h2>
                <div className="flex gap-2">
                    <button
                        onClick={handleDownload}
                        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50"
                    >
                        <DownloadIcon className="w-4 h-4" />
                        Download
                    </button>
                    <button
                        onClick={handleClear}
                        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-md shadow-sm hover:bg-red-100"
                    >
                         <TrashIcon className="w-4 h-4" />
                        Clear
                    </button>
                </div>
            </div>

            <div className="flex items-center gap-4 mb-4 flex-shrink-0 p-3 bg-slate-100 border border-slate-200 rounded-lg">
                 <div className="relative flex-grow">
                    <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search logs..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <FilterButton level="ALL" />
                    <FilterButton level="INFO" />
                    <FilterButton level="SUCCESS" />
                    <FilterButton level="ERROR" />
                </div>
            </div>

            <div className="flex-grow bg-gray-100 rounded-lg overflow-auto font-mono text-sm text-gray-700 border border-gray-200 p-2">
                <div className="space-y-2">
                    {filteredLogs.map((log, index) => (
                        <div key={index} className={`p-3 rounded-md border-l-4 ${getLevelStyles(log.level)}`}>
                            <div className="flex items-center justify-between text-xs mb-1">
                                <span className="text-gray-500">{log.timestamp}</span>
                                <span className={`font-bold px-2 py-0.5 rounded-full text-white ${
                                    log.level === 'SUCCESS' ? 'bg-green-500' :
                                    log.level === 'ERROR' ? 'bg-red-500' :
                                    log.level === 'INFO' ? 'bg-blue-500' : 'bg-gray-500'
                                }`}>{log.level}</span>
                            </div>
                            <p className="font-semibold text-gray-800 mb-1">{log.message}</p>
                            {log.data && <JsonViewer data={log.data} />}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default LogViewer;
