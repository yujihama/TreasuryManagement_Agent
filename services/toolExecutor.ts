import type { DataSets, DataSet, MessageContent, CsvRow, VisualContent, TableContent, BarChartContent, PieChartContent, LineChartContent, WorldMapContent, ReportContent } from '../types';
import * as d3 from 'd3';

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
            case 'forecast_time_series':
                promise = this.forecastTimeSeries(args.dataset_name, args.date_column, args.value_column, args.forecast_periods, args.frequency); break;
            case 'verify_visualization_data':
                promise = this.verifyVisualizationData(args.dataset_name, args.visualization_type, args.columns); break;
            case 'render_table':
                promise = this.renderTable(args.dataset_name, args.title); break;
            case 'render_bar_chart':
                promise = this.renderBarChart(args.dataset_name, args.category_column, args.value_column, args.title); break;
            case 'render_pie_chart':
                 promise = this.renderPieChart(args.dataset_name, args.name_column, args.value_column, args.title); break;
            case 'render_line_chart':
                 promise = this.renderLineChart(args.dataset_name, args.x_column, args.y_columns, args.title); break;
            case 'render_world_map':
                 promise = this.renderWorldMap(args.dataset_name, args.location_column, args.value_column, args.title); break;
            case 'generate_report':
                 promise = this.generateReport(args.title, args.summary, args.artifact_titles); break;
            default:
                throw new Error(`Tool "${name}" not found.`);
        }

        const result = await promise;
        if (result.artifact && ['table', 'bar_chart', 'pie_chart', 'line_chart', 'world_map'].includes(result.artifact.type)) {
            this.artifacts.push(result.artifact as VisualContent);
        }
        return result;
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
                    warning: `指定された条件（列: ${column}, 条件: ${operator}, 値: ${value}）でのフィルタリング結果が0件でした。条件が厳しすぎる可能性があります。`
                },
                newDataSet
            };
        }
        
        return { result: { new_dataset_name: resultName, rows: filtered.length }, newDataSet };
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
            return { result: { new_dataset_name: resultName, rows: aggregated.length, data: aggregated[0] }, newDataSet };
        }
        
        return { result: { new_dataset_name: resultName, rows: aggregated.length }, newDataSet };
    }

    private async addColumn(dataset_name: string, new_column_name: string, expression: string) {
        const dataset = this.getDataset(dataset_name);
        const parts = expression.match(/(\S+)\s*([*+\/-])\s*(\S+)/);
        if (!parts) throw new Error(`Invalid expression format: "${expression}"`);

        const [, operand1, operator, operand2] = parts;

        const newData = dataset.data.map(row => {
            const val1 = !isNaN(Number(operand1)) ? Number(operand1) : Number(row[operand1]);
            const val2 = !isNaN(Number(operand2)) ? Number(operand2) : Number(row[operand2]);

            if (isNaN(val1) || isNaN(val2)) return { ...row, [new_column_name]: null };

            let result;
            switch (operator) {
                case '+': result = val1 + val2; break;
                case '-': result = val1 - val2; break;
                case '*': result = val1 * val2; break;
                case '/': result = val2 !== 0 ? val1 / val2 : null; break;
                default: throw new Error(`Unsupported operator: "${operator}"`);
            }
            return { ...row, [new_column_name]: result };
        });

        const resultName = this.saveResult(newData);
        const newDataSet = this.intermediateData[resultName];
        return { result: { new_dataset_name: resultName, rows: newData.length }, newDataSet };
    }

    private async getDescriptiveStats(dataset_name: string, column: string) {
        const dataset = this.getDataset(dataset_name);
        const values = dataset.data.map(r => Number(r[column])).filter(v => !isNaN(v));
        if (values.length === 0) throw new Error(`No numerical data found in column "${column}"`);

        const stats = {
            count: values.length,
            mean: d3.mean(values),
            median: d3.median(values),
            std_dev: d3.deviation(values),
            min: d3.min(values),
            max: d3.max(values),
            q1: d3.quantile(values.sort(), 0.25),
            q3: d3.quantile(values.sort(), 0.75),
        };

        return { result: { statistics: stats, message: `Statistics for column "${column}" have been calculated.` } };
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

            const addRowData = (rowData: CsvRow | null, allColumns: string[], prefix = '') => {
                if (rowData) {
                    for (const key in rowData) {
                        const newKey = newRow.hasOwnProperty(key) ? `${key}_${prefix}` : key;
                        newRow[newKey] = rowData[key];
                    }
                } else {
                    allColumns.forEach(col => {
                         const newKey = newRow.hasOwnProperty(col) ? `${col}_${prefix}` : col;
                         newRow[newKey] = null;
                    });
                }
            };

            const finalLeftRow: CsvRow = leftRow ? { ...leftRow } : {};
            if (leftRow) addRowData(leftRow, leftDs.stats.columnNames);
            else addRowData(null, leftDs.stats.columnNames);


            const finalRightRow: CsvRow = rightRow ? { ...rightRow } : {};
            if(rightRow) {
                 for (const key in finalRightRow) {
                    if (key !== right_on_column) {
                        const newKey = finalLeftRow.hasOwnProperty(key) ? `${key}_right` : key;
                        finalLeftRow[newKey] = finalRightRow[key];
                    }
                }
            } else {
                rightDs.stats.columnNames.forEach(col => {
                    if (col !== right_on_column) {
                        const newKey = finalLeftRow.hasOwnProperty(col) ? `${col}_right` : col;
                        finalLeftRow[newKey] = null
                    }
                });
            }
            return finalLeftRow;
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
                    warning: `"${left_dataset_name}" と "${right_dataset_name}" の結合結果が0件でした。結合キーが一致していない可能性があります。`
                },
                newDataSet
            };
        }
        
        return { result: { new_dataset_name: resultName, rows: joinedData.length }, newDataSet };
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
                message: `Generated a forecast for ${forecast_periods} ${frequency} periods.`
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
                valueColumns = [columns.value_column as string];
                categoryColumn = columns.category_column as string;
                break;
            case 'pie_chart':
                valueColumns = [columns.value_column as string];
                categoryColumn = columns.name_column as string;
                break;
            case 'line_chart':
                valueColumns = columns.y_columns as string[];
                categoryColumn = columns.x_column as string;
                break;
            case 'world_map':
                valueColumns = [columns.value_column as string];
                categoryColumn = columns.location_column as string;
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
            if (uniqueCategories.size > 50 && visualization_type !== 'line_chart' && visualization_type !== 'world_map') { 
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

    private async renderTable(dataset_name: string, title: string) {
        const dataset = this.getDataset(dataset_name);
        const artifact: TableContent = {
            type: 'table',
            title: title,
            data: dataset,
        };
        const data_preview = dataset.data.slice(0, 5);
        return { 
            result: { 
                message: `Table "${title}" created.`,
                data_preview: data_preview
            }, 
            artifact 
        };
    }

    private async renderBarChart(dataset_name: string, category_column: string, value_column: string, title: string) {
        const dataset = this.getDataset(dataset_name);
        const artifact: BarChartContent = { type: 'bar_chart', data: dataset.data, title, categoryKey: category_column, valueKey: value_column };
        const data_preview = dataset.data.slice(0, 5);
        return { 
            result: { 
                message: `Bar chart "${title}" created.`,
                data_preview: data_preview
            }, 
            artifact 
        };
    }
    
    private async renderPieChart(dataset_name: string, name_column: string, value_column: string, title: string) {
        const dataset = this.getDataset(dataset_name);
        const artifact: PieChartContent = { type: 'pie_chart', data: dataset.data, title, nameKey: name_column, valueKey: value_column };
        const data_preview = dataset.data.slice(0, 5);
        return { 
            result: { 
                message: `Pie chart "${title}" created.`,
                data_preview: data_preview
            }, 
            artifact 
        };
    }

    private async renderLineChart(dataset_name: string, x_column: string, y_columns: string[], title: string) {
        const dataset = this.getDataset(dataset_name);
        const artifact: LineChartContent = { type: 'line_chart', data: dataset.data, title, xKey: x_column, yKeys: y_columns };
        const data_preview = dataset.data.slice(0, 5);
        return { 
            result: { 
                message: `Line chart "${title}" created.`,
                data_preview: data_preview
            }, 
            artifact 
        };
    }

    private async renderWorldMap(dataset_name: string, location_column: string, value_column: string, title: string) {
        const dataset = this.getDataset(dataset_name);
        const artifact: WorldMapContent = { type: 'world_map', data: dataset.data, title, locationKey: location_column, valueKey: value_column };
        const data_preview = dataset.data.slice(0, 5);
        return { 
            result: { 
                message: `World map "${title}" created.`,
                data_preview: data_preview
            }, 
            artifact 
        };
    }

    private async generateReport(title: string, summary: string, artifact_titles: string[]) {
        const includedArtifacts = this.artifacts.filter(artifact => 
            artifact_titles.includes(artifact.title)
        );

        const orderedArtifacts = artifact_titles
            .map(title => includedArtifacts.find(a => a.title === title))
            .filter((a): a is VisualContent => a !== undefined);

        const reportArtifact: ReportContent = {
            type: 'report',
            title: title,
            summary: summary,
            artifacts: orderedArtifacts
        };

        return {
            result: { message: `Report "${title}" has been generated.` },
            artifact: reportArtifact,
        };
    }
}