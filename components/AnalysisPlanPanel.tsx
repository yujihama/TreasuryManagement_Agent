
import React, { useState, useEffect } from 'react';
import type { AnalysisStep, CsvRow } from '../types';
import { CheckCircleIcon, ClockIcon, ExclamationIcon, SpinnerIcon, ChevronDownIcon, ChevronUpIcon, MagnifyingGlassIcon } from './icons';
import TableComponent from './charts/TableComponent';

const StatusIcon: React.FC<{ status: AnalysisStep['status'] }> = ({ status }) => {
    switch (status) {
        case 'pending':
            return <ClockIcon className="w-5 h-5 text-gray-400" />;
        case 'running':
            return <SpinnerIcon className="w-5 h-5 text-blue-500 animate-spin" />;
        case 'reviewing':
            return <MagnifyingGlassIcon className="w-5 h-5 text-purple-500" />;
        case 'warning':
            return <ExclamationIcon className="w-5 h-5 text-yellow-500" />;
        case 'completed':
            return <CheckCircleIcon className="w-5 h-5 text-green-500" />;
        case 'error':
            return <ExclamationIcon className="w-5 h-5 text-red-500" />;
        default:
            return null;
    }
};

const PreviewTable: React.FC<{ rows: CsvRow[] }> = ({ rows }) => {
    if (!rows || rows.length === 0) return null;
    const headers = Object.keys(rows[0]);

    return (
        <div className="mt-2 overflow-x-auto rounded-md border border-gray-200 dark:border-gray-600">
            <table className="w-full text-xs">
                <thead className="bg-gray-100 dark:bg-gray-700">
                    <tr>
                        {headers.map(h => <th key={h} className="p-1.5 font-semibold text-left text-gray-600 dark:text-gray-300">{h}</th>)}
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                    {rows.map((row, i) => (
                        <tr key={i} className="bg-white dark:bg-gray-800">
                            {headers.map(h => <td key={h} className="p-1.5 text-gray-500 dark:text-gray-400 font-mono truncate max-w-[120px]" title={String(row[h] ?? '')}>{String(row[h] ?? '')}</td>)}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

const StepResult: React.FC<{ step: AnalysisStep }> = ({ step }) => {
    if (step.status !== 'completed' || !step.result) return null;

    const { new_dataset_name, rows, columns, preview_rows, message } = step.result;

    if (new_dataset_name) {
        return (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                生成済み: <code className="text-xs bg-gray-200 dark:bg-gray-600 px-1 py-0.5 rounded font-mono">{new_dataset_name}</code> ({rows} 行)
            </p>
        );
    }
    
    // Handle new get_dataset_schema output
    if (step.toolCall.name === 'get_dataset_schema' && columns && Array.isArray(columns) && columns.length > 0 && typeof columns[0] === 'object') {
        const typedColumns = columns as {name: string, type: string}[];
        const columnDetails = typedColumns.map(c => `${c.name} (${c.type})`).join(', ');
        return (
             <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 space-y-2">
                <div>
                    <span className="font-semibold text-gray-700 dark:text-gray-300">列: </span>
                    <span className="font-mono">{columnDetails}</span>
                </div>
                {preview_rows && preview_rows.length > 0 && (
                    <div>
                        <span className="font-semibold text-gray-700 dark:text-gray-300">データプレビュー:</span>
                        <PreviewTable rows={preview_rows} />
                    </div>
                )}
            </div>
        );
    }

    if (columns && Array.isArray(columns) && columns.length > 0 && typeof columns[0] === 'string') {
        return (
             <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">
                列: <span className="font-mono">{columns.join(', ')}</span>
            </p>
        );
    }

    if (message) {
        return <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{message}</p>;
    }
    
    return null;
};

const ToolParameters: React.FC<{ toolCall: any }> = ({ toolCall }) => {
    // Don't show params for simple schema checks or if there are no args.
    if (toolCall.name === 'get_dataset_schema' || !toolCall.args) {
        return null;
    }

    const params = Object.entries(toolCall.args)
        // Don't show the dataset_name(s) as they are usually intermediate results and not very informative for the user.
        .filter(([key]) => !key.includes('dataset_name'));

    if (params.length === 0) {
        return null;
    }

    return (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 border-l-2 border-gray-200 dark:border-gray-600 pl-2">
            {params.map(([key, value]) => (
                <div key={key} className="text-xs text-gray-600 dark:text-gray-400 flex items-center">
                    <span className="font-semibold capitalize">{key.replace(/_/g, ' ')}:</span>
                    <code className="ml-1.5 text-xs bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded font-mono text-gray-800 dark:text-gray-200">{Array.isArray(value) ? value.join(', ') : String(value)}</code>
                </div>
            ))}
        </div>
    );
};


interface AnalysisPlanPanelProps {
    plan: AnalysisStep[];
    refinedInstruction: string | null;
}

const AnalysisPlanPanel: React.FC<AnalysisPlanPanelProps> = ({ plan, refinedInstruction }) => {
    const [openStepIds, setOpenStepIds] = useState(new Set<string>());

    const toggleStep = (id: string) => {
        setOpenStepIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    };

    useEffect(() => {
        const newOpenStepIds = new Set<string>();

        // Find the index of the first "active" step, which could be running, under review, or has an error/warning.
        const activeStepIndex = plan.findIndex(step =>
            ['running', 'reviewing', 'error', 'warning'].includes(step.status)
        );

        if (activeStepIndex !== -1) {
            // If an active step is found, expand it.
            newOpenStepIds.add(plan[activeStepIndex].id);
            // Also expand the step immediately preceding it to provide context.
            if (activeStepIndex > 0) {
                newOpenStepIds.add(plan[activeStepIndex - 1].id);
            }
        } else if (plan.length > 0) {
            // If no active steps are found, the plan is either fully completed or hasn't started.
            if (plan.every(step => step.status === 'completed')) {
                // If all steps are completed, expand only the final step.
                newOpenStepIds.add(plan[plan.length - 1].id);
            } else {
                // Otherwise, the plan is in its initial state (all steps pending), so expand the first step.
                newOpenStepIds.add(plan[0].id);
            }
        }
        setOpenStepIds(newOpenStepIds);
    }, [plan]);


    if (plan.length === 0 && !refinedInstruction) {
        return (
            <div className="text-center text-gray-500 dark:text-gray-400">
                <p>AIが生成した分析計画が表示されます。</p>
            </div>
        );
    }

    return (
        <div>
            {refinedInstruction && (
                <div className="mb-6 p-4 bg-blue-50 dark:bg-gray-700/50 border border-blue-200 dark:border-gray-600 rounded-lg">
                    <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-2">詳細化された指示</h3>
                    <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{refinedInstruction}</p>
                </div>
            )}
            
            {plan.length > 0 && (
                <ol className="relative border-l border-gray-200 dark:border-gray-700">
                    {plan.map((step) => {
                        const isExpanded = openStepIds.has(step.id);
                        const isReviewStep = step.toolCall.name === 'conduct_final_review';
                        const isRevisionStep = step.toolCall.name === 'revise_plan_based_on_feedback';
                        const isErrorRevisionStep = step.toolCall.name === 'revise_plan_due_to_error';
                        let stepName = step.toolCall.name;
                        if (isReviewStep) {
                            stepName = 'レビュー';
                        } else if (isRevisionStep) {
                            stepName = 'レビュー指摘の反映';
                        } else if (isErrorRevisionStep) {
                            stepName = 'エラーからの計画修正';
                        }
                        
                        return (
                            <li key={step.id} className="mb-2 ml-6">
                                <span className="absolute flex items-center justify-center w-8 h-8 bg-gray-100 rounded-full -left-4 ring-4 ring-white dark:ring-gray-800 dark:bg-gray-700">
                                    <StatusIcon status={step.status} />
                                </span>
                                <button
                                    onClick={() => toggleStep(step.id)}
                                    className="w-full text-left p-1.5 rounded-md flex justify-between items-center hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
                                    aria-expanded={isExpanded}
                                >
                                    <h4 className="font-semibold text-gray-800 dark:text-gray-200 flex items-center">
                                        {`ステップ ${step.step}: ${stepName}`}
                                    </h4>
                                    {isExpanded ? <ChevronUpIcon className="w-4 h-4 text-gray-500 flex-shrink-0" /> : <ChevronDownIcon className="w-4 h-4 text-gray-500 flex-shrink-0" />}
                                </button>

                                {isExpanded && (
                                    <div className="mt-2 pl-3 py-2 border-l-2 border-gray-200 dark:border-gray-600 ml-2 space-y-2">
                                        <p className="text-sm text-gray-600 dark:text-gray-400">{step.description}</p>
                                        
                                        {step.resultDataset && (
                                            <div className="mt-2">
                                                <TableComponent data={step.resultDataset} isCompact={true} />
                                            </div>
                                        )}
                                        <StepResult step={step} />
                                        {!isReviewStep && !isRevisionStep && <ToolParameters toolCall={step.toolCall} />}
                                        {step.status === 'error' && step.error && (
                                            <p className="text-xs text-red-500 mt-1">エラー: {step.error}</p>
                                        )}
                                         {isReviewStep && step.status === 'warning' && step.result?.feedback && (
                                            <div className="mt-2 p-2 rounded-md bg-yellow-50 dark:bg-yellow-900/50 border border-yellow-200 dark:border-yellow-800">
                                                <p className="text-xs font-semibold text-yellow-800 dark:text-yellow-200">レビュー指摘:</p>
                                                <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">{step.result.feedback}</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </li>
                        );
                    })}
                </ol>
            )}
        </div>
    );
};

export default AnalysisPlanPanel;
