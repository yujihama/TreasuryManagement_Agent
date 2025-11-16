
import React from 'react';
import ReactDOM from 'react-dom/client';
import html2canvas from 'html2canvas';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import type { DataSets, DataSet, MessageContent, CsvRow, VisualContent, TableContent, BarChartContent, PieChartContent, LineChartContent, WorldMapContent, ScatterPlotContent, WaterfallChartContent, ReportContent } from '../types';
import * as d3 from 'd3';
import logger from './loggingService';
import TableComponent from '../components/charts/TableComponent';
import BarChartComponent from '../components/charts/BarChartComponent';
import PieChartComponent from '../components/charts/PieChartComponent';
import LineChartComponent from '../components/charts/LineChartComponent';
import WorldMapComponent from '../components/charts/WorldMapComponent';
import ScatterPlotComponent from '../components/charts/ScatterPlotComponent';
import WaterfallChartComponent from '../components/charts/WaterfallChartComponent';
import { DataType } from '../constants';


const ArtifactRendererForImage: React.FC<{ content: VisualContent }> = ({ content }) => {
    switch (content.type) {
        case 'table':
            return <TableComponent data={content.data} title={content.title} isCompact={false} noPagination={true} />;
        case 'bar_chart':
            return <BarChartComponent {...content} />;
        case 'pie_chart':
            return <PieChartComponent {...content} />;
        case 'line_chart':
            return <LineChartComponent {...content} />;
        case 'world_map':
            return <WorldMapComponent {...content} />;
        case 'scatter_plot':
            return <ScatterPlotComponent {...content} />;
        case 'waterfall_chart':
            return <WaterfallChartComponent {...content} />;
        default:
            return null;
    }
};

// Helper function to escape regex special characters
function escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

export class ToolExecutor {
    private dataContext: DataSets = {};
    private intermediateData: Record<string, DataSet> = {};
    private stepCounter = 0;
    private artifacts: VisualContent[] = [];

    public reset() {
        this.intermediateData = {};
        this.stepCounter = 0;
        this.artifacts = [];
    }

    public loadData(dataSets: DataSets) {
        this.dataContext = dataSets;
    }

    public getArtifacts(): VisualContent[] {
        return this.artifacts;
    }

    public setArtifacts(artifacts: VisualContent[]) {
        this.artifacts = [...artifacts];
    }

    public markAllArtifactsAsReviewed(): VisualContent[] {
        this.artifacts = this.artifacts.map(a => ({ ...a, isReviewed: true }));
        return [...this.artifacts];
    }

    public async updateArtifacts(updates: { title: string; summary: string; }[]) {
        for (const update of updates) {
            const artifactIndex = this.artifacts.findIndex(a => a.title === update.title);
            if (artifactIndex !== -1) {
                const currentArtifact = this.artifacts[artifactIndex];
                if (currentArtifact.type === 'report' && update.summary) {
                    const reportArtifact = { ...currentArtifact } as ReportContent;
                    reportArtifact.summary = update.summary;
                    
                    // レポート画像を再生成
                    const imageBase64 = await this.renderReportToImage(reportArtifact);
                    if (imageBase64) {
                        reportArtifact.imageBase64 = imageBase64;
                    }
                    
                    this.artifacts[artifactIndex] = reportArtifact;
                    logger.logToolSuccess('updateArtifacts', { title: update.title, message: 'Report summary and image updated by reviewer AI.' });
                }
            }
        }
    }

    private getDataset(name: string): DataSet {
        const dataSet = this.intermediateData[name] || this.dataContext[name as keyof DataSets];
        if (!dataSet) throw new Error(`Dataset "${name}" not found.`);
        return dataSet;
    }

    private saveResult(data: CsvRow[]): string {
        this.stepCounter++;
        const newName = `step_${this.stepCounter}_result`;
        this.intermediateData[newName] = {
            name: newName,
            data: data,
            stats: {
                rows: data.length,
                columns: data.length > 0 ? Object.keys(data[0]).length : 0,
                columnNames: data.length > 0 ? Object.keys(data[0]) : [],
            },
        };
        return newName;
    }

