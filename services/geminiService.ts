
import { FunctionDeclaration, Type, Part, Chat, GenerateContentResponse, GoogleGenAI } from '@google/genai';
import type { DataSets, AnalysisStep, MessageContent, StrategistResponse, ClarificationState, VisualContent, ChatMessage, TextContent, ReportContent } from '../types';
import type { ToolExecutor } from './toolExecutor.tsx';
import { FINAL_REVIEWER_PROMPT, STRATEGIST_PROMPT } from '../constants';
import logger from './loggingService';

const toolSchemas: FunctionDeclaration[] = [
    {
        name: 'get_dataset_schema',
        description: 'Get the schema (column names) of a specified dataset.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                dataset_name: { type: Type.STRING, description: 'The name of the dataset to inspect (e.g., "account_balance", "transaction_history").' },
            },
            required: ['dataset_name'],
        },
    },
    {
        name: 'filter_data',
        description: 'Filter a dataset based on a condition.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                dataset_name: { type: Type.STRING, description: 'Name of the dataset to filter.' },
                column: { type: Type.STRING, description: 'The column to apply the filter on.' },
                operator: { type: Type.STRING, description: 'The comparison operator (e.g., "==", "!=", ">", "<", "contains").' },
                value: { type: Type.STRING, description: 'The value to compare against.' },
            },
            required: ['dataset_name', 'column', 'operator', 'value'],
        },
    },
    {
        name: 'aggregate_data',
        description: "Aggregate data by grouping and applying functions. The resulting aggregated column will be named using underscores as '[aggregation_column]_[aggregation_function]' (e.g., 'amount_sum') and will not contain spaces.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                dataset_name: { type: Type.STRING, description: 'Name of the dataset to aggregate.' },
                group_by_columns: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Columns to group the data by.' },
                aggregation_column: { type: Type.STRING, description: 'The column to perform the aggregation on.' },
                aggregation_function: { type: Type.STRING, description: 'The aggregation function (e.g., "sum", "count", "average", "max", "min").' },
            },
            required: ['dataset_name', 'group_by_columns', 'aggregation_column', 'aggregation_function'],
        },
    },
     {
        name: 'add_column',
        description: "Add a new column to a dataset. This can be based on an arithmetic expression involving two columns or a column and a number (e.g., \"column_a * column_b\" or \"column_a + 100\" or \"-1*column_a\"). Supported operators: +, -, *, /. It can also be used to duplicate an existing column by providing just the column name as the expression (e.g., \"balance\"), or to create a column with a constant value by providing a number (e.g., \"0\") or a quoted string (e.g., \"'some_text'\"). Crucially, it supports using a scalar value from another single-row dataset in the expression, using the syntax 'column_a * [other_dataset].scalar_column'. It also supports conditional logic using a ternary operator with logical operators (&&, ||), e.g., \"column_a > 100 ? 'high' : 'low'\" or \"(column_a == 'AR' || column_a == 'AP') ? -1 * column_b : column_b\".",
        parameters: {
            type: Type.OBJECT,
            properties: {
                dataset_name: { type: Type.STRING, description: 'Name of the dataset to modify.' },
                new_column_name: { type: Type.STRING, description: 'The name of the new column to create. It must not contain spaces; use underscores instead (e.g., "impact_amount").' },
                expression: { type: Type.STRING, description: 'The arithmetic expression to calculate the new column\'s value.' },
            },
            required: ['dataset_name', 'new_column_name', 'expression'],
        },
    },
    {
        name: 'get_descriptive_stats',
        description: 'Calculates descriptive statistics for a strictly numerical column in a dataset. Do not use this on date or string columns. You must verify the column\'s type is \'number\' using \'get_dataset_schema\' before calling this tool.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                dataset_name: { type: Type.STRING, description: 'Name of the dataset.' },
                column: { type: Type.STRING, description: 'The strictly numerical column to get statistics for. Must be of type \'number\'.' },
            },
            required: ['dataset_name', 'column'],
        },
    },
    {
        name: 'join_datasets',
        description: 'Performs a join on two datasets based on a key column. If column names conflict (excluding the join key), the column from the right dataset will be renamed with a "_right" suffix (e.g., "amount_right"). Supports "inner", "left", "right", and "full" joins.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                left_dataset_name: { type: Type.STRING, description: 'Name of the left dataset.' },
                right_dataset_name: { type: Type.STRING, description: 'Name of the right dataset.' },
                left_on_column: { type: Type.STRING, description: 'The key column in the left dataset.' },
                right_on_column: { type: Type.STRING, description: 'The key column in the right dataset.' },
                join_type: { type: Type.STRING, description: 'The type of join to perform. Supported values: "inner", "left", "right", "full".' },
            },
            required: ['left_dataset_name', 'right_dataset_name', 'left_on_column', 'right_on_column', 'join_type'],
        },
    },
    {
        name: 'union_datasets',
        description: 'Vertically concatenates rows from two or more datasets into a single dataset. All datasets must have identical column names and order.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                dataset_names: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: 'An array containing the names of at least two datasets to union.',
                },
            },
            required: ['dataset_names'],
        },
    },
    {
        name: 'forecast_time_series',
        description: 'Forecast future values of a time series using linear regression. This tool adds new columns to the dataset: "forecast", "forecast_upper", and "forecast_lower".',
        parameters: {
            type: Type.OBJECT,
            properties: {
                dataset_name: { type: Type.STRING, description: 'Name of the dataset containing the time series data.' },
                date_column: { type: Type.STRING, description: 'The column containing date or datetime information.' },
                value_column: { type: Type.STRING, description: 'The numerical column to forecast.' },
                forecast_periods: { type: Type.INTEGER, description: 'The number of future periods to forecast.' },
                frequency: {
                    type: Type.STRING,
                    description: 'The frequency of the time periods.',
                    enum: ['daily', 'monthly', 'quarterly']
                },
            },
            required: ['dataset_name', 'date_column', 'value_column', 'forecast_periods', 'frequency'],
        },
    },
    {
        name: 'calculate_correlated_forex_scenario',
        description: '基準となる通貨ペアの仮想的な変動シナリオに基づき、関連性の高い他の通貨ペアの仮想レートを算出します。これはデモ用の簡易的な予測ツールです。',
        parameters: {
            type: Type.OBJECT,
            properties: {
                base_currency_pair: { type: Type.STRING, description: '基準となる通貨ペア (例: "USD/JPY")' },
                scenario_rate: { type: Type.NUMBER, description: '基準通貨ペアのシナリオ（仮想）レート (例: 160.0)' },
                periods: { type: Type.INTEGER, description: '生成する仮想レートの期間（日数）。デフォルトは30。' },
            },
            required: ['base_currency_pair', 'scenario_rate'],
        },
    },
    {
        name: 'verify_visualization_data',
        description: 'Before generating a visualization, verify if the data is suitable (e.g., is it aggregated, does it have the right data types?). You MUST use this tool before calling any render_* tool.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                dataset_name: { type: Type.STRING, description: 'Name of the dataset to verify.' },
                visualization_type: {
                    type: Type.STRING,
                    description: 'The type of visualization planned.',
                    enum: ['bar_chart', 'pie_chart', 'line_chart', 'world_map', 'scatter_plot', 'waterfall_chart']
                },
                columns: {
                    type: Type.OBJECT,
                    description: 'A mapping of visualization roles to column names. E.g., for a bar chart: {"category_column": "country", "value_column": "amount_sum"}',
                    properties: {
                        category_column: { type: Type.STRING, description: "The column for categories/labels (X-axis for bar/waterfall, names for pie, etc.)." },
                        value_column: { type: Type.STRING, description: 'The column for the primary numerical value (Y-axis for bar, slice size for pie, change for waterfall, etc.).' },
                        x_column: { type: Type.STRING, description: "The column for the line chart's or scatter plot's X-axis." },
                        y_columns: { type: Type.ARRAY, items: { type: Type.STRING }, description: "The column(s) for the line chart's Y-axis." },
                        y_column: { type: Type.STRING, description: "The column for the scatter plot's Y-axis." },
                        location_column: { type: Type.STRING, description: 'The column containing country codes (ISO 3166-1 alpha-3) for the world map.' },
                    },
                },
            },
            required: ['dataset_name', 'visualization_type', 'columns'],
        },
    },
    {
        name: 'render_table',
        description: 'Generates a Markdown-formatted string representation of a dataset. This is for embedding tables directly into report summaries. This tool does not create a visual artifact.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                dataset_name: { type: Type.STRING, description: 'Name of the dataset to render.' },
                title: { type: Type.STRING, description: 'The title of the table. It must be concise, descriptive, and ideally under 30 characters.' },
            },
            required: ['dataset_name', 'title'],
        },
    },
    {
        name: 'render_bar_chart',
        description: 'Renders a bar chart from a dataset.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                dataset_name: { type: Type.STRING, description: 'Name of the dataset to visualize.' },
                category_column: { type: Type.STRING, description: 'The column for the X-axis (categories).' },
                value_column: { type: Type.STRING, description: 'The column for the Y-axis (values).' },
                title: { type: Type.STRING, description: 'The title of the chart. It must be concise, descriptive, and ideally under 30 characters.' },
            },
            required: ['dataset_name', 'category_column', 'value_column', 'title'],
        },
    },
    {
        name: 'render_pie_chart',
        description: 'Renders a pie chart from a dataset.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                dataset_name: { type: Type.STRING, description: 'Name of the dataset to visualize.' },
                category_column: { type: Type.STRING, description: 'The column for the slice names.' },
                value_column: { type: Type.STRING, description: 'The column for the slice values.' },
                title: { type: Type.STRING, description: 'The title of the chart. It must be concise, descriptive, and ideally under 30 characters.' },
            },
            required: ['dataset_name', 'category_column', 'value_column', 'title'],
        },
    },
    {
        name: 'render_line_chart',
        description: 'Renders a line chart from a dataset.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                dataset_name: { type: Type.STRING, description: 'Name of the dataset to visualize.' },
                x_column: { type: Type.STRING, description: 'The column for the X-axis.' },
                y_columns: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'The column(s) for the Y-axis.' },
                title: { type: Type.STRING, description: 'The title of the chart. It must be concise, descriptive, and ideally under 30 characters.' },
            },
            required: ['dataset_name', 'x_column', 'y_columns', 'title'],
        },
    },
    {
        name: 'render_world_map',
        description: 'Renders a world map with data points from a dataset.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                dataset_name: { type: Type.STRING, description: 'Name of the dataset to visualize.' },
                location_column: { type: Type.STRING, description: 'The column containing country codes (ISO 3166-1 alpha-3).' },
                value_column: { type: Type.STRING, description: 'The column for the data point values (e.g., magnitude).' },
                title: { type: Type.STRING, description: 'The title of the map. It must be concise, descriptive, and ideally under 30 characters.' },
            },
            required: ['dataset_name', 'location_column', 'value_column', 'title'],
        },
    },
    {
        name: 'render_scatter_plot',
        description: 'Renders a scatter plot from a dataset. Useful for showing the relationship between two numerical variables.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                dataset_name: { type: Type.STRING, description: 'Name of the dataset to visualize.' },
                x_column: { type: Type.STRING, description: 'The column for the X-axis (must be numerical).' },
                y_column: { type: Type.STRING, description: 'The column for the Y-axis (must be numerical).' },
                title: { type: Type.STRING, description: 'The title of the chart. It must be concise, descriptive, and ideally under 30 characters.' },
            },
            required: ['dataset_name', 'x_column', 'y_column', 'title'],
        },
    },
    {
        name: 'render_waterfall_chart',
        description: 'Renders a waterfall chart to show the cumulative effect of sequentially introduced positive or negative values.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                dataset_name: { type: Type.STRING, description: 'Name of the dataset to visualize.' },
                category_column: { type: Type.STRING, description: 'The column for the categories on the X-axis.' },
                value_column: { type: Type.STRING, description: 'The column for the positive or negative values that contribute to the total.' },
                title: { type: Type.STRING, description: 'The title of the chart. It must be concise, descriptive, and ideally under 30 characters.' },
            },
            required: ['dataset_name', 'category_column', 'value_column', 'title'],
        },
    },
    {
        name: 'generate_report',
        description: 'Generates a final report summarizing the analysis, including specified visualizations. This should be the final step of an analysis.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                title: { type: Type.STRING, description: 'The title of the final report. It must be concise, descriptive, and ideally under 30 characters.' },
                summary: { type: Type.STRING, description: 'A detailed summary of the analysis findings, written in Markdown format.' },
                artifact_titles: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'An array of exact titles of the previously generated charts, maps, or tables to include in the report. You must use the exact titles from the artifacts you created earlier.' },
            },
            required: ['title', 'summary', 'artifact_titles'],
        },
    },
];

