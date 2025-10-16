import type { DataType } from './constants';

export type CsvRow = Record<string, string | number | null>;

export interface DataSet {
    name: string;
    data: CsvRow[];
    stats: {
        rows: number;
        columns: number;
        columnNames: string[];
    };
}

export type DataSets = Partial<Record<DataType, DataSet>>;

export interface TextContent {
    type: 'text';
    text: string;
}

export interface TableContent {
    type: 'table';
    title: string;
    data: DataSet;
}

export interface BarChartContent {
    type: 'bar_chart';
    title: string;
    data: CsvRow[];
    categoryKey: string;
    valueKey: string;
}

export interface PieChartContent {
    type: 'pie_chart';
    title: string;
    data: CsvRow[];
    nameKey: string;
    valueKey: string;
}

export interface LineChartContent {
    type: 'line_chart';
    title: string;
    data: CsvRow[];
    xKey: string;
    yKeys: string[];
}

export interface WorldMapContent {
    type: 'world_map';
    title: string;
    data: CsvRow[];
    locationKey: string;
    valueKey: string;
}

export interface ReportContent {
    type: 'report';
    title: string;
    summary: string;
    artifacts: VisualContent[];
}

export type VisualContent = TableContent | BarChartContent | PieChartContent | LineChartContent | WorldMapContent | ReportContent;

export type MessageContent = TextContent | VisualContent;


export interface ChatMessage {
    id: number;
    role: 'user' | 'model';
    content: MessageContent[];
    isThinking?: boolean;
}

export type AnalysisStepStatus = 'pending' | 'running' | 'completed' | 'error' | 'reviewing' | 'warning';

export interface AnalysisStep {
    id: string;
    step: number;
    description: string;
    status: AnalysisStepStatus;
    toolCall: any; // Simplified for this example
    result?: { 
        new_dataset_name?: string; 
        rows?: number; 
        message?: string; 
        columns?: string[] | { name: string; type: string; }[];
        warning?: string;
        // From getDescriptiveStats
        statistics?: Record<string, number | undefined>;
        // From aggregateData single result
        data?: CsvRow;
        // From get_dataset_schema
        preview_rows?: CsvRow[];
        // From render tools for AI to verify
        data_preview?: CsvRow[];
        // For review steps
        feedback?: string;
    };
    resultDataset?: DataSet;
    error?: string;
}

export interface StrategistResponse {
    is_clear: boolean;
    questions_for_user: string[];
    recommendations_for_user: string[];
    instructions_for_planner_ai: string;
}

export interface ClarificationState {
    originalQuery: string;
    history: {
        role: 'user' | 'model';
        text: string;
    }[];
}