    public async execute(toolCall: any): Promise<{ result: any; artifact?: MessageContent, newDataSet?: DataSet }> {
        const { name, args } = toolCall;
        
        logger.logToolStart(name, args);
        
        try {
            let promise;
            switch (name) {
                case 'get_dataset_schema':
                    promise = this.getDatasetSchema(args.dataset_name); break;
                case 'filter_data':
                    promise = this.filterData(args.dataset_name, args.column, args.operator, args.value); break;
                case 'aggregate_data':
                    promise = this.aggregateData(args.dataset_name, args.group_by_columns, args.aggregation_column, args.aggregation_function); break;
                case 'add_column':
                    promise = this.addColumn(args.dataset_name, args.new_column_name, args.expression); break;
                case 'get_descriptive_stats':
                    promise = this.getDescriptiveStats(args.dataset_name, args.column); break;
                case 'join_datasets':
                    promise = this.joinDatasets(args.left_dataset_name, args.right_dataset_name, args.left_on_column, args.right_on_column, args.join_type); break;
                case 'union_datasets':
                    promise = this.unionDatasets(args.dataset_names); break;
                case 'forecast_time_series':
                    promise = this.forecastTimeSeries(args.dataset_name, args.date_column, args.value_column, args.forecast_periods, args.frequency); break;
                case 'calculate_correlated_forex_scenario':
                    promise = this.calculateCorrelatedForexScenario(args.base_currency_pair, args.scenario_rate, args.periods); break;
                case 'verify_visualization_data':
                    promise = this.verifyVisualizationData(args.dataset_name, args.visualization_type, args.columns); break;
                case 'render_table':
                    promise = this.renderTable(args.dataset_name, args.title); break;
                case 'render_bar_chart':
                    promise = this.renderBarChart(args.dataset_name, args.category_column, args.value_column, args.title); break;
                case 'render_pie_chart':
                     promise = this.renderPieChart(args.dataset_name, args.category_column, args.value_column, args.title); break;
                case 'render_line_chart':
                     promise = this.renderLineChart(args.dataset_name, args.x_column, args.y_columns, args.title); break;
                case 'render_world_map':
                     promise = this.renderWorldMap(args.dataset_name, args.location_column, args.value_column, args.title); break;
                case 'render_scatter_plot':
                    promise = this.renderScatterPlot(args.dataset_name, args.x_column, args.y_column, args.title); break;
                case 'render_waterfall_chart':
                    promise = this.renderWaterfallChart(args.dataset_name, args.category_column, args.value_column, args.title); break;
                case 'generate_report':
                     promise = this.generateReport(args.title, args.summary, args.artifact_titles); break;
                default:
                    throw new Error(`Tool "${name}" not found.`);
            }

            const result = await promise;
            
            logger.logToolSuccess(name, result.result);

            if (result.artifact && ['table', 'bar_chart', 'pie_chart', 'line_chart', 'world_map', 'scatter_plot', 'waterfall_chart', 'report'].includes(result.artifact.type)) {
                let newArtifact = result.artifact as VisualContent;

                const originalTitle = newArtifact.title;
                let finalTitle = originalTitle;
                let counter = 2;
                
                // Generate a unique title by appending a number if a conflict exists.
                while (this.artifacts.some(a => a.title === finalTitle)) {
                    finalTitle = `${originalTitle} (${counter})`;
                    counter++;
                }
                
                // Create the final artifact with the unique title.
                const finalArtifact = { ...newArtifact, title: finalTitle };

                this.artifacts.push(finalArtifact);
                result.artifact = finalArtifact; // Pass the final artifact back to the caller.
            }
            return result;
        } catch (error: any) {
            logger.logToolError(name, error.message || String(error));
            throw error; // Re-throw the error so geminiService can handle it
        }
    }
    