export function getToolSchemas(): FunctionDeclaration[] {
    return toolSchemas;
}

interface RunChatCallbacks {
    onPlanGenerated: (plan: AnalysisStep[]) => void;
    onStepUpdate: (updatedStep: AnalysisStep) => void;
    onArtifactGenerated: (artifact: VisualContent) => void;
    onReviewCompleted: (reviewedArtifacts: VisualContent[]) => void;
    onIntermediateMessage: (message: string) => void;
    onFinalAnswer: (answer: string) => void;
    onAnalysisStart?: () => void;
    onRefinedInstruction?: (instruction: string) => void;
}

interface ReviewResult {
    decision: 'approve' | 'revise';
    feedback: string | null;
    revisedText: string | null;
    revisedArtifacts?: {
        title: string;
        summary: string;
    }[];
}

function translateErrorMessage(errorMessage: string): string {
    console.error("Original error:", errorMessage); // Log the original error for debugging

    if (errorMessage.includes("Dataset") && errorMessage.includes("not found")) {
        return "分析に必要なデータが見つかりませんでした。データが正しく読み込まれているか確認してください。";
    }
    if (errorMessage.includes("Column") && errorMessage.includes("does not exist")) {
        return "データ内に指定された項目（列）が見つかりませんでした。別の項目名で試すか、データの内容を確認してください。";
    }
    if (errorMessage.includes("No numerical data found")) {
        return "計算に使用しようとした項目に、数値データが含まれていませんでした。集計方法や対象の項目を見直してください。";
    }
    if (errorMessage.includes("filter") && errorMessage.includes("resulted in 0 rows")) {
        // This case is a warning from the tool, but we can message it here if it becomes a hard error.
        return "指定された条件でデータを絞り込んだ結果、該当するデータが1件もありませんでした。条件を変更して再度お試しください。";
    }
    if (errorMessage.includes("Invalid expression format")) {
        return "新しい項目を追加するための計算式に誤りがありました。";
    }
    if (errorMessage.includes("Unsupported aggregation function")) {
        return "サポートされていない集計方法が指定されました。（例：合計、平均、件数など）";
    }
    if (errorMessage.includes("requires at least two data points")) {
        return "時系列予測を行うには、少なくとも2つ以上のデータポイントが必要です。";
    }

    // Default fallback message
    return "分析中に予期せぬエラーが発生しました。";
}

