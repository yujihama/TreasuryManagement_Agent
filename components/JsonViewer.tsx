
import React, { useState } from 'react';
import { ChevronDownIcon, ChevronUpIcon } from './icons';

interface JsonViewerProps {
    data: any;
}

const SyntaxHighlight: React.FC<{ json: any }> = ({ json }) => {
    if (json === null) {
        return <span className="text-purple-600">null</span>;
    }
    switch (typeof json) {
        case 'string':
            return <span className="text-green-600">"{json}"</span>;
        case 'number':
            return <span className="text-blue-600">{json}</span>;
        case 'boolean':
            return <span className="text-purple-600">{String(json)}</span>;
        case 'object':
            if (Array.isArray(json)) {
                return (
                    <>
                        [
                        <div className="pl-4">
                            {json.map((item, i) => (
                                <div key={i}>
                                    <SyntaxHighlight json={item} />
                                    {i < json.length - 1 && ','}
                                </div>
                            ))}
                        </div>
                        ]
                    </>
                );
            }
            return (
                <>
                    {'{'}
                    <div className="pl-4">
                        {Object.entries(json).map(([key, value], i, arr) => (
                            <div key={key}>
                                <span className="text-red-600">"{key}"</span>: <SyntaxHighlight json={value} />
                                {i < arr.length - 1 && ','}
                            </div>
                        ))}
                    </div>
                    {'}'}
                </>
            );
        default:
            return <span>{String(json)}</span>;
    }
};

const JsonViewer: React.FC<JsonViewerProps> = ({ data }) => {
    const [isExpanded, setIsExpanded] = useState(true);

    if (!data || Object.keys(data).length === 0) {
        return null;
    }

    return (
        <div className="mt-2 text-xs bg-white p-2 border border-gray-200 rounded">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center text-gray-500 hover:text-gray-800 text-xs mb-1"
            >
                {isExpanded ? <ChevronUpIcon className="w-3 h-3 mr-1" /> : <ChevronDownIcon className="w-3 h-3 mr-1" />}
                {isExpanded ? 'Hide Details' : 'Show Details'}
            </button>
            {isExpanded && (
                <pre className="whitespace-pre-wrap break-all bg-slate-50 p-2 rounded-sm overflow-x-auto">
                    <code>
                       <SyntaxHighlight json={data} />
                    </code>
                </pre>
            )}
        </div>
    );
};

export default JsonViewer;
