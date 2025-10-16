import React, { useRef, useState } from 'react';
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
import { SpinnerIcon } from '../icons';

const ArtifactRenderer: React.FC<{ content: VisualContent }> = ({ content }) => {
    return (
        <div className="break-inside-avoid-page">
            {(() => {
                switch (content.type) {
                    case 'table':
                        return <TableComponent data={content.data} title={content.title} isCompact={false} />;
                    case 'bar_chart':
                        return <BarChartComponent {...content} />;
                    case 'pie_chart':
                        return <PieChartComponent {...content} />;
                    case 'line_chart':
                        return <LineChartComponent {...content} />;
                    case 'world_map':
                        return <WorldMapComponent {...content} />;
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
                onclone: (document) => {
                    document.documentElement.classList.remove('dark');
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

    const sanitizedSummaryHtml = DOMPurify.sanitize(marked.parse(summary, { gfm: true, breaks: true }) as string);

    return (
        <div className="p-4 bg-gray-50 dark:bg-gray-900 report-container-scope">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">レポート</h2>
                <button
                    onClick={handleDownload}
                    disabled={isDownloading}
                    className="flex items-center px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-400"
                >
                    {isDownloading ? <SpinnerIcon className="w-5 h-5 animate-spin mr-2" /> : null}
                    {isDownloading ? '生成中...' : 'PDFとしてダウンロード'}
                </button>
            </div>
            
            <div ref={reportRef} className="report-content-wrapper bg-white">
                <header className="mb-8 text-center">
                    <h1 className="text-4xl font-bold mb-2 text-gray-900">{title}</h1>
                    <p className="text-sm text-gray-500">Generated on: {new Date().toLocaleDateString()}</p>
                </header>
                <hr className="my-8 border-gray-200" />
                <div 
                    className="markdown-content mb-12 text-gray-800"
                    dangerouslySetInnerHTML={{ __html: sanitizedSummaryHtml }}
                />
                
                <div className="space-y-12">
                    {artifacts.map((artifact, index) => (
                        <div key={index} className="page-break">
                            <ArtifactRenderer content={artifact} />
                        </div>
                    ))}
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