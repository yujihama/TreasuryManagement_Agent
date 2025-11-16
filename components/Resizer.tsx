
import React from 'react';

interface ResizerProps {
    onMouseDown: (event: React.MouseEvent<HTMLDivElement>) => void;
    className?: string;
}

const Resizer: React.FC<ResizerProps> = ({ onMouseDown, className = '' }) => {
    return (
        <div
            style={{ flexShrink: 0 }}
            className={`w-1.5 cursor-col-resize bg-slate-300 hover:bg-blue-500 active:bg-blue-600 transition-colors duration-200 ease-in-out ${className}`}
            onMouseDown={onMouseDown}
        />
    );
};

export default Resizer;
