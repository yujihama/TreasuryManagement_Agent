
import { FunctionDeclaration, Type, Part, Chat, GenerateContentResponse, GoogleGenAI } from '@google/genai';
import type { DataSets, AnalysisStep, MessageContent, StrategistResponse, ClarificationState, VisualContent, ChatMessage } from '../types';
import type { ToolExecutor } from './toolExecutor';
import { FINAL_REVIEWER_PROMPT, STRATEGIST_PROMPT } from '../constants';

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
        description: "Aggregate data by grouping and applying functions. The resulting aggregated column will be named '[aggregation_column]_[aggregation_function]', e.g., 'amount_sum'.",
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
        description: 'Add a new column to a dataset based on a simple arithmetic expression involving two columns or a column and a number (e.g., "column_a * column_b" or "column_a + 100"). Supported operators: +, -, *, /.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                dataset_name: { type: Type.STRING, description: 'Name of the dataset to modify.' },
                new_column_name: { type: Type.STRING, description: 'The name of the new column to create.' },
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
        description: 'Performs a join on two datasets based on a key column. Supports "inner", "left", "right", and "full" joins.',
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
        name: 'forecast_time_series',
        description: 'Forecast future values of a time series using linear regression.',
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
        name: 'verify_visualization_data',
        description: 'Before generating a visualization, verify if the data is suitable (e.g., is it aggregated, does it have the right data types?). You MUST use this tool before calling any render_* tool.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                dataset_name: { type: Type.STRING, description: 'Name of the dataset to verify.' },
                visualization_type: {
                    type: Type.STRING,
                    description: 'The type of visualization planned.',
                    enum: ['bar_chart', 'pie_chart', 'line_chart', 'world_map']
                },
                columns: {
                    type: Type.OBJECT,
                    description: 'A mapping of visualization roles to column names. E.g., for a bar chart: {"category_column": "country", "value_column": "amount_sum"}',
                    properties: {
                        category_column: { type: Type.STRING, description: "The column for the bar chart's X-axis (categories)." },
                        value_column: { type: Type.STRING, description: 'The column for the value axis (e.g., bar height, pie slice size).' },
                        name_column: { type: Type.STRING, description: "The column for the pie chart's slice names." },
                        x_column: { type: Type.STRING, description: "The column for the line chart's X-axis." },
                        y_columns: { type: Type.ARRAY, items: { type: Type.STRING }, description: "The column(s) for the line chart's Y-axis." },
                        location_column: { type: Type.STRING, description: 'The column containing country codes (ISO 3166-1 alpha-3) for the world map.' },
                    },
                },
            },
            required: ['dataset_name', 'visualization_type', 'columns'],
        },
    },
    {
        name: 'render_table',
        description: 'Renders a table from a dataset to be included in visualizations or reports.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                dataset_name: { type: Type.STRING, description: 'Name of the dataset to render.' },
                title: { type: Type.STRING, description: 'The title of the table.' },
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
                title: { type: Type.STRING, description: 'The title of the chart.' },
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
                name_column: { type: Type.STRING, description: 'The column for the slice names.' },
                value_column: { type: Type.STRING, description: 'The column for the slice values.' },
                title: { type: Type.STRING, description: 'The title of the chart.' },
            },
            required: ['dataset_name', 'name_column', 'value_column', 'title'],
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
                title: { type: Type.STRING, description: 'The title of the chart.' },
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
                title: { type: Type.STRING, description: 'The title of the map.' },
            },
            required: ['dataset_name', 'location_column', 'value_column', 'title'],
        },
    },
    {
        name: 'generate_report',
        description: 'Generates a final report summarizing the analysis, including specified visualizations. This should be the final step of an analysis.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                title: { type: Type.STRING, description: 'The title of the final report.' },
                summary: { type: Type.STRING, description: 'A detailed summary of the analysis findings, written in Markdown format.' },
                artifact_titles: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'An array of titles of the charts, maps, or tables to include in the report.' },
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
    onIntermediateMessage: (message: string) => void;
    onFinalAnswer: (answer: string) => void;
    onAnalysisStart?: () => void;
    onRefinedInstruction?: (instruction: string) => void;
}