async function callStrategist(ai: GoogleGenAI, userQuery: string, dataSets: DataSets, history: ChatMessage[]): Promise<StrategistResponse> {
    const model = 'gemini-2.5-pro';
    
    const schemaSummaries = Object.entries(dataSets)
        .map(([name, ds]) => `- ${name}: [${ds.stats.columnNames.join(', ')}]`)
        .join('\n');
    
    const conversationHistory = history
        .filter(msg => msg.content[0]?.type === 'text' && !msg.isThinking)
        .map(msg => {
            const role = msg.role === 'model' ? 'AI' : 'User';
            const text = (msg.content[0] as TextContent).text.replace('[USER_INPUT_REQUIRED]', '').trim();
            return `${role}: ${text}`;
        })
        .join('\n');
    
    const prompt = STRATEGIST_PROMPT
        .replace('{DATASET_SCHEMAS}', schemaSummaries)
        .replace('{USER_QUERY}', userQuery)
        .replace('{CONVERSATION_HISTORY}', conversationHistory || 'なし');

    logger.logStrategistPrompt(prompt);
    
    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const response = await ai.models.generateContent({
                model: model,
                contents: prompt,
                config: {
                    responseMimeType: 'application/json',
                }
            });
            
            let jsonStr = response.text.trim();
            if (jsonStr.startsWith("```json")) {
                jsonStr = jsonStr.substring(7, jsonStr.length - 3).trim();
            }
            
            const result: StrategistResponse = JSON.parse(jsonStr);
            return result;

        } catch (e) {
            console.error(`Strategist AI call attempt ${attempt} failed:`, e);
            if (attempt === maxRetries) {
                // Last attempt failed, so we'll use the fallback.
                break;
            }
            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
    }

    // Fallback: If strategist fails after all retries, assume the query is clear to avoid blocking the user.
    console.error("Strategist AI call failed after multiple retries. Using fallback.");
    return {
        is_clear: true,
        questions_for_user: [],
        instructions_for_planner_ai: "ストラテジストAIの呼び出しに失敗しました。ユーザーのクエリを直接処理してください。"
    };
}


