
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import type { Chat } from '@google/genai';
import type { ChatMessage, AnalysisStep, DataSet, DataSets, MessageContent, VisualContent, CsvRow, ClarificationState } from './types';
import { DataType, sampleDataFiles, SYSTEM_PROMPT, dataTypeTranslations } from './constants';
import ChatPanel from './components/ChatPanel';
import AnalysisPlanPanel from './components/AnalysisPlanPanel';
import DataViewer from './components/DataViewer';
import VisualizationPanel from './components/VisualizationPanel';
import { runChat, getToolSchemas } from './services/geminiService';
import { ToolExecutor } from './services/toolExecutor';
import Resizer from './components/Resizer';
import { RefreshIcon, SpinnerIcon } from './components/icons';

// Assume API_KEY is set in the environment
const API_KEY = process.env.API_KEY;

declare const Papa: any;

function isVisualContent(content: MessageContent): content is VisualContent {
    return ['table', 'bar_chart', 'pie_chart', 'line_chart', 'world_map', 'report'].includes(content.type);
}

const MIN_PANEL_WIDTH = 280;

const App: React.FC = () => {
    const [dataSets, setDataSets] = useState<DataSets>({});
    const [isDataLoading, setIsDataLoading] = useState<boolean>(true);
    const [activeTab, setActiveTab] = useState<string>('chat');
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
    const [analysisPlan, setAnalysisPlan] = useState<AnalysisStep[]>([]);
    const [refinedInstruction, setRefinedInstruction] = useState<string | null>(null);
    const [artifacts, setArtifacts] = useState<VisualContent[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [clarificationState, setClarificationState] = useState<ClarificationState | null>(null);
    
    const [leftPanelWidth, setLeftPanelWidth] = useState(384);
    const [rightPanelWidth, setRightPanelWidth] = useState(0);

    // FIX: Corrected typo from HTMLDivDivElement to HTMLDivElement.
    const appContainerRef = useRef<HTMLDivElement>(null);
    const resizeState = useRef({
        isResizing: null as 'left' | 'right' | null,
        startX: 0,
        startWidth: 0,
    });

    useEffect(() => {
        const loadInitialData = async () => {
            setIsDataLoading(true);
            try {
                const dataPromises = Object.entries(sampleDataFiles).map(async ([type, path]) => {
                    const response = await fetch(path);
                    if (!response.ok) {
                        throw new Error(`Failed to load sample data: ${path}`);
                    }
                    const csvString = await response.text();
                    const results = Papa.parse(csvString, {
                        header: true,
                        skipEmptyLines: true,
                        dynamicTyping: true,
                    });
                    const data = results.data as CsvRow[];
                    if (data.length > 0) {
                        const columnNames = Object.keys(data[0]);
                        const dataType = type as DataType;
                        const dataSet: DataSet = {
                            name: dataTypeTranslations[dataType],
                            data: data,
                            stats: {
                                rows: data.length,
                                columns: columnNames.length,
                                columnNames: columnNames,
                            },
                        };
                        return { [dataType]: dataSet };
                    }
                    return null;
                });

                const loadedDataArray = await Promise.all(dataPromises);
                const loadedDataSets = loadedDataArray.reduce<DataSets>((acc, current) => {
                    if (current) {
                        return { ...acc, ...current };
                    }
                    return acc;
                }, {});
                
                setDataSets(loadedDataSets);
            } catch (err) {
                console.error("Error loading initial data:", err);
                setError("サンプルデータの読み込みに失敗しました。");
            } finally {
                setIsDataLoading(false);
            }
        };

        loadInitialData();
    }, []);

    useEffect(() => {
        if (appContainerRef.current) {
            setRightPanelWidth(appContainerRef.current.offsetWidth * 0.4);
        }
    }, []);

    const aiRef = useRef<GoogleGenAI | null>(null);
    if (!aiRef.current && API_KEY) {
        aiRef.current = new GoogleGenAI({ apiKey: API_KEY });
    }

    const chatRef = useRef<Chat | null>(null);
    const toolExecutorRef = useRef(new ToolExecutor());

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!resizeState.current.isResizing) return;

        const deltaX = e.clientX - resizeState.current.startX;
        const containerWidth = appContainerRef.current?.offsetWidth || window.innerWidth;
        const resizerWidth = 6; // w-1.5 is 6px

        if (resizeState.current.isResizing === 'left') {
            const newWidth = resizeState.current.startWidth + deltaX;
            const maxWidth = containerWidth - (activeTab === 'chat' ? rightPanelWidth : 0) - MIN_PANEL_WIDTH - (activeTab === 'chat' ? resizerWidth * 2 : resizerWidth);
            setLeftPanelWidth(Math.max(MIN_PANEL_WIDTH, Math.min(newWidth, maxWidth)));
        } else if (resizeState.current.isResizing === 'right') {
            const newWidth = resizeState.current.startWidth - deltaX;
            const maxWidth = containerWidth - leftPanelWidth - MIN_PANEL_WIDTH - resizerWidth * 2;
            setRightPanelWidth(Math.max(MIN_PANEL_WIDTH, Math.min(newWidth, maxWidth)));
        }
    }, [leftPanelWidth, rightPanelWidth, activeTab]);

    const handleMouseUp = useCallback(() => {
        resizeState.current.isResizing = null;
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = 'default';
        document.body.style.userSelect = 'auto';
    }, [handleMouseMove]);
    
    const handleMouseDown = (panel: 'left' | 'right') => (e: React.MouseEvent<HTMLDivElement>) => {
        e.preventDefault();
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';

        resizeState.current.isResizing = panel;
        resizeState.current.startX = e.clientX;
        resizeState.current.startWidth = panel === 'left' ? leftPanelWidth : rightPanelWidth;
        
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    };

    const handleDataUpload = useCallback((dataType: DataType, data: DataSet) => {
        setDataSets(prev => ({ ...prev, [dataType]: data }));
        setActiveTab('data');
    }, []);

    const handleReset = useCallback(() => {
        setIsLoading(false);
        setError(null);
        setChatHistory([]);
        setAnalysisPlan([]);
        setArtifacts([]);
        setClarificationState(null);
        setRefinedInstruction(null);
        chatRef.current = null;
        toolExecutorRef.current.reset();
    }, []);

    const handleSendMessage = useCallback(async (message: string) => {
        if (!message.trim() || isLoading) return;
        
        if (!API_KEY) {
            setError("APIキーが設定されていません。API_KEY環境変数を設定してください。");
            return;
        }

        const ai = aiRef.current;
        if (!ai) {
             setError("Gemini AIクライアントが初期化されていません。");
            return;
        }
        
        if (!chatRef.current) {
            chatRef.current = ai.chats.create({
                model: 'gemini-2.5-flash',
                config: {
                    systemInstruction: SYSTEM_PROMPT,
                    tools: [{ functionDeclarations: getToolSchemas() }],
                },
            });
        }
        const chat = chatRef.current;

        setIsLoading(true);
        setError(null);

        const userMessage: ChatMessage = { id: Date.now(), role: 'user', content: [{ type: 'text', text: message }] };
        
        const thinkingId = Date.now() + 1;
        const strategistThinkingMessage: ChatMessage = {
            id: thinkingId,
            role: 'model',
            content: [{ type: 'text', text: 'Thinking...' }],
            isThinking: true,
        };

        setChatHistory(prev => [...prev, userMessage, strategistThinkingMessage]);

        try {
            const contextToUse = clarificationState;

            const result = await runChat(chat, ai, message, dataSets, toolExecutorRef.current, {
                onRefinedInstruction: (instruction) => {
                    setRefinedInstruction(instruction);
                },
                onAnalysisStart: () => {
                    // Strategist is done, analysis is starting. Remove the thinking message.
                    setChatHistory(prev => prev.filter(m => m.id !== thinkingId));
                    setClarificationState(null);
                },
                onPlanGenerated: (plan) => setAnalysisPlan(plan),
                onStepUpdate: (updatedStep) => {
                     setAnalysisPlan(prevPlan => prevPlan.map(s => s.id === updatedStep.id ? updatedStep : s));
                },
                onArtifactGenerated: (artifact) => {
                    if (isVisualContent(artifact)) {
                        // Don't add plain tables to the visualization panel.
                        // They are still available within the tool executor for report generation.
                        if (artifact.type !== 'table') {
                            setArtifacts(prev => [...prev, artifact]);
                            // Also, don't notify the user about table or report generation, as they are handled differently.
                            if (artifact.type !== 'report') {
                                 const notificationMessage: ChatMessage = {
                                    id: Date.now() + Math.random(),
                                    role: 'model',
                                    content: [{ type: 'text', text: `「${artifact.title}」の視覚化を生成しました。右側のパネルで表示できます。` }]
                                };
                                setChatHistory(prev => [...prev, notificationMessage]);
                            }
                        }
                    } else {
                         // Handle non-visual artifacts if any, maybe as text.
                    }
                },
                onIntermediateMessage: (interimMessage) => {
                    const message: ChatMessage = {
                        id: Date.now() + Math.random(),
                        role: 'model',
                        content: [{ type: 'text', text: interimMessage }]
                    };
                    setChatHistory(prev => [...prev, message]);
                },
                onFinalAnswer: (answer) => {
                    const finalMessage: ChatMessage = {
                        id: Date.now() + Math.random(),
                        role: 'model',
                        content: [{ type: 'text', text: answer }]
                    };
                    setChatHistory(prev => [...prev, finalMessage]);
                }
            }, analysisPlan, contextToUse, chatHistory);

            if (result.status === 'clarification_needed' && result.question && result.context) {
                const modelMessage: ChatMessage = {
                    id: Date.now(),
                    role: 'model',
                    content: [{ type: 'text', text: result.question }]
                };
                // Replace the thinking message with the clarification question
                setChatHistory(prev => {
                    const historyWithoutThinking = prev.filter(m => m.id !== thinkingId);
                    return [...historyWithoutThinking, modelMessage];
                });
                setClarificationState(result.context);
            }

        } catch (e: any) {
            console.error(e);
            setError(e.message || '不明なエラーが発生しました。');
            const errorMessage: ChatMessage = {
                id: Date.now(),
                role: 'model',
                content: [{ type: 'text', text: `エラー: ${e.message}` }]
            };
            setChatHistory(prev => [...prev.filter(m => m.id !== thinkingId), errorMessage]);

        } finally {
            setIsLoading(false);
        }

    }, [isLoading, dataSets, analysisPlan, clarificationState, chatHistory]);

    if (isDataLoading) {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-100 dark:bg-gray-900">
                <SpinnerIcon className="w-12 h-12 animate-spin text-blue-500" />
                <p className="ml-4 text-lg text-gray-700 dark:text-gray-300">サンプルデータを読み込んでいます...</p>
            </div>
        );
    }

    return (
        <div ref={appContainerRef} className="flex h-screen font-sans text-gray-800 dark:text-gray-200 bg-gray-100 dark:bg-gray-900 overflow-hidden">
            <div 
                className="flex flex-col bg-white dark:bg-gray-800 flex-shrink-0"
                style={{ width: `${leftPanelWidth}px` }}
            >
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white">Treasury Management Agent</h1>
                    <button
                        onClick={handleReset}
                        className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
                        title="分析をリセット"
                    >
                        <RefreshIcon className="w-5 h-5" />
                    </button>
                </div>
                <div className="flex p-1 bg-gray-100 dark:bg-gray-900/50">
                    <button onClick={() => setActiveTab('chat')} className={`flex-1 p-2 text-sm font-semibold rounded-md ${activeTab === 'chat' ? 'bg-white dark:bg-gray-700 shadow' : 'hover:bg-gray-200 dark:hover:bg-gray-700/50'}`}>
                        Chat with Analysis Agent
                    </button>
                    <button onClick={() => setActiveTab('data')} className={`flex-1 p-2 text-sm font-semibold rounded-md ${activeTab === 'data' ? 'bg-white dark:bg-gray-700 shadow' : 'hover:bg-gray-200 dark:hover:bg-gray-700/50'}`}>
                        Data Management
                    </button>
                </div>
                <div className="flex-grow p-4 overflow-y-auto">
                    <AnalysisPlanPanel plan={analysisPlan} refinedInstruction={refinedInstruction} />
                </div>
            </div>

            <Resizer onMouseDown={handleMouseDown('left')} />

            <main className="flex-1 flex flex-row overflow-hidden">
                {activeTab === 'chat' ? (
                   <>
                        <div className="flex-grow flex flex-col h-full min-w-0">
                            <ChatPanel
                                history={chatHistory}
                                onSendMessage={handleSendMessage}
                                isLoading={isLoading}
                                error={error}
                                analysisPlan={analysisPlan}
                            />
                        </div>
                        
                        <Resizer onMouseDown={handleMouseDown('right')} />
                        
                        <div 
                            className="flex-shrink-0 h-full"
                            style={{ width: `${rightPanelWidth}px` }}
                        >
                             <VisualizationPanel artifacts={artifacts} />
                        </div>
                   </>
                ) : (
                    <div className="flex-grow flex flex-col h-full min-w-0 min-h-0">
                        <DataViewer
                            dataSets={dataSets}
                            onDataUpload={handleDataUpload}
                        />
                    </div>
                )}
            </main>
        </div>
    );
};

export default App;
