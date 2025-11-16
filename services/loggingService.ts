
class Logger {
    private logs: string[] = [];

    constructor() {
        this.addLog('INFO', 'Logger initialized.');
    }

    private addLog(level: string, message: string, data?: any) {
        const timestamp = new Date().toISOString();
        let logEntry = `[${timestamp}] [${level}] ${message}`;
        if (data) {
            try {
                // Prune large data objects for cleaner logs, but keep previews.
                const prunedData = this.pruneData(data);
                logEntry += `\n${JSON.stringify(prunedData, null, 2)}`;
            } catch (e) {
                logEntry += `\n[Unserializable data]`;
            }
        }
        this.logs.push(logEntry);
        // Also log to console for real-time debugging during development
        if (typeof window !== 'undefined') {
            switch (level) {
                case 'ERROR':
                    console.error(logEntry);
                    break;
                case 'SUCCESS':
                    console.log(`%c${logEntry}`, 'color: green');
                    break;
                default:
                    console.log(logEntry);
            }
        }
    }

    // Helper to avoid logging huge datasets
    private pruneData(data: any): any {
        // The user wants to see all details in the logs, including data previews.
        // The tool executor already provides small previews, so we don't need to prune them.
        return data;
    }

    public logToolStart(toolName: string, args: any) {
        this.addLog('INFO', `Executing tool: ${toolName}`, { args });
    }

    public logToolSuccess(toolName: string, result: any) {
        this.addLog('SUCCESS', `Tool execution successful: ${toolName}`, { result });
    }

    public logToolError(toolName: string, error: string) {
        this.addLog('ERROR', `Tool execution failed: ${toolName}`, { error });
    }

    public logChatMessage(role: 'user' | 'model', message: string) {
        this.addLog('INFO', `CHAT [${role.toUpperCase()}]: ${message}`);
    }

    public logStrategistPrompt(prompt: string) {
        this.addLog('INFO', 'STRATEGIST PROMPT', { prompt });
    }

    public logPlannerInstruction(instruction: string) {
        this.addLog('INFO', 'PLANNER INSTRUCTION', { instruction });
    }

    public logReviewerPrompt(prompt: string, artifacts: any) {
        this.addLog('INFO', 'REVIEWER PROMPT', { prompt, artifacts });
    }

    public getLogContent(): string {
        return this.logs.join('\n\n');
    }
    
    public getLogs(): readonly string[] {
        return [...this.logs];
    }

    public clear() {
        this.logs = [];
        this.addLog('INFO', 'Logs cleared.');
    }
}

const logger = new Logger();

export default logger;