    private getColumnType(value: any): string {
        if (value === null || value === undefined) {
            return 'unknown';
        }
        if (typeof value === 'number') {
            return 'number';
        }
        if (typeof value === 'string') {
            // Simple date check (YYYY-MM-DD)
            if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
                const date = new Date(value);
                if (!isNaN(date.getTime())) {
                    return 'date';
                }
            }
            return 'string';
        }
        if (typeof value === 'boolean') {
            return 'boolean';
        }
        return String(typeof value);
    }

    private async getDatasetSchema(dataset_name: string) {
        const dataset = this.getDataset(dataset_name);
        const preview_rows = dataset.data.slice(0, 5);

        if (dataset.data.length === 0) {
            return {
                result: {
                    columns: dataset.stats.columnNames.map(name => ({ name, type: 'unknown' })),
                    preview_rows: [],
                }
            };
        }

        const column_types = dataset.stats.columnNames.map(colName => {
            let type = 'unknown';
            // Find the first non-null/undefined value to infer type
            for (const row of dataset.data) {
                if (row[colName] !== null && row[colName] !== undefined) {
                    type = this.getColumnType(row[colName]);
                    break;
                }
            }
            return { name: colName, type };
        });

        return { result: { columns: column_types, preview_rows: preview_rows } };
    }

    private async filterData(dataset_name: string, column: string, operator: string, value: any) {
        const dataset = this.getDataset(dataset_name);
        const filtered = dataset.data.filter(row => {
            const rowVal = row[column];
            if (rowVal === undefined || rowVal === null) return false;
            switch(operator) {
                case '==': return rowVal == value;
                case '!=': return rowVal != value;
                case '>': return rowVal > value;
                case '<': return rowVal < value;
                case '>=': return rowVal >= value;
                case '<=': return rowVal <= value;
                case 'contains': return String(rowVal).toLowerCase().includes(String(value).toLowerCase());
                default: return false;
            }
        });
        const resultName = this.saveResult(filtered);
        const newDataSet = this.intermediateData[resultName];

        if (filtered.length === 0) {
            return {
                result: {
                    new_dataset_name: resultName,
                    rows: 0,
                    columns: newDataSet.stats.columnNames,
                    warning: `指定された条件（列: ${column}, 条件: ${operator}, 値: ${value}）でのフィルタリング結果が0件でした。条件が厳しすぎる可能性があります。`,
                    data_preview: newDataSet.data.slice(0, 5),
                },
                newDataSet
            };
        }
        
        return { result: { new_dataset_name: resultName, rows: filtered.length, columns: newDataSet.stats.columnNames, data_preview: newDataSet.data.slice(0, 5) }, newDataSet };
    }

    private async aggregateData(dataset_name: string, groupByCols: string[], aggCol: string, aggFunc: string) {
        const dataset = this.getDataset(dataset_name);
        const groups: Record<string, CsvRow[]> = {};
        dataset.data.forEach(row => {
            const key = groupByCols.map(c => row[c]).join('-');
            if (!groups[key]) groups[key] = [];
            groups[key].push(row);
        });
        
        const newAggColName = `${aggCol}_${aggFunc}`;

        const aggregated = Object.values(groups).map(group => {
            const firstRow = group[0];
            const resultRow: CsvRow = {};
            groupByCols.forEach(c => resultRow[c] = firstRow[c]);
            
            switch(aggFunc) {
                case 'sum': {
                    const values = group.map(r => Number(r[aggCol])).filter(v => !isNaN(v));
                    resultRow[newAggColName] = d3.sum(values);
                    break;
                }
                case 'count':
                    resultRow[newAggColName] = group.length;
                    break;
                case 'average': {
                     const values = group.map(r => Number(r[aggCol])).filter(v => !isNaN(v));
                     resultRow[newAggColName] = d3.mean(values) || 0;
                     break;
                }
                case 'max': {
                    const values = group.map(r => r[aggCol]).filter(v => v !== null && v !== undefined);
                    resultRow[newAggColName] = d3.max(values as any) ?? null;
                    break;
                }
                case 'min': {
                    const values = group.map(r => r[aggCol]).filter(v => v !== null && v !== undefined);
                    resultRow[newAggColName] = d3.min(values as any) ?? null;
                    break;
                }
                default:
                    throw new Error(`Unsupported aggregation function: ${aggFunc}`);
            }
            return resultRow;
        });
        
        const resultName = this.saveResult(aggregated);
        const newDataSet = this.intermediateData[resultName];

        if (aggregated.length === 1) {
            return { result: { new_dataset_name: resultName, rows: aggregated.length, data: aggregated[0], columns: newDataSet.stats.columnNames, data_preview: newDataSet.data.slice(0, 5) }, newDataSet };
        }
        
        return { result: { new_dataset_name: resultName, rows: aggregated.length, columns: newDataSet.stats.columnNames, data_preview: newDataSet.data.slice(0, 5) }, newDataSet };
    }

    private async addColumn(dataset_name: string, new_column_name: string, expression: string) {
        const dataset = this.getDataset(dataset_name);
        let currentExpression = expression;

        // Scalar replacement logic
        const scalarRegex = /\[(\w+)\]\.(\w+)/g;
        let match;
        while ((match = scalarRegex.exec(currentExpression)) !== null) {
            const [, lookupDatasetName, lookupColumnName] = match;
            const lookupDataset = this.getDataset(lookupDatasetName);
            if (lookupDataset.data.length !== 1) {
                throw new Error(`Scalar lookup failed: Dataset "${lookupDatasetName}" does not have exactly one row.`);
            }
            const scalarValue = lookupDataset.data[0][lookupColumnName];
            if (scalarValue === null || scalarValue === undefined) {
                throw new Error(`Scalar lookup failed: Value from "${lookupDatasetName}.${lookupColumnName}" is null or undefined.`);
            }

            if (typeof scalarValue === 'string') {
                currentExpression = currentExpression.replace(match[0], `'${scalarValue.replace(/'/g, "\\'")}'`);
            } else {
                currentExpression = currentExpression.replace(match[0], String(scalarValue));
            }
        }
        
        const literals: string[] = [];
        // This regex handles single and double quoted strings, including escaped quotes.
        const stringLiteralRegex = /(["'])(?:\\.|(?!\1).)*\1/g;

        // 1. Extract string literals and replace them with placeholders.
        let tempExpression = currentExpression.replace(stringLiteralRegex, (match) => {
            const placeholder = `__STRING_LITERAL_${literals.length}__`;
            literals.push(match);
            return placeholder;
        });

        const columnNames = dataset.stats.columnNames;
        // Sort by length descending to match longer names first (e.g., "col_a" before "col").
        const sortedColumnNames = [...columnNames].sort((a, b) => b.length - a.length);

        // 2. Replace column names (as whole words) with `row['...']` access.
        // This regex now operates on a string without string literals, so it's safer.
        const columnRegex = new RegExp(`\\b(${sortedColumnNames.map(escapeRegExp).join('|')})\\b`, 'g');
        
        tempExpression = tempExpression.replace(columnRegex, (match) => {
            return `row['${match.replace(/'/g, "\\'")}']`;
        });
        
        // 3. Put string literals back into the expression.
        let modifiedExpression = tempExpression.replace(/__STRING_LITERAL_(\d+)__/g, (match, index) => {
            return literals[parseInt(index, 10)];
        });
        
        let evaluator: (row: CsvRow) => any;
        try {
            // The inner try/catch will handle row-level errors during evaluation (e.g., division by zero, null values)
            evaluator = new Function('row', `try { return ${modifiedExpression}; } catch(e) { return null; }`) as (row: CsvRow) => any;
        } catch (e) {
            // Make the error message more helpful
            if (e instanceof SyntaxError) {
                 throw new Error(`Invalid expression format for: "${expression}". Please check the syntax. The final evaluated code was "${modifiedExpression}". Error: ${e.message}`);
            }
            throw new Error(`Failed to parse expression: "${expression}". Error: ${e instanceof Error ? e.message : String(e)}`);
        }

        let warning: string | null = null;
        let affectedRowCount = 0;

        const newData = dataset.data.map(row => {
            const result = evaluator(row);
            
            if (result === null || result === undefined || (typeof result === 'number' && !isFinite(result))) {
                 if (!warning) {
                    warning = '一部の行で計算が実行できませんでした（例：値がnull、ゼロ除算など）。結果はnullになっています。';
                }
                affectedRowCount++;
                return { ...row, [new_column_name]: null };
            }
            
            return { ...row, [new_column_name]: result };
        });

        const resultName = this.saveResult(newData);
        const newDataSet = this.intermediateData[resultName];
        
        const resultPayload: { new_dataset_name: string, rows: number, columns: string[], warning?: string, data_preview?: CsvRow[] } = {
            new_dataset_name: resultName,
            rows: newData.length,
            columns: newDataSet.stats.columnNames,
            data_preview: newDataSet.data.slice(0, 5)
        };

        if(warning) {
            resultPayload.warning = `${warning} (${affectedRowCount}行が影響を受けました)`;
        }

        return { result: resultPayload, newDataSet };
    }
    
    private async getDescriptiveStats(dataset_name: string, column: string) {
        const dataset = this.getDataset(dataset_name);
        
        const validValues = dataset.data.map(r => r[column]).filter(v => v !== null && v !== undefined && v !== '');
        
        if (validValues.length === 0) {
            throw new Error(`Column "${column}" is empty or contains only null/empty values.`);
        }
        
        const columnType = this.getColumnType(validValues[0]);

        if (columnType === 'number') {
            const values = validValues.map(Number).filter(v => !isNaN(v));
            if (values.length === 0) throw new Error(`No valid numerical data found in column "${column}" after attempting conversion.`);

            const sortedValues = [...values].sort((a,b) => a-b);
            const stats = {
                count: values.length,
                mean: d3.mean(values),
                median: d3.median(values),
                std_dev: d3.deviation(values),
                min: d3.min(values),
                max: d3.max(values),
                q1: d3.quantile(sortedValues, 0.25),
                q3: d3.quantile(sortedValues, 0.75),
            };
            return { result: { statistics: stats, message: `Numerical statistics for column "${column}" have been calculated.` } };
        } else if (columnType === 'date') {
            const dateValues = validValues
                .map(v => new Date(v as string))
                .filter(d => !isNaN(d.getTime()));
            
            if (dateValues.length === 0) throw new Error(`No valid date data found in column "${column}" after attempting conversion.`);

            const uniqueDates = new Set(dateValues.map(d => d.toISOString().split('T')[0]));
            const minDate = d3.min(dateValues);
            const maxDate = d3.max(dateValues);

            if (!minDate || !maxDate) {
                throw new Error(`Could not determine date range for column "${column}"`);
            }

            const duration_days = (maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24);

            const stats = {
                count: dateValues.length,
                unique_count: uniqueDates.size,
                start_date: minDate.toISOString().split('T')[0],
                end_date: maxDate.toISOString().split('T')[0],
                duration_days: Math.round(duration_days),
            };
            return { result: { statistics: stats, message: `Date statistics for column "${column}" have been calculated.` } };
        } else {
            throw new Error(`Column "${column}" does not contain numerical or date data. Its type is "${columnType}".`);
        }
    }
    
    private async joinDatasets(left_dataset_name: string, right_dataset_name: string, left_on_column: string, right_on_column: string, join_type: string) {
        const supportedJoins = ['inner', 'left', 'right', 'full'];
        if (!supportedJoins.includes(join_type)) {
            throw new Error(`Join type "${join_type}" is not supported. Available types: ${supportedJoins.join(', ')}.`);
        }

        const leftDs = this.getDataset(left_dataset_name);
        const rightDs = this.getDataset(right_dataset_name);

        const mergeRows = (leftRow: CsvRow | null, rightRow: CsvRow | null): CsvRow => {
            const newRow: CsvRow = {};
            const leftData = leftRow || {};
            const rightData = rightRow || {};
            
            // Add left columns
            leftDs.stats.columnNames.forEach(col => {
                newRow[col] = leftData[col] ?? null;
            });

            // Add right columns, handling conflicts
            rightDs.stats.columnNames.forEach(col => {
                if (col === right_on_column) {
                    // Coalesce the join key: if left key is null, use right key
                    if (newRow[left_on_column] === null && rightData[col] !== null) {
                         newRow[left_on_column] = rightData[col];
                    }
                } else {
                    const newKey = newRow.hasOwnProperty(col) ? `${col}_right` : col;
                    newRow[newKey] = rightData[col] ?? null;
                }
            });
            return newRow;
        };

        const rightMapGrouped = new Map<any, CsvRow[]>();
        rightDs.data.forEach(row => {
            const key = row[right_on_column];
            const group = rightMapGrouped.get(key) || [];
            group.push(row);
            rightMapGrouped.set(key, group);
        });
        
        const joinedData: CsvRow[] = [];
        const matchedRightKeys = new Set();

        leftDs.data.forEach(leftRow => {
            const key = leftRow[left_on_column];
            const matchingRightRows = rightMapGrouped.get(key);
            if (matchingRightRows) {
                matchedRightKeys.add(key);
                if (join_type === 'inner' || join_type === 'left' || join_type === 'full') {
                    matchingRightRows.forEach(rightRow => {
                        joinedData.push(mergeRows(leftRow, rightRow));
                    });
                }
            } else if (join_type === 'left' || join_type === 'full') {
                joinedData.push(mergeRows(leftRow, null));
            }
        });

        if (join_type === 'right' || join_type === 'full') {
            rightDs.data.forEach(rightRow => {
                const key = rightRow[right_on_column];
                if (!matchedRightKeys.has(key)) {
                    joinedData.push(mergeRows(null, rightRow));
                }
            });
        }
        
        const resultName = this.saveResult(joinedData);
        const newDataSet = this.intermediateData[resultName];
        
        if (joinedData.length === 0) {
            return {
                result: {
                    new_dataset_name: resultName,
                    rows: 0,
                    columns: newDataSet.stats.columnNames,
                    warning: `"${left_dataset_name}" と "${right_dataset_name}" の結合結果が0件でした。結合キーが一致していない可能性があります。`,
                    data_preview: newDataSet.data.slice(0, 5)
                },
                newDataSet
            };
        }
        
        return { result: { new_dataset_name: resultName, rows: joinedData.length, columns: newDataSet.stats.columnNames, data_preview: newDataSet.data.slice(0, 5) }, newDataSet };
    }
    
    private async unionDatasets(dataset_names: string[]) {
        if (!Array.isArray(dataset_names) || dataset_names.length < 2) {
            throw new Error('union_datasets requires an array of at least two dataset names.');
        }

        const firstDataset = this.getDataset(dataset_names[0]);
        const firstSchema = firstDataset.stats.columnNames;
        const allRows: CsvRow[] = [...firstDataset.data];

        for (let i = 1; i < dataset_names.length; i++) {
            const datasetName = dataset_names[i];
            const currentDataset = this.getDataset(datasetName);
            const currentSchema = currentDataset.stats.columnNames;

            if (currentSchema.length !== firstSchema.length || !currentSchema.every((col, index) => col === firstSchema[index])) {
                throw new Error(`Schema mismatch: Dataset "${datasetName}" does not have the same columns and order as "${dataset_names[0]}". Expected [${firstSchema.join(', ')}] but got [${currentSchema.join(', ')}].`);
            }
            allRows.push(...currentDataset.data);
        }
        
        const resultName = this.saveResult(allRows);
        const newDataSet = this.intermediateData[resultName];
        
        return { 
            result: { 
                new_dataset_name: resultName,
                rows: allRows.length,
                columns: newDataSet.stats.columnNames,
                data_preview: newDataSet.data.slice(0, 5) 
            }, 
            newDataSet 
        };
    }

    private async forecastTimeSeries(dataset_name: string, date_column: string, value_column: string, forecast_periods: number, frequency: 'daily' | 'monthly' | 'quarterly') {
        const dataset = this.getDataset(dataset_name);
        
        const parsedData = dataset.data
            .map(row => ({
                ...row,
                date: new Date(row[date_column] as string),
                value: Number(row[value_column])
            }))
            .filter(d => !isNaN(d.date.getTime()) && !isNaN(d.value))
            .sort((a, b) => a.date.getTime() - b.date.getTime());

        if (parsedData.length < 2) {
            throw new Error('Time series forecasting requires at least two data points.');
        }

        const x = parsedData.map(d => d.date.getTime());
        const y = parsedData.map(d => d.value);
        const n = parsedData.length;

        const sumX = d3.sum(x);
        const sumY = d3.sum(y);
        const sumXY = d3.sum(parsedData, d => d.date.getTime() * d.value);
        const sumX2 = d3.sum(x, d => d * d);
        
        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;

        const predict = (time: number) => slope * time + intercept;

        const residuals = parsedData.map(d => d.value - predict(d.date.getTime()));
        const sse = d3.sum(residuals, r => r * r);
        const stdError = Math.sqrt(sse / (n - 2));

        const lastDate = parsedData[n - 1].date;
        const futureDates: Date[] = [];
        let currentDate = new Date(lastDate);

        for (let i = 0; i < forecast_periods; i++) {
            switch (frequency) {
                case 'daily':
                    currentDate.setDate(currentDate.getDate() + 1);
                    break;
                case 'monthly':
                    currentDate.setMonth(currentDate.getMonth() + 1);
                    break;
                case 'quarterly':
                    currentDate.setMonth(currentDate.getMonth() + 3);
                    break;
            }
            futureDates.push(new Date(currentDate));
        }

        const forecastData = futureDates.map(date => {
            const time = date.getTime();
            const forecastValue = predict(time);
            const newRow: CsvRow = {};
            dataset.stats.columnNames.forEach(col => {
                newRow[col] = null;
            });
            newRow[date_column] = date.toISOString().split('T')[0];
            newRow.forecast = forecastValue;
            newRow.forecast_upper = forecastValue + 1.96 * stdError;
            newRow.forecast_lower = forecastValue - 1.96 * stdError;
            return newRow;
        });

        const combinedData = (dataset.data.map(row => ({
            ...row,
            forecast: null,
            forecast_upper: null,
            forecast_lower: null,
        })) as CsvRow[]).concat(forecastData);
        
        const resultName = this.saveResult(combinedData);
        const newDataSet = this.intermediateData[resultName];

        return {
            result: {
                new_dataset_name: resultName,
                rows: combinedData.length,
                message: `Generated a forecast for ${forecast_periods} ${frequency} periods.`,
                columns: newDataSet.stats.columnNames,
                data_preview: newDataSet.data.slice(0, 5),
            },
            newDataSet,
        };
    }

    private async calculateCorrelatedForexScenario(base_currency_pair: string, scenario_rate: number, periods: number = 30) {
        const scenarioData: CsvRow[] = [];
    
        // Determine a correlated pair based on the base pair
        let correlated_currency_pair: string;
        if (base_currency_pair.toUpperCase() === 'USD/JPY') {
            correlated_currency_pair = 'EUR/JPY';
        } else if (base_currency_pair.toUpperCase() === 'EUR/JPY') {
            correlated_currency_pair = 'USD/JPY';
        } else {
            // Default fallback
            correlated_currency_pair = 'EUR/USD';
        }

        // Dummy current rates
        const dummyCurrentBaseRate = scenario_rate * (Math.random() * 0.1 + 0.9); // 90-100% of scenario rate
        const dummyCurrentCorrelatedRate = dummyCurrentBaseRate * 1.1 * (Math.random() * 0.2 + 0.9); // A plausible but different dummy rate
        
        const baseRateChangeRatio = (scenario_rate - dummyCurrentBaseRate) / dummyCurrentBaseRate;
        const scenarioCorrelatedRate = dummyCurrentCorrelatedRate * (1 + baseRateChangeRatio);
    
        const today = new Date();
    
        for (let i = 1; i <= periods; i++) {
            const progress = i / periods;
    
            // Linearly interpolate the base rate
            const baseRate = dummyCurrentBaseRate + (scenario_rate - dummyCurrentBaseRate) * progress;
    
            // Linearly interpolate the correlated rate and add some noise
            let correlatedRate = dummyCurrentCorrelatedRate + (scenarioCorrelatedRate - dummyCurrentCorrelatedRate) * progress;
            const noise = (Math.random() - 0.5) * 0.02 * correlatedRate; // Add up to 2% noise
            correlatedRate += noise;
    
            const date = new Date(today);
            date.setDate(date.getDate() + i);
    
            scenarioData.push({
                date: date.toISOString().split('T')[0],
                [`${base_currency_pair.replace('/', '_')}_rate`]: parseFloat(baseRate.toFixed(4)),
                [`${correlated_currency_pair.replace('/', '_')}_rate`]: parseFloat(correlatedRate.toFixed(4)),
            });
        }
    
        const resultName = this.saveResult(scenarioData);
        const newDataSet = this.intermediateData[resultName];
    
        return {
            result: {
                new_dataset_name: resultName,
                rows: scenarioData.length,
                message: `${base_currency_pair}が${scenario_rate}になった場合の、${correlated_currency_pair}の仮想レートを${periods}日間で算出しました。`,
                columns: newDataSet.stats.columnNames,
                data_preview: newDataSet.data.slice(0, 5),
            },
            newDataSet,
        };
    }

    private async verifyVisualizationData(dataset_name: string, visualization_type: string, columns: Record<string, string | string[]>) {
        const dataset = this.getDataset(dataset_name);
        if (dataset.data.length === 0) {
            return { result: { status: 'WARNING', message: `Dataset "${dataset_name}" is empty. No chart can be generated.` } };
        }
        
        const checkNumeric = (colName: string): { status: 'OK' } | { status: 'WARNING', message: string } => {
            if (!dataset.stats.columnNames.includes(colName)) {
                 return {
                    status: 'WARNING',
                    message: `Column "${colName}" does not exist in dataset "${dataset_name}". Available columns: ${dataset.stats.columnNames.join(', ')}`
                };
            }
            const firstRowWithValue = dataset.data.find(r => r[colName] != null);
            if (!firstRowWithValue) {
                 return { status: 'OK' };
            }
            const value = firstRowWithValue[colName];

            if (typeof value !== 'number') {
                return {
                    status: 'WARNING',
                    message: `Column "${colName}" is not numeric, which is required for a value axis. Its type is ${typeof value}. Please ensure data is correctly aggregated or the correct column is chosen.`
                };
            }
            return { status: 'OK' };
        }

        let valueColumns: string[] = [];
        let categoryColumn: string | undefined;

        switch(visualization_type) {
            case 'bar_chart':
            case 'waterfall_chart':
            case 'pie_chart':
                valueColumns = [columns.value_column as string];
                categoryColumn = columns.category_column as string;
                break;
            case 'line_chart':
                valueColumns = columns.y_columns as string[];
                categoryColumn = columns.x_column as string;
                break;
            case 'world_map':
                valueColumns = [columns.value_column as string];
                categoryColumn = columns.location_column as string;
                break;
            case 'scatter_plot':
                valueColumns = [columns.x_column as string, columns.y_column as string];
                break;
        }

        for (const col of valueColumns) {
            if (!col) continue;
            const checkResult = checkNumeric(col);
            if (checkResult.status !== 'OK') {
                return { result: checkResult };
            }
        }
        
        if (categoryColumn) {
            if (!dataset.stats.columnNames.includes(categoryColumn)) {
                return { result: {
                    status: 'WARNING',
                    message: `Category column "${categoryColumn}" does not exist in dataset "${dataset_name}". Available columns: ${dataset.stats.columnNames.join(', ')}`
                }};
            }

            const uniqueCategories = new Set(dataset.data.map(r => r[categoryColumn]));
            if (uniqueCategories.size > 50 && visualization_type !== 'line_chart' && visualization_type !== 'world_map' && visualization_type !== 'scatter_plot') { 
                 return {
                    result: {
                        status: 'WARNING',
                        message: `The category column "${categoryColumn}" has ${uniqueCategories.size} unique values which may be too many for a clear visualization. The data might not be properly aggregated.`
                    }
                };
            }
            if (uniqueCategories.size === 1 && (visualization_type === 'bar_chart' || visualization_type === 'line_chart')) {
                return {
                    result: {
                        status: 'WARNING',
                        message: `The category column "${categoryColumn}" only has one unique value. A ${visualization_type} may not be informative. A descriptive statistic might be better.`
                    }
                };
            }
        }
        
        return { result: { status: 'OK', message: 'Data is suitable for visualization.' } };
    }
    
    private markdownify(data: CsvRow[], columns: string[]): string {
        if (data.length === 0) {
            return "表示するデータがありません。";
        }

        const escapePipe = (value: any) => 
            (value === null || value === undefined) ? '' : String(value).replace(/\|/g, '\\|');

        const header = `| ${columns.map(escapePipe).join(' | ')} |`;
        const separator = `| ${columns.map(() => '---').join(' | ')} |`;
        
        const rows = data.map(row => {
            const rowData = columns.map(col => escapePipe(row[col]));
            return `| ${rowData.join(' | ')} |`;
        }).join('\n');

        return `${header}\n${separator}\n${rows}`;
    }

    private async renderTable(dataset_name: string, title: string) {
        const dataset = this.getDataset(dataset_name);
        
        const markdownString = this.markdownify(dataset.data, dataset.stats.columnNames);

        const fullMarkdown = `### ${title}\n\n${markdownString}`;
        
        return { 
            result: { 
                message: `Markdown for table "${title}" has been generated. This should be embedded in the report summary.`,
                markdown_table: fullMarkdown,
            }
        };
    }

    private async renderBarChart(dataset_name: string, category_column: string, value_column: string, title: string) {
        const dataset = this.getDataset(dataset_name);
        const prefix = `[bar_chart]`;
        const prefixedTitle = title.startsWith(prefix) ? title : `${prefix} ${title}`;
        const artifact: BarChartContent = { type: 'bar_chart', data: dataset.data, title: prefixedTitle, categoryKey: category_column, valueKey: value_column };
        const data_preview = dataset.data.slice(0, 5);
        return { 
            result: { 
                message: `Bar chart "${prefixedTitle}" created.`,
                data_preview: data_preview
            }, 
            artifact 
        };
    }
    
    private async renderPieChart(dataset_name: string, category_column: string, value_column: string, title: string) {
        const dataset = this.getDataset(dataset_name);
        const prefix = `[pie_chart]`;
        const prefixedTitle = title.startsWith(prefix) ? title : `${prefix} ${title}`;
        const artifact: PieChartContent = { type: 'pie_chart', data: dataset.data, title: prefixedTitle, categoryKey: category_column, valueKey: value_column };
        const data_preview = dataset.data.slice(0, 5);
        return { 
            result: { 
                message: `Pie chart "${prefixedTitle}" created.`,
                data_preview: data_preview
            }, 
            artifact 
        };
    }

    private async renderLineChart(dataset_name: string, x_column: string, y_columns: string[], title: string) {
        const dataset = this.getDataset(dataset_name);
        const prefix = `[line_chart]`;
        const prefixedTitle = title.startsWith(prefix) ? title : `${prefix} ${title}`;
        const artifact: LineChartContent = { type: 'line_chart', data: dataset.data, title: prefixedTitle, xKey: x_column, yKeys: y_columns };
        const data_preview = dataset.data.slice(0, 5);
        return { 
            result: { 
                message: `Line chart "${prefixedTitle}" created.`,
                data_preview: data_preview
            }, 
            artifact 
        };
    }

    private async renderWorldMap(dataset_name: string, location_column: string, value_column: string, title: string) {
        const dataset = this.getDataset(dataset_name);
        const prefix = `[world_map]`;
        const prefixedTitle = title.startsWith(prefix) ? title : `${prefix} ${title}`;
        const artifact: WorldMapContent = { type: 'world_map', data: dataset.data, title: prefixedTitle, locationKey: location_column, valueKey: value_column };
        const data_preview = dataset.data.slice(0, 5);
        return { 
            result: { 
                message: `World map "${prefixedTitle}" created.`,
                data_preview: data_preview
            }, 
            artifact 
        };
    }

    private async renderScatterPlot(dataset_name: string, x_column: string, y_column: string, title: string) {
        const dataset = this.getDataset(dataset_name);
        const prefix = `[scatter_plot]`;
        const prefixedTitle = title.startsWith(prefix) ? title : `${prefix} ${title}`;
        const artifact: ScatterPlotContent = { type: 'scatter_plot', data: dataset.data, title: prefixedTitle, xKey: x_column, yKey: y_column };
        const data_preview = dataset.data.slice(0, 5);
        return { 
            result: { 
                message: `Scatter plot "${prefixedTitle}" created.`,
                data_preview: data_preview
            }, 
            artifact 
        };
    }

    private async renderWaterfallChart(dataset_name: string, category_column: string, value_column: string, title: string) {
        const dataset = this.getDataset(dataset_name);
        const prefix = `[waterfall_chart]`;
        const prefixedTitle = title.startsWith(prefix) ? title : `${prefix} ${title}`;
        const artifact: WaterfallChartContent = { type: 'waterfall_chart', data: dataset.data, title: prefixedTitle, categoryKey: category_column, valueKey: value_column };
        const data_preview = dataset.data.slice(0, 5);
        return { 
            result: { 
                message: `Waterfall chart "${prefixedTitle}" created.`,
                data_preview: data_preview
            }, 
            artifact 
        };
    }

    private async renderReportToImage(report: ReportContent): Promise<string> {
        const container = document.createElement('div');
        container.style.position = 'fixed';
        container.style.left = '-9999px';
        container.style.width = '800px';
        container.className = 'bg-white';
        document.body.appendChild(container);
    
        const { summary, artifacts } = report;

        const reportContentBlocks: React.ReactNode[] = [];
        const artifactRegex = /<artifact_start>(.*?)<artifact_end>/g;
        let lastIndex = 0;
        let match;
        let keyCounter = 0;

        const artifactMap = new Map(artifacts.map(a => [a.title, a]));
        const usedArtifactTitles = new Set<string>();
        
        // Important: .test() advances the lastIndex on global regex, so we must be careful
        const hasPlaceholders = artifactRegex.test(summary);
        // Reset regex for exec loop
        artifactRegex.lastIndex = 0;

        if (!hasPlaceholders) {
            // Fallback to original behavior if no placeholders are found
            const sanitizedSummaryHtml = DOMPurify.sanitize(marked.parse(summary, { gfm: true, breaks: true }) as string);
            reportContentBlocks.push(
                <div 
                    key="summary-full"
                    className="markdown-content"
                    dangerouslySetInnerHTML={{ __html: sanitizedSummaryHtml }}
                />
            );
            artifacts.forEach((artifact, index) => {
                reportContentBlocks.push(
                    <div key={`artifact-fallback-${index}`} className="page-break">
                        <ArtifactRendererForImage content={artifact} />
                    </div>
                );
            });
        } else {
             while ((match = artifactRegex.exec(summary)) !== null) {
                const textSegment = summary.substring(lastIndex, match.index);
                if (textSegment.trim()) {
                    const sanitizedHtml = DOMPurify.sanitize(marked.parse(textSegment, { gfm: true, breaks: true }) as string);
                    reportContentBlocks.push(
                        <div 
                            key={`text-${keyCounter++}`}
                            className="markdown-content"
                            dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
                        />
                    );
                }

                const artifactTitle = match[1];
                const artifact = artifactMap.get(artifactTitle);
                if (artifact) {
                    reportContentBlocks.push(
                        <div key={`artifact-${keyCounter++}`} className="page-break">
                            <ArtifactRendererForImage content={artifact} />
                        </div>
                    );
                    usedArtifactTitles.add(artifactTitle);
                }

                lastIndex = match.index + match[0].length;
            }

            const remainingText = summary.substring(lastIndex);
            if (remainingText.trim()) {
                const sanitizedHtml = DOMPurify.sanitize(marked.parse(remainingText, { gfm: true, breaks: true }) as string);
                reportContentBlocks.push(
                    <div 
                        key={`text-${keyCounter++}`}
                        className="markdown-content"
                        dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
                    />
                );
            }

            artifacts.forEach((artifact, index) => {
                if (!usedArtifactTitles.has(artifact.title)) {
                    reportContentBlocks.push(
                        <div key={`artifact-unmentioned-${index}`} className="page-break">
                            <ArtifactRendererForImage content={artifact} />
                        </div>
                    );
                }
            });
        }
    
        const root = ReactDOM.createRoot(container);
        root.render(
            <div className="report-content-wrapper bg-white">
                <header className="mb-8 text-center">
                    <h1 className="text-4xl font-bold mb-2 text-gray-900">{report.title}</h1>
                    <p className="text-sm text-gray-500">Generated on: {new Date().toLocaleDateString()}</p>
                </header>
                <hr className="my-8 border-gray-200" />
                <div className="space-y-8">
                    {reportContentBlocks}
                </div>
                <style>{`
                    .report-content-wrapper { padding: 2.5rem; border: 1px solid #e5e7eb; border-radius: 0.5rem; max-width: 800px; margin: auto; font-family: Arial, sans-serif; color: #111827; }
                    .report-content-wrapper h1, .report-content-wrapper h2, .report-content-wrapper h3 { font-family: Georgia, 'Times New Roman', Times, serif; }
                    .report-content-wrapper .markdown-content { line-height: 1.6; }
                    .report-content-wrapper .markdown-content h3 { border-bottom: 2px solid #e5e7eb; padding-bottom: 0.5rem; margin-top: 2rem; margin-bottom: 1rem; font-size: 1.25rem; font-weight: 600; }
                    .markdown-content ul { list-style-type: disc; margin-left: 1.5rem; } .markdown-content ol { list-style-type: decimal; margin-left: 1.5rem; }
                    .markdown-content strong { font-weight: 600; } .markdown-content p { margin-bottom: 0.5rem; } .markdown-content p:last-child { margin-bottom: 0; }
                    .markdown-content code { font-family: monospace; background-color: rgba(0,0,0,0.1); padding: 0.125rem 0.25rem; border-radius: 0.25rem; font-size: 0.875em; }
                    .markdown-content h4 { font-size: 1.1rem; font-weight: 600; margin-top: 1rem; margin-bottom: 0.5rem; }
                    .markdown-content table { width: 100%; border-collapse: collapse; margin-bottom: 1rem; font-size: 0.875em; }
                    .markdown-content th, .markdown-content td { border: 1px solid #e5e7eb; padding: 0.5rem 0.75rem; text-align: left; }
                    .markdown-content th { background-color: #f9fafb; font-weight: 600; }
                    .page-break { page-break-before: always; }
                `}</style>
            </div>
        );
    
        await new Promise(resolve => setTimeout(resolve, 500));
    
        let imageBase64 = '';
        try {
            const canvas = await html2canvas(container, {
                scale: 1.5,
                useCORS: true,
                logging: false,
                onclone: (clonedDoc) => {
                    clonedDoc.documentElement.classList.remove('dark');
                    clonedDoc.querySelectorAll('td, th').forEach((el) => {
                        (el as HTMLElement).style.color = '#1f2937';
                    });
                },
            });
            imageBase64 = canvas.toDataURL('image/jpeg', 0.9).split(',')[1];
        } catch (e) {
            console.error("Error generating report image:", e);
        } finally {
            root.unmount();
            document.body.removeChild(container);
        }
    
        return imageBase64;
    }

    private async generateReport(title: string, summary: string, artifact_titles: string[]) {
        const foundArtifactsResult = artifact_titles.map(requestedTitle => {
            const reqTitle = requestedTitle.trim();
            if (!reqTitle) return undefined;

            // Use a reversed list to find the most recent artifact first in case of duplicates
            const reversedArtifacts = [...this.artifacts].reverse();

            // Find artifact with fuzzy matching for prefixes like `[bar_chart]`
            return reversedArtifacts.find(a => {
                const title = a.title.trim();
                // 1. Exact match
                if (title === reqTitle) return true;

                // 2. Match for "[type] title" vs "title"
                const match = title.match(/\[.*?\]\s*(.*)/);
                if (match && match[1] && match[1].trim() === reqTitle) {
                    return true;
                }
                return false;
            });
        });

        const validArtifacts = foundArtifactsResult.filter((art): art is VisualContent => art !== undefined);

        const uniqueOrderedArtifacts = validArtifacts.filter((art, index, self) =>
            index === self.findIndex((a) => a.title === art.title)
        );
    
        const reportArtifact: ReportContent = {
            type: 'report',
            title: title,
            summary: summary,
            artifacts: uniqueOrderedArtifacts,
        };

        const imageBase64 = await this.renderReportToImage(reportArtifact);
        if (imageBase64) {
            reportArtifact.imageBase64 = imageBase64;
        }
    
        return {
            result: { message: `Report "${title}" has been generated.` },
            artifact: reportArtifact,
        };
    }
}
