import React, { useRef, useState, useMemo } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import type { ReportContent, VisualContent } from '../../types';
import TableComponent from './TableComponent';
import BarChartComponent from './BarChartComponent';
import PieChartComponent from './PieChartComponent';
import LineChartComponent from './LineChartComponent';
import WorldMapComponent from './WorldMapComponent';
import ScatterPlotComponent from './ScatterPlotComponent';
import WaterfallChartComponent from './WaterfallChartComponent';
import { SpinnerIcon } from '../icons';

const ArtifactRenderer: React.FC<{ content: VisualContent }> = ({ content }) => {
    return (
        <div className="break-inside-avoid-page">
            {(() => {
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
            })()}
        </div>
    );
};

const ReportComponent: React.FC<ReportContent> = ({ title, summary, artifacts }) => {
    const reportRef = useRef<HTMLDivElement>(null);
    const [isDownloading, setIsDownloading] = useState(false);

    const handleDownload = async () => {
        const reportElement = reportRef.current;
        if (!reportElement) return;
        
        setIsDownloading(true);

        const originalWidth = reportElement.style.width;
        
        try {
            reportElement.style.width = '800px';
            await new Promise(resolve => setTimeout(resolve, 300));

            const canvas = await html2canvas(reportElement, {
                scale: 2,
                useCORS: true,
                logging: false,
                onclone: (clonedDoc) => {
                    // Force table text to be dark for PDF generation to avoid issues with dark mode.
                    clonedDoc.querySelectorAll('td, th').forEach((el) => {
                        (el as HTMLElement).style.color = '#1f2937'; // tailwind gray-800
                    });
                },
            });

            reportElement.style.width = originalWidth;

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4',
            });

            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const canvasAspectRatio = canvas.height / canvas.width;
            const imgHeight = pdfWidth * canvasAspectRatio;

            let heightLeft = imgHeight;
            let position = 0;

            pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
            heightLeft -= pdfHeight;

            while (heightLeft > 0) {
                position = position - pdfHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
                heightLeft -= pdfHeight;
            }

            const pageCount = pdf.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                pdf.setPage(i);
                pdf.setFontSize(8);
                pdf.setTextColor(150);
                pdf.text(`Page ${i} of ${pageCount}`, pdfWidth - 25, pdfHeight - 10);
            }

            pdf.save(`${title.replace(/\s+/g, '_')}.pdf`);

        } catch (error) {
            console.error("PDF generation failed:", error);
        } finally {
            if (reportElement) {
               reportElement.style.width = originalWidth;
            }
            setIsDownloading(false);
        }
    };

    const reportContent = useMemo(() => {
        const blocks: React.ReactNode[] = [];
        const artifactRegex = /<artifact_start>(.*?)<artifact_end>/g;
        let lastIndex = 0;
        let match;
        let keyCounter = 0;

        const artifactMap = new Map(artifacts.map(a => [a.title, a]));
        const usedArtifactTitles = new Set<string>();

        // Check if the summary contains any artifact placeholders
        if (!artifactRegex.test(summary)) {
            // Fallback to original behavior if no placeholders are found
            const sanitizedSummaryHtml = DOMPurify.sanitize(marked.parse(summary, { gfm: true, breaks: true }) as string);
            blocks.push(
                <div 
                    key="summary-full"
                    className="markdown-content"
                    dangerouslySetInnerHTML={{ __html: sanitizedSummaryHtml }}
                />
            );
            artifacts.forEach((artifact, index) => {
                blocks.push(
                    <div key={`artifact-fallback-${index}`} className="page-break">
                        <ArtifactRenderer content={artifact} />
                    </div>
                );
            });
            return blocks;
        }

        // Reset regex for exec loop
        artifactRegex.lastIndex = 0;

        while ((match = artifactRegex.exec(summary)) !== null) {
            const textSegment = summary.substring(lastIndex, match.index);
            if (textSegment.trim()) {
                const sanitizedHtml = DOMPurify.sanitize(marked.parse(textSegment, { gfm: true, breaks: true }) as string);
                blocks.push(
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
                blocks.push(
                    <div key={`artifact-${keyCounter++}`} className="page-break">
                        <ArtifactRenderer content={artifact} />
                    </div>
                );
                usedArtifactTitles.add(artifactTitle);
            }

            lastIndex = match.index + match[0].length;
        }

        const remainingText = summary.substring(lastIndex);
        if (remainingText.trim()) {
            const sanitizedHtml = DOMPurify.sanitize(marked.parse(remainingText, { gfm: true, breaks: true }) as string);
            blocks.push(
                <div 
                    key={`text-${keyCounter++}`}
                    className="markdown-content"
                    dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
                />
            );
        }

        artifacts.forEach((artifact, index) => {
            if (!usedArtifactTitles.has(artifact.title)) {
                blocks.push(
                    <div key={`artifact-unmentioned-${index}`} className="page-break">
                        <ArtifactRenderer content={artifact} />
                    </div>
                );
            }
        });

        return blocks;
    }, [summary, artifacts]);

    return (
        <div className="p-4 bg-gray-50 report-container-scope">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">レポート</h2>
                <button
                    onClick={handleDownload}
                    disabled={isDownloading}
                    className="flex items-center px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-400"
                >
                    {isDownloading ? <SpinnerIcon className="w-5 h-5 animate-spin mr-2" /> : null}
                    {isDownloading ? '生成中...' : 'PDFとしてダウンロード'}
                </button>
            </div>
            
            <div ref={reportRef} className="report-content-wrapper bg-white text-gray-800">
                <header className="mb-8 text-center">
                    <h1 className="text-4xl font-bold mb-2 text-gray-900">{title}</h1>
                    <p className="text-sm text-gray-500">Generated on: {new Date().toLocaleDateString()}</p>
                </header>
                <hr className="my-8 border-gray-200" />
                
                <div className="space-y-8">
                    {reportContent}
                </div>
            </div>
            <style>{`
                .report-content-wrapper {
                    padding: 2.5rem; /* ~p-10 */
                    border: 1px solid #e5e7eb; /* border-gray-200 */
                    border-radius: 0.5rem; /* rounded-lg */
                    max-width: 800px;
                    margin: auto;
                }
                .report-container-scope h1, 
                .report-container-scope h2, 
                .report-container-scope h3 {
                    font-family: Georgia, 'Times New Roman', Times, serif;
                }
                .report-container-scope .markdown-content {
                    font-family: Arial, sans-serif;
                    line-height: 1.6;
                }
                .report-container-scope .markdown-content h3 {
                    border-bottom: 2px solid #e5e7eb;
                    padding-bottom: 0.5rem;
                    margin-top: 2rem;
                    margin-bottom: 1rem;
                }
                /* Light mode table styles in markdown */
                .report-container-scope .markdown-content table {
                    color: #111827; /* gray-900 */
                }
                .report-container-scope .markdown-content th {
                    background-color: #f9fafb !important; /* gray-50 */
                }
                .report-container-scope .markdown-content td {
                    background-color: #ffffff !important; /* white */
                }
                .report-container-scope .markdown-content th,
                .report-container-scope .markdown-content td {
                     border-color: #e5e7eb !important; /* gray-200 */
                }

                .page-break {
                    page-break-before: always;
                }
                @media print {
                    body {
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                    .page-break {
                        margin-top: 2rem;
                    }
                }
            `}</style>
        </div>
    );
};

export default ReportComponent;