interface ReviewResult {
    decision: 'approve' | 'revise';
    feedback: string | null;
    revisedText: string | null;
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

async function callStrategist(ai: GoogleGenAI, originalQuery: string, dataSets: DataSets, history: ClarificationState['history']): Promise<StrategistResponse> {
    const model = 'gemini-2.5-flash';
    
    const schemaSummaries = Object.entries(dataSets)
        .map(([name, ds]) => `- ${name}: [${ds.stats.columnNames.join(', ')}]`)
        .join('\n');
    
    const conversationHistory = history
        .map(turn => `${turn.role === 'model' ? 'AI' : 'User'}: ${turn.text}`)
        .join('\n');
    
    const prompt = STRATEGIST_PROMPT
        .replace('{DATASET_SCHEMAS}', schemaSummaries)
        .replace('{USER_QUERY}', originalQuery)
        .replace('{CONVERSATION_HISTORY}', conversationHistory || 'なし');

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
        recommendations_for_user: [],
        instructions_for_planner_ai: "ストラテジストAIの呼び出しに失敗しました。ユーザーのクエリを直接処理してください。"
    };
}


async function callFinalReviewer(
    ai: GoogleGenAI,
    userQuery: string,
    analysisPlan: AnalysisStep[],
    finalAnswerDraft: string
): Promise<ReviewResult> {
    const model = 'gemini-2.5-flash';
    
    // Sanitize plan for the prompt to avoid excessive length
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

    const prompt = `
${FINAL_REVIEWER_PROMPT}

---
**レビュー対象:**

**1. ユーザーの元のクエリ:**
\`\`\`
${userQuery}
\`\`\`

**2. 完全な分析計画:**
\`\`\`json
${JSON.stringify(summarizedPlan, null, 2)}
\`\`\`

**3. 最終テキスト草案:**
\`\`\`markdown
${finalAnswerDraft}
\`\`\`
---
`;

    try {
        const response = await ai.models.generateContent({
            model: model,
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
            }
        });
        
        // Clean the response text to ensure it's valid JSON
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

    let currentMessage: string | Part[];
    let userQueryForReviewer = message;

    // Strategist should only run for new queries, or when in a clarification loop with the strategist.
    // If a plan already exists, we are in a conversation with the planner AI.
    const shouldRunStrategist = existingPlan.length === 0 || clarificationState;

    if (shouldRunStrategist) {
        let activeClarificationState: ClarificationState;

        if (clarificationState) {
            // This is a response to a clarification question from the strategist.
            activeClarificationState = {
                ...clarificationState,
                history: [...clarificationState.history, { role: 'user', text: message }]
            };
        } else {
            // This is a new query.
            activeClarificationState = {
                originalQuery: message,
                history: []
            };
        }

        userQueryForReviewer = activeClarificationState.originalQuery;

        // --- Clarification Loop ---
        const strategistResponse = await callStrategist(ai, activeClarificationState.originalQuery, dataSets, activeClarificationState.history);

        if (!strategistResponse.is_clear) {
            const formattedRecommendations = strategistResponse.recommendations_for_user.length > 0
                ? `${strategistResponse.recommendations_for_user.join('\n')}\n\n`
                : '';
            const formattedQuestions = strategistResponse.questions_for_user.join('\n');
            const fullQuestion = `${formattedRecommendations}${formattedQuestions}\n\n[USER_INPUT_REQUIRED]`;

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
        
        // --- Analysis Execution ---
        callbacks.onRefinedInstruction?.(strategistResponse.instructions_for_planner_ai);
        callbacks.onAnalysisStart?.();

        const initialPlannerMessage = `The user's request is: "${activeClarificationState.originalQuery}".
After a clarification conversation, the refined instruction for you is: "${strategistResponse.instructions_for_planner_ai}".
Please create and execute a detailed, step-by-step plan based on this refined instruction.`;
        
        currentMessage = initialPlannerMessage;
    } else {
        // This is a reply to the Planner AI, not a new query.
        // Send the user's message directly to continue the existing conversation.
        currentMessage = message;
        // Try to find the original query from the plan or last clarification for the reviewer
        // This is imperfect but better than just the latest message.
        // A more robust solution would be to thread the original query through the state.
        const firstUserMessageInHistory = chatHistory.find(h => h.role === 'user');
        if (firstUserMessageInHistory && firstUserMessageInHistory.content[0]?.type === 'text') {
            userQueryForReviewer = firstUserMessageInHistory.content[0].text;
        }
    }


    let fullPlan: AnalysisStep[] = [...existingPlan];
    let hasError = false;
    let emptyResponseCount = 0;
    const MAX_TURNS = 200;
    
    // Error handling
    let consecutiveErrors = 0;
    const MAX_CONSECUTIVE_ERRORS = 2;

    let turn;
    for (turn = 0; turn < MAX_TURNS; turn++) {
        const result: GenerateContentResponse = await chat.sendMessage({ message: currentMessage });
        const responseText = result.text;
        const functionCalls = result.functionCalls;

        // --- Handle Empty Response ---
        if (!responseText && (!functionCalls || functionCalls.length === 0)) {
            emptyResponseCount++;
            if (emptyResponseCount > 1) {
                // Give up after the second consecutive empty response.
                break;
            }

            // Attempt to recover from a single empty response
            callbacks.onIntermediateMessage("AIの応答が空でした。結果を要約するように再試行します。");
            currentMessage = "You have not provided a response or a tool call. Please review the work you have done in the previous steps and provide a final answer summarizing your findings to the user in Markdown format.";
            continue;
        }

        // --- Process Valid Response ---
        emptyResponseCount = 0; // Reset counter on any valid response.
        
        const runningRevisionStep = fullPlan.find(s => (s.toolCall.name === 'revise_plan_based_on_feedback' || s.toolCall.name === 'revise_plan_due_to_error') && s.status === 'running');
        if (runningRevisionStep && functionCalls && functionCalls.length > 0) {
            const completedRevisionStep: AnalysisStep = { ...runningRevisionStep, status: 'completed', result: { message: '新しい計画が生成されました。' } };
            callbacks.onStepUpdate(completedRevisionStep);
            fullPlan = fullPlan.map(s => s.id === completedRevisionStep.id ? completedRevisionStep : s);
        }
        
        // --- Handle Response ---
        if (responseText?.includes('[USER_INPUT_REQUIRED]')) {
            callbacks.onFinalAnswer(responseText.trim());
            return { status: 'completed' };
        }

        if (functionCalls && functionCalls.length > 0) {
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
                    consecutiveErrors = 0; // Reset on success
                    toolExecutionParts.push({ functionResponse: { name: step.toolCall.name, response: result, id: step.toolCall.id } });
                    const updatedStep: AnalysisStep = { ...step, status: 'completed', result, resultDataset: newDataSet };
                    callbacks.onStepUpdate(updatedStep);
                    fullPlan = fullPlan.map(s => s.id === updatedStep.id ? updatedStep : s);
                    if (artifact) callbacks.onArtifactGenerated(artifact as VisualContent);
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
                        
                        selfCorrectionPrompt = `The tool call '${step.toolCall.name}' failed with the error: "${errorMessage}". This is the first failure. Do not apologize. You must analyze this error and the previous steps. Then, generate a new plan to achieve the original goal ("${userQueryForReviewer}"), avoiding this error. Proceed with the corrected plan.`;
                        break; 
                    }
                }
            }
            
            if (hasError) { break; }

            if (selfCorrectionPrompt) {
                currentMessage = selfCorrectionPrompt;
            } else {
                currentMessage = toolExecutionParts;
            }
            continue;
        }
        
        if (responseText) {
            const reviewStep: AnalysisStep = {
                id: `as-${Date.now()}-review`,
                step: fullPlan.length + 1,
                description: 'AIの回答とビジュアルをレビュー',
                status: 'pending',
                toolCall: { name: 'conduct_final_review', args: {} },
            };
            fullPlan.push(reviewStep);
            callbacks.onPlanGenerated(fullPlan);
            
            callbacks.onStepUpdate({ ...reviewStep, status: 'running' });
            const reviewResult = await callFinalReviewer(ai, userQueryForReviewer, fullPlan, responseText);
            
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
                currentMessage = `Your previous work was reviewed and requires correction. The previous steps of your plan are complete, but the final result was incorrect. Based on the following feedback, generate ONLY the additional steps needed to address the feedback and produce the correct final result. Do not repeat steps that have already been successfully completed. Review Feedback: "${reviewResult.feedback}"`;
                continue;
            } else {
                const completedStep: AnalysisStep = { ...reviewStep, status: 'completed', result: { message: '承認されました。' } };
                callbacks.onStepUpdate(completedStep);
                callbacks.onFinalAnswer(reviewResult.revisedText || responseText);
                return { status: 'completed' };
            }
        }
    }

    if (hasError) {
        // The error message has already been sent inside the loop.
    } else if (turn >= MAX_TURNS) {
        callbacks.onFinalAnswer("分析が最大ステップ数に達したため停止しました。");
    } else {
        // This case is triggered by the 'break' when an empty response is received repeatedly.
        callbacks.onFinalAnswer("AIからの応答が空でした。分析を終了します。");
    }

    return { status: 'completed' };
}
