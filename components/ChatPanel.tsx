
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import type { ChatMessage, MessageContent, TextContent, AnalysisStep } from '../types';
import { SendIcon, UserIcon, BotIcon, SpinnerIcon, ChevronDownIcon, ChevronUpIcon } from './icons';

interface ChatPanelProps {
    history: ChatMessage[];
    onSendMessage: (message: string) => void;
    isLoading: boolean;
    error: string | null;
    analysisPlan: AnalysisStep[];
}

const MessageContentRenderer: React.FC<{ content: MessageContent }> = ({ content }) => {
    switch (content.type) {
        case 'text': {
            let html = '';
            try {
                // Enable GFM and line breaks for better chat formatting
                html = marked.parse(content.text.replace('[USER_INPUT_REQUIRED]', '') || '', { gfm: true, breaks: true }) as string;
            } catch (e) {
                console.error("Error parsing markdown:", e);
                html = content.text; // Fallback to plain text
            }
            const sanitizedHtml = DOMPurify.sanitize(html);
            return (
                <div
                    className="markdown-content"
                    dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
                />
            );
        }
        default:
            // Visual content types are rendered in VisualizationPanel
            return null;
    }
};

const ChatPanel: React.FC<ChatPanelProps> = ({ history, onSendMessage, isLoading, error, analysisPlan }) => {
    const [input, setInput] = useState('');
    const [expandedMessages, setExpandedMessages] = useState(new Set<number>());
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(scrollToBottom, [history]);
    
    const toggleCollapse = (id: number) => {
        setExpandedMessages(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    };

    const handleSend = () => {
        if (input.trim() && !isLoading) {
            onSendMessage(input);
            setInput('');
        }
    };
    
    const groupedHistory = useMemo(() => {
        const groups: (ChatMessage | ChatMessage[])[] = [];
        if (!history || history.length === 0) return groups;

        let currentModelGroup: ChatMessage[] = [];

        for (const msg of history) {
            const isGroupableModelMsg = msg.role === 'model';

            if (isGroupableModelMsg) {
                currentModelGroup.push(msg);
            } else {
                if (currentModelGroup.length > 0) {
                    groups.push(currentModelGroup);
                    currentModelGroup = [];
                }
                groups.push(msg);
            }
        }

        if (currentModelGroup.length > 0) {
            groups.push(currentModelGroup);
        }

        return groups;
    }, [history]);

    return (
        <div className="flex flex-col h-full bg-slate-50">
            <div className="flex-grow p-6 overflow-y-auto">
                <div className="space-y-6">
                    {groupedHistory.map((groupOrMsg, groupIndex) => {
                        const key = Array.isArray(groupOrMsg) ? groupOrMsg[0].id : (groupOrMsg as ChatMessage).id;
                        
                        if (Array.isArray(groupOrMsg)) {
                            const modelGroup = groupOrMsg;
                            if (modelGroup.length === 0) return null;

                            const groupId = modelGroup[0].id;
                            const isExpanded = expandedMessages.has(groupId);

                            const latestMessage = modelGroup[modelGroup.length - 1];
                            const latestMessageText = latestMessage.content.find((c): c is TextContent => c.type === 'text')?.text || '';
                            const previousMessages = modelGroup.slice(0, -1);
                            const hasPreviousMessages = previousMessages.length > 0;
                            const isQuestion = latestMessageText.includes('[USER_INPUT_REQUIRED]') || (!isLoading && latestMessageText.trim().endsWith('?'));


                            const isLastGroup = groupIndex === groupedHistory.length - 1;
                            let headerText = "Completed!";

                            if (isQuestion) {
                                headerText = "Waiting for User Input";
                            } else if (isLastGroup && isLoading) {
                                headerText = "Thinking...";
                            } else if (isLastGroup && !isLoading) {
                                // Process has finished, determine the final state
                                const lastStep = analysisPlan.length > 0 ? analysisPlan[analysisPlan.length - 1] : null;
                                const isReviewApproved = lastStep?.toolCall.name === 'conduct_final_review' && lastStep?.status === 'completed';

                                if (isReviewApproved) {
                                    headerText = "Completed!";
                                } else if (error || lastStep?.status === 'error') {
                                    headerText = "Analysis Stopped Due to Error";
                                } else if (latestMessageText.includes('停止しました')) {
                                    headerText = "Analysis Stopped";
                                } else {
                                    headerText = "Analysis Stopped";
                                }
                            }


                            return (
                                <div key={groupId} className="flex items-start gap-4">
                                    <div className="w-8 h-8 rounded-full bg-slate-300 flex items-center justify-center flex-shrink-0">
                                        <BotIcon className="w-5 h-5 text-slate-700" />
                                    </div>
                                    <div className="max-w-xl w-full rounded-lg overflow-hidden bg-slate-200 shadow">
                                        <button 
                                            onClick={() => toggleCollapse(groupId)} 
                                            className="flex items-center justify-between w-full p-4 text-left font-medium text-slate-900 hover:bg-slate-300/50 disabled:cursor-default disabled:hover:bg-transparent"
                                            aria-expanded={isExpanded}
                                            disabled={!hasPreviousMessages}
                                        >
                                            <span className="flex items-center">
                                                {headerText}
                                                {headerText === "Thinking..." && (
                                                    <div className="typing-indicator inline-flex items-center ml-2 space-x-1">
                                                        <span></span>
                                                        <span></span>
                                                        <span></span>
                                                    </div>
                                                )}
                                            </span>
                                            {hasPreviousMessages && (
                                                isExpanded ? <ChevronUpIcon className="w-5 h-5 text-slate-500" /> : <ChevronDownIcon className="w-5 h-5 text-slate-500" />
                                            )}
                                        </button>
                                        
                                        <div className="p-4 border-t border-slate-300 bg-slate-50">
                                            {isExpanded && hasPreviousMessages && (
                                                <div className="pb-4 mb-4 border-b border-slate-300 space-y-4">
                                                    {previousMessages.map((msg, msgIndex) => (
                                                        <div key={msg.id} className={msgIndex > 0 ? "pt-4 border-t border-slate-300" : ""}>
                                                            {msg.content.map((content, contentIndex) => (
                                                                <MessageContentRenderer key={contentIndex} content={content} />
                                                            ))}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            
                                            <div>
                                                {latestMessage.content.map((content, contentIndex) => (
                                                    <MessageContentRenderer key={contentIndex} content={content} />
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        }
                        
                        const msg = groupOrMsg as ChatMessage;
                        
                        if (msg.role === 'user') {
                             return (
                                <div key={msg.id} className="flex items-start gap-4 justify-end">
                                    <div className="max-w-xl rounded-lg overflow-hidden bg-blue-500 text-white">
                                        <div className="p-4">
                                            {msg.content.map((content, index) => (
                                                <MessageContentRenderer key={index} content={content} />
                                            ))}
                                        </div>
                                    </div>
                                    <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                                        <UserIcon className="w-5 h-5 text-white" />
                                    </div>
                                </div>
                            );
                        }
                        return null;
                    })}
                </div>
                <div ref={messagesEndRef} />
            </div>
            {error && <div className="px-6 py-2 text-sm text-red-500 bg-red-100">{error}</div>}
            <div className="p-4 bg-slate-50 border-t border-slate-300">
                <div className="relative">
                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSend();
                            }
                        }}
                        placeholder="データについて質問してください..."
                        className="w-full p-3 pr-20 rounded-lg border border-gray-300 bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
                        rows={1}
                        disabled={isLoading}
                    />
                    <button
                        onClick={handleSend}
                        disabled={isLoading || !input.trim()}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-md bg-blue-500 text-white hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                        {isLoading ? <SpinnerIcon className="w-5 h-5 animate-spin" /> : <SendIcon className="w-5 h-5" />}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ChatPanel;