async function callFinalReviewer(
    ai: GoogleGenAI,
    analysisInstruction: string,
    analysisPlan: AnalysisStep[],
    finalAnswerDraft: string,
    artifacts: VisualContent[]
): Promise<ReviewResult> {
    const model = 'gemini-2.5-pro';
    
    const summarizedPlan = analysisPlan.map(step => ({
        tool: step.toolCall.name,
        args: step.toolCall.args,
        status: step.status,
        result_summary: step.result ? {
            new_dataset_name: step.result.new_dataset_name,
            rows: step.result.rows,
            message: step.result.message,
            warning: step.result.warning,
        } : null
    }));

    const summarizedArtifacts = artifacts.map(a => ({
        type: a.type,
        title: a.title,
        isReviewed: !!a.isReviewed,
    }));

    const prompt = `
${FINAL_REVIEWER_PROMPT}

---
**レビュー対象:**

**1. 分析指示:**
\`\`\`
${analysisInstruction}
\`\`\`

**2. 完全な分析計画:**
\`\`\`json
${JSON.stringify(summarizedPlan, null, 2)}
\`\`\`

**3. 生成された成果物リスト:**
\`\`\`json
${JSON.stringify(summarizedArtifacts, null, 2)}
\`\`\`

**4. 最終テキスト草案:**
\`\`\`markdown
${finalAnswerDraft}
\`\`\`
---
`;
    const contents: Part[] = [{ text: prompt }];

    const reportArtifact = artifacts.find(a => a.type === 'report' && (a as ReportContent).imageBase64) as ReportContent | undefined;
    if (reportArtifact?.imageBase64) {
        contents.push({
            inlineData: {
                mimeType: 'image/jpeg',
                data: reportArtifact.imageBase64,
            },
        });
    }

    logger.logReviewerPrompt(prompt, summarizedArtifacts);

    try {
        const response = await ai.models.generateContent({
            model: model,
            contents: contents,
            config: {
                responseMimeType: 'application/json',
            }
        });
        
        let jsonStr = response.text.trim();
        if (jsonStr.startsWith("```json")) {
            jsonStr = jsonStr.substring(7, jsonStr.length - 3).trim();
        }
        
        const result: ReviewResult = JSON.parse(jsonStr);
        return result;

    } catch (e) {
        console.error("Reviewer AI call failed:", e);
        // Fallback: If reviewer fails, approve the original content to avoid blocking the flow.
        return {
            decision: 'approve',
            feedback: 'Reviewer AI failed, approving automatically.',
            revisedText: finalAnswerDraft
        };
    }
}


