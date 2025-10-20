import React, { useState, useEffect } from 'react';
import type { VisualContent } from '../types';
import TableComponent from './charts/TableComponent';
import BarChartComponent from './charts/BarChartComponent';
import PieChartComponent from './charts/PieChartComponent';
import LineChartComponent from './charts/LineChartComponent';
import WorldMapComponent from './charts/WorldMapComponent';
import ReportComponent from './charts/ReportComponent';
import { ChartIcon, CheckCircleIcon } from './icons';

const ArtifactRenderer: React.FC<{ content: VisualContent }> = ({ content }) => {
    return (
        <div>
            {(() => {
                switch (content.type) {
                    case 'table':
                        return <div className="p-4"><TableComponent data={content.data} title={content.title} isCompact={false} /></div>;
                    case 'bar_chart':
                        return <div className="p-4"><BarChartComponent {...content} /></div>;
                    case 'pie_chart':
                        return <div className="p-4"><PieChartComponent {...content} /></div>;
                    case 'line_chart':
                        return <div className="p-4"><LineChartComponent {...content} /></div>;
                    case 'world_map':
                        return <div className="p-4"><WorldMapComponent {...content} /></div>;
                    case 'report':
                        return <ReportComponent {...content} />;
                    default:
                        return null;
                }
            })()}
        </div>
    );
};

interface VisualizationPanelProps {
    artifacts: VisualContent[];
}

const VisualizationPanel: React.FC<VisualizationPanelProps> = ({ artifacts }) => {
    const [activeTabIndex, setActiveTabIndex] = useState(0);

    useEffect(() => {
        // When new artifacts are added, switch to the newest one
        if (artifacts.length > 0) {
            setActiveTabIndex(artifacts.length - 1);
        }
    }, [artifacts.length]);

    if (artifacts.length === 0) {
        return (
            <div className="w-full h-full flex items-center justify-center p-6 bg-white dark:bg-gray-800">
                <div className="text-center text-gray-500 dark:text-gray-400">
                    <ChartIcon className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
                    <p className="text-lg font-semibold">Visualization Area</p>
                    <p className="text-sm mt-1">生成されたチャートやマップはここに表示されます。</p>
                </div>
            </div>
        );
    }

    const activeArtifact = artifacts[activeTabIndex];

    return (
        <div className="w-full h-full flex flex-col bg-white dark:bg-gray-800">
            {artifacts.length > 1 && (
                <div className="flex border-b border-gray-200 dark:border-gray-700 overflow-x-auto flex-shrink-0">
                    {artifacts.map((artifact, index) => (
                        <button
                            key={`${artifact.title}-${index}`}
                            onClick={() => setActiveTabIndex(index)}
                            className={`flex items-center px-4 py-2 text-sm font-medium -mb-px border-b-2 whitespace-nowrap ${activeTabIndex === index ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-500'}`}
                            title={artifact.title}
                        >
                            <span className="truncate">{artifact.title}</span>
                             {artifact.isReviewed && <CheckCircleIcon className="w-4 h-4 ml-2 text-green-500 flex-shrink-0" />}
                        </button>
                    ))}
                </div>
            )}
            <div className="flex-grow overflow-auto">
                {activeArtifact && <ArtifactRenderer content={activeArtifact} />}
            </div>
        </div>
    );
};

export default VisualizationPanel;