export async function runChat(
    chat: Chat,
    ai: GoogleGenAI,
    message: string,
    dataSets: DataSets,
    toolExecutor: ToolExecutor,
    callbacks: RunChatCallbacks,
    existingPlan: AnalysisStep[],
    clarificationState: ClarificationState | null,
    chatHistory: ChatMessage[]
): Promise<{ status: 'completed' | 'clarification_needed'; question?: string; context?: ClarificationState; }> {
    toolExecutor.loadData(dataSets);

    const availableArtifacts = toolExecutor.getArtifacts();
    let artifactListMessage = '';
    if (availableArtifacts.length > 0) {
        const artifactTitles = availableArtifacts.map(a => `"${a.title}"`).join(', ');
        artifactListMessage = `\n\n利用可能な成果物は次のとおりです: [${artifactTitles}]。\`generate_report\`を呼び出す際は、これらの正確なタイトルを\`artifact_titles\`引数で使用しなければなりません。`;
    }

    let currentMessage: string | Part[];
    let analysisInstructionForReviewer = '';
    let newArtifactGeneratedThisTurn = false;
    
    // If we are in a clarification loop, continue it.
    // Otherwise, any new message from the user triggers the strategist to define the next task.
    if (clarificationState) {
        // This is a response to a clarification question from the strategist.
        const activeClarificationState: ClarificationState = {
            ...clarificationState,
            history: [...clarificationState.history, { role: 'user', text: message }]
        };

        const strategistResponse = await callStrategist(ai, message, dataSets, chatHistory);

        if (!strategistResponse.is_clear) {
            const formattedQuestions = strategistResponse.questions_for_user.join('\n');
            const fullQuestion = `${formattedQuestions}\n\n[USER_INPUT_REQUIRED]`;

            const newHistoryEntry = { role: 'model' as const, text: fullQuestion };
            const updatedState: ClarificationState = {
                ...activeClarificationState,
                history: [...activeClarificationState.history, newHistoryEntry]
            };

            return {
                status: 'clarification_needed',
                question: fullQuestion,
                context: updatedState
            };
        }
        
        analysisInstructionForReviewer = strategistResponse.instructions_for_planner_ai;
        callbacks.onRefinedInstruction?.(analysisInstructionForReviewer);
        callbacks.onAnalysisStart?.();

        const initialPlannerMessage = `The user's request is: "${activeClarificationState.originalQuery}".
After a clarification conversation, the refined instruction for you is: "${analysisInstructionForReviewer}".
Please create and execute a detailed, step-by-step plan based on this refined instruction.${artifactListMessage}`;
        
        logger.logPlannerInstruction(initialPlannerMessage);
        currentMessage = initialPlannerMessage;

    } else {
        // This is a new query or a follow-up instruction. Run the strategist.
        const strategistResponse = await callStrategist(ai, message, dataSets, chatHistory);

        if (!strategistResponse.is_clear) {
            const formattedQuestions = strategistResponse.questions_for_user.join('\n');
            const fullQuestion = `${formattedQuestions}\n\n[USER_INPUT_REQUIRED]`;

             const newClarificationState: ClarificationState = {
                originalQuery: message,
                history: [{ role: 'model', text: fullQuestion }]
            };

            return {
                status: 'clarification_needed',
                question: fullQuestion,
                context: newClarificationState
            };
        }
        
        analysisInstructionForReviewer = strategistResponse.instructions_for_planner_ai;
        callbacks.onRefinedInstruction?.(analysisInstructionForReviewer);
        callbacks.onAnalysisStart?.();

        const initialPlannerMessage = `Based on the user's latest request ("${message}") and the conversation history, the refined instruction for you is: "${analysisInstructionForReviewer}". Please create and execute a step-by-step plan based on this refined instruction. If previous analysis steps have already produced necessary data, you may reuse it.${artifactListMessage}`;
        
        logger.logPlannerInstruction(initialPlannerMessage);
        currentMessage = initialPlannerMessage;
    }


    let fullPlan: AnalysisStep[] = [...existingPlan];
    let hasError = false;
    let emptyResponseCount = 0;
    let invalidResponseCount = 0;
    const MAX_INVALID_RESPONSES = 2;
    const MAX_TURNS = 200;
    
    let consecutiveErrors = 0;
    const MAX_CONSECUTIVE_ERRORS = 2;

    let turn;
    for (turn = 0; turn < MAX_TURNS; turn++) {
        const result: GenerateContentResponse = await chat.sendMessage({ message: currentMessage });
        const responseText = result.text;
        const functionCalls = result.functionCalls;

        if (!responseText && (!functionCalls || functionCalls.length === 0)) {
            emptyResponseCount++;
            if (emptyResponseCount > 1) {
                break;
            }
            callbacks.onIntermediateMessage("処理中...");
            currentMessage = "You have not provided a response or a tool call. Please review the work you have done in the previous steps and provide a final answer summarizing your findings to the user in Markdown format.";
            continue;
        }
        emptyResponseCount = 0;
        
        const runningRevisionStep = fullPlan.find(s => (s.toolCall.name === 'revise_plan_based_on_feedback' || s.toolCall.name === 'revise_plan_due_to_error') && s.status === 'running');
        if (runningRevisionStep && functionCalls && functionCalls.length > 0) {
            const completedRevisionStep: AnalysisStep = { ...runningRevisionStep, status: 'completed', result: { message: '新しい計画が生成されました。' } };
            callbacks.onStepUpdate(completedRevisionStep);
            fullPlan = fullPlan.map(s => s.id === completedRevisionStep.id ? completedRevisionStep : s);
        }
        
        if (responseText?.includes('[USER_INPUT_REQUIRED]')) {
            invalidResponseCount = 0;
            callbacks.onFinalAnswer(responseText.trim());
            return { status: 'completed' };
        }

        if (functionCalls && functionCalls.length > 0) {
            invalidResponseCount = 0;
            if (responseText) {
                callbacks.onIntermediateMessage(responseText);
            }
            
            const newSteps: AnalysisStep[] = functionCalls.map((call, index) => ({
                id: `as-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                step: fullPlan.length + index + 1,
                description: `Executing tool: ${call.name}`,
                status: 'pending',
                toolCall: call,
            }));
            
            fullPlan = [...fullPlan, ...newSteps];
            callbacks.onPlanGenerated(fullPlan);

            const toolExecutionParts: Part[] = [];
            let selfCorrectionPrompt: string | null = null;

            for (const step of newSteps) {
                callbacks.onStepUpdate({ ...step, status: 'running' });
                try {
                    const { result, artifact, newDataSet } = await toolExecutor.execute(step.toolCall);
                    consecutiveErrors = 0; 
                    if (artifact) {
                        newArtifactGeneratedThisTurn = true;
                        callbacks.onArtifactGenerated(artifact as VisualContent);
                    }
                    toolExecutionParts.push({ functionResponse: { name: step.toolCall.name, response: result, id: step.toolCall.id } });
                    const updatedStep: AnalysisStep = { ...step, status: 'completed', result, resultDataset: newDataSet };
                    callbacks.onStepUpdate(updatedStep);
                    fullPlan = fullPlan.map(s => s.id === updatedStep.id ? updatedStep : s);

                } catch (e: any) {
                    consecutiveErrors++;
                    const errorMessage = e.message || '不明なツールエラーが発生しました。';
                    const errorStep = { ...step, status: 'error' as const, error: errorMessage };
                    callbacks.onStepUpdate(errorStep);
                    fullPlan = fullPlan.map(s => s.id === errorStep.id ? errorStep : s);
                    
                    if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
                        hasError = true;
                        const userFriendlyError = translateErrorMessage(errorMessage);
                        const finalMessage = `${userFriendlyError}\n\n繰り返しエラーが発生したため分析を停止しました。お手数ですが、別の質問や分析方法をお試しください。`;
                        callbacks.onFinalAnswer(finalMessage);
                        break;
                    } else {
                        callbacks.onIntermediateMessage("ツールの実行エラー。計画を修正して再試行します。");
                        const revisionStep: AnalysisStep = {
                            id: `as-${Date.now()}-error-revision`,
                            step: fullPlan.length + 1,
                            description: `エラー発生のため計画を修正中`,
                            status: 'running',
                            toolCall: { name: 'revise_plan_due_to_error', args: {} },
                        };
                        fullPlan.push(revisionStep);
                        callbacks.onPlanGenerated(fullPlan);
                        
                        selfCorrectionPrompt = `The tool call '${step.toolCall.name}' failed with the error: "${errorMessage}". Do not apologize. Analyze the error and determine the best immediate next step to fix it. This could be re-running the tool with corrected parameters or using a different tool. State your correction concisely and then call the corrected tool. Do not generate a full new plan. Just proceed with the single next corrective step.${artifactListMessage}`;
                        break; 
                    }
                }
            }
            
            if (hasError) { break; }

            if (selfCorrectionPrompt) {
                logger.logPlannerInstruction(selfCorrectionPrompt);
                currentMessage = selfCorrectionPrompt;
            } else {
                currentMessage = toolExecutionParts;
            }
            continue;
        }
        
        if (responseText) {
            if (newArtifactGeneratedThisTurn) {
                invalidResponseCount = 0;
                const reviewStep: AnalysisStep = {
                    id: `as-${Date.now()}-review`,
                    step: fullPlan.length + 1,
                    description: 'AIの回答と成果物をレビュー中',
                    status: 'pending',
                    toolCall: { name: 'conduct_final_review', args: {} },
                };
                fullPlan.push(reviewStep);
                callbacks.onPlanGenerated(fullPlan);
                
                callbacks.onStepUpdate({ ...reviewStep, status: 'reviewing' });
                const reviewResult = await callFinalReviewer(ai, analysisInstructionForReviewer, fullPlan, responseText, toolExecutor.getArtifacts());
                
                if (reviewResult.decision === 'revise' && reviewResult.feedback) {
                    const warningStep: AnalysisStep = { ...reviewStep, status: 'warning', result: { feedback: reviewResult.feedback } };
                    callbacks.onStepUpdate(warningStep);
                    fullPlan = fullPlan.map(s => s.id === warningStep.id ? warningStep : s);

                    const revisionStep: AnalysisStep = {
                        id: `as-${Date.now()}-revision`,
                        step: fullPlan.length + 1,
                        description: 'レビュー指摘に基づいて計画を修正します。',
                        status: 'running',
                        toolCall: { name: 'revise_plan_based_on_feedback', args: {} },
                    };
                    fullPlan.push(revisionStep);
                    callbacks.onPlanGenerated(fullPlan);
                    callbacks.onIntermediateMessage(`レビュー指摘: ${reviewResult.feedback}`);
                    currentMessage = `Your previous work was reviewed and requires correction. The previous steps of your plan are complete, but the final result was incorrect. Based on the following feedback, generate ONLY the additional steps needed to address the feedback and produce the correct final result. Do not repeat steps that have already been successfully completed. Review Feedback: "${reviewResult.feedback}"${artifactListMessage}`;
                    logger.logPlannerInstruction(currentMessage as string);
                    continue;
                } else {
                    if (reviewResult.revisedArtifacts && reviewResult.revisedArtifacts.length > 0) {
                        callbacks.onIntermediateMessage("レビューAIがレポート内容を改善しました。");
                        await toolExecutor.updateArtifacts(reviewResult.revisedArtifacts);
                    }
                    const completedStep: AnalysisStep = { ...reviewStep, status: 'completed', result: { message: '承認されました。' } };
                    callbacks.onStepUpdate(completedStep);
                    const reviewedArtifacts = toolExecutor.markAllArtifactsAsReviewed();
                    callbacks.onReviewCompleted(reviewedArtifacts);
                    callbacks.onFinalAnswer(reviewResult.revisedText || responseText);
                    return { status: 'completed' };
                }
            } else {
                // No artifact generated. Check if it's a valid final answer.
                const isShortOrGeneric = responseText.trim().length < 40 || /^(承知しました|わかりました|処理を続けます|はい|了解|続行します)/.test(responseText.trim());

                if (isShortOrGeneric) {
                    invalidResponseCount++;
                    if (invalidResponseCount >= MAX_INVALID_RESPONSES) {
                        const errorMessage = "AIが不適切な応答を繰り返したため、分析を停止しました。";
                        callbacks.onFinalAnswer(errorMessage);
                        return { status: 'completed' };
                    }
                    callbacks.onIntermediateMessage("AIの応答が不完全です。分析を続けるように再試行します。");
                    currentMessage = "That was not a valid response. Your response was too short and not a valid final answer. According to your instructions, you must either call a tool, ask a clarifying question to the user, or provide a comprehensive final summary of the analysis. Please proceed with the next step of the plan by calling the next appropriate tool.";
                    logger.logPlannerInstruction(currentMessage);
                    continue;
                } else {
                    invalidResponseCount = 0;
                    callbacks.onFinalAnswer(responseText);
                    return { status: 'completed' };
                }
            }
        }
    }

    if (hasError) {
        // The error message has already been sent inside the loop.
    } else if (turn >= MAX_TURNS) {
        callbacks.onFinalAnswer("分析が最大ステップ数に達したため停止しました。");
    } else {
        callbacks.onFinalAnswer("AIからの応答が空でした。分析を終了します。");
    }

    return { status: 'completed' };
}
