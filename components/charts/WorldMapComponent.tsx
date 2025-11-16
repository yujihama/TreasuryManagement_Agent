import React, { useEffect, useRef, useState } from 'react';
import type { WorldMapContent } from '../../types';
import * as d3 from 'd3';
import * as topojson from 'topojson-client';

// ISO 3166-1 numeric-3 to alpha-3 mapping for all countries in the sample data
const isoNumericToAlpha3: Record<string, string> = {
    '840': 'USA', '392': 'JPN', '276': 'DEU', '250': 'FRA', '826': 'GBR',
    '124': 'CAN', '036': 'AUS', '356': 'IND', '756': 'CHE', '702': 'SGP',
    '156': 'CHN', '076': 'BRA', '344': 'HKG', '484': 'MEX', '752': 'SWE',
    '410': 'KOR', '710': 'ZAF', '724': 'ESP', '528': 'NLD', '380': 'ITA',
    '372': 'IRL', '578': 'NOR', '208': 'DNK', '616': 'POL', '158': 'TWN',
    '764': 'THA', '458': 'MYS', '608': 'PHL', '360': 'IDN', '554': 'NZL',
    '152': 'CHL', '032': 'ARG', '170': 'COL', '604': 'PER', '792': 'TUR',
    '784': 'ARE', '682': 'SAU', '203': 'CZE', '348': 'HUN', '704': 'VNM',
    '643': 'RUS', '634': 'QAT', '376': 'ISR', '818': 'EGY', '642': 'ROU',
    '586': 'PAK', '050': 'BGD', '144': 'LKA', '804': 'UKR', '414': 'KWT',
    '512': 'OMN', '048': 'BHR', '566': 'NGA', '404': 'KEN', '288': 'GHA',
    '834': 'TZA', '504': 'MAR', '012': 'DZA', '788': 'TUN', '400': 'JOR',
    '422': 'LBN', '368': 'IRQ', '031': 'AZE', '398': 'KAZ', '860': 'UZB',
    '268': 'GEO', '051': 'ARM', '112': 'BLR', '688': 'SRB', '191': 'HRV',
    '070': 'BIH', '008': 'ALB', '807': 'MKD', '858': 'URY', '600': 'PRY',
    '068': 'BOL', '188': 'CRI', '591': 'PAN', '214': 'DOM', '320': 'GTM',
    '340': 'HND', '558': 'NIC', '222': 'SLV', '388': 'JAM', '780': 'TTO',
    '052': 'BRB', '044': 'BHS', '136': 'CYM', '060': 'BMU', '533': 'ABW',
    '531': 'CUW', '534': 'SXM', '242': 'FJI', '598': 'PNG', '090': 'SLB',
    '548': 'VUT', '882': 'WSM', '776': 'TON', '132': 'CPV', '270': 'GMB',
    '694': 'SLE', '430': 'LBR', '324': 'GIN', '454': 'MWI', '894': 'ZMB',
    '024': 'AGO', '072': 'BWA', '516': 'NAM', '748': 'SWZ', '426': 'LSO',
    '508': 'MOZ', '450': 'MDG', '480': 'MUS', '690': 'SYC', '462': 'MDV',
    '064': 'BTN', '524': 'NPL', '104': 'MMR', '116': 'KHM', '418': 'LAO',
    '096': 'BRN', '496': 'MNG', '004': 'AFG', '364': 'IRN', '231': 'ETH',
    '729': 'SDN', '434': 'LBY', '760': 'SYR', '887': 'YEM', '192': 'CUB',
    '862': 'VEN', '408': 'PRK', '716': 'ZWE', '706': 'SOM', '728': 'SSD',
    '232': 'ERI', '262': 'DJI', '180': 'COD', '108': 'BDI', '646': 'RWA',
    '800': 'UGA', '686': 'SEN', '120': 'CMR', '332': 'HTI', '740': 'SUR',
    '328': 'GUY', '446': 'MAC', '028': 'ATG', '535': 'BES',
};

// A simple mapping from ISO 3166-1 alpha-2 to alpha-3
const isoAlpha2ToAlpha3: Record<string, string> = {
    JP: 'JPN', US: 'USA', DE: 'DEU', FR: 'FRA', GB: 'GBR',
    CN: 'CHN', CA: 'CAN', AU: 'AUS', IN: 'IND', CH: 'CHE',
    BR: 'BRA', SG: 'SGP', HK: 'HKG', MX: 'MEX', SE: 'SWE',
    KR: 'KOR', ZA: 'ZAF', ES: 'ESP', NL: 'NLD', IT: 'ITA',
    IE: 'IRL', NO: 'NOR', DK: 'DNK', PL: 'POL', TW: 'TWN',
    TH: 'THA', MY: 'MYS', PH: 'PHL', ID: 'IDN', NZ: 'NZL',
    // We can add more as needed
};

const WorldMapComponent: React.FC<WorldMapContent> = ({ data, title, locationKey, valueKey }) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [world, setWorld] = useState<any>(null);

    useEffect(() => {
        d3.json('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json')
            .then((jsonData: any) => {
                setWorld(topojson.feature(jsonData, jsonData.objects.countries));
            });
    }, []);

    useEffect(() => {
        if (!world || !svgRef.current || !tooltipRef.current || !containerRef.current) return;

        const mapBgColor = '#f9fafb'; // gray-50
        const countryFill = '#e5e7eb'; // gray-200
        const countryStroke = '#ffffff'; // white
        const hoverFill = '#a5b4fc'; // indigo-300

        const svg = d3.select(svgRef.current);
        svg.selectAll("*").remove(); // Clear previous render
        svg.style('background-color', mapBgColor);

        const tooltip = d3.select(tooltipRef.current);
        const container = containerRef.current;

        const width = 800;
        const height = 450;
        
        const countriesWithoutAntarctica = {
            ...world,
            features: world.features.filter((d: any) => d.properties.name !== "Antarctica"),
        };

        const projection = d3.geoNaturalEarth1()
            .rotate([-135, 0])
            .fitSize([width, height], countriesWithoutAntarctica);
            
        const path = d3.geoPath().projection(projection);

        svg.attr('viewBox', `0 0 ${width} ${height}`);

        const g = svg.append('g');

        g.selectAll('path')
            .data(world.features)
            .enter().append('path')
            .attr('d', path)
            .attr('fill', countryFill)
            .attr('stroke', countryStroke)
            .style('cursor', 'pointer')
             .on('mouseover', function() {
                d3.select(this).attr('fill', hoverFill);
            })
            .on('mouseout', function() {
                d3.select(this).attr('fill', countryFill);
            });

        const countryData: Record<string, number> = {};
        const countryCentroids: Record<string, [number, number]> = {};
        
        world.features.forEach((feature: any) => {
            const numericCode = feature.id;
            const countryCode = isoNumericToAlpha3[numericCode];
            const geoCenter = d3.geoCentroid(feature);
            if (countryCode && geoCenter) {
                const projectedCenter = projection(geoCenter);
                if (projectedCenter && !isNaN(projectedCenter[0]) && !isNaN(projectedCenter[1])) {
                    countryCentroids[countryCode] = projectedCenter;
                }
            }
        });

        data.forEach(d => {
            let countryCode = d[locationKey] as string;
            // Handle 2-letter codes if provided
            if (countryCode && countryCode.length === 2) {
                countryCode = isoAlpha2ToAlpha3[countryCode.toUpperCase()] || countryCode;
            }
            const value = d[valueKey] as number;
            if (countryCode && typeof value === 'number' && countryCentroids[countryCode]) {
                countryData[countryCode] = (countryData[countryCode] || 0) + value;
            }
        });

        const values = Object.values(countryData);
        if (values.length > 0) {
            const maxVal = Math.max(...values);
            const radiusScale = d3.scaleSqrt().domain([0, maxVal]).range([2, 20]);

            g.selectAll('circle')
                .data(Object.entries(countryData))
                .enter().append('circle')
                .attr('transform', d => `translate(${countryCentroids[d[0]]})`)
                .attr('r', d => radiusScale(d[1]))
                .attr('fill', 'rgba(66, 153, 225, 0.7)')
                .attr('stroke', '#2C5282')
                .style('cursor', 'pointer')
                .on('mouseover', function(event, d) {
                    d3.select(this)
                        .transition()
                        .duration(150)
                        .attr('fill', 'rgba(144, 205, 244, 0.9)')
                        .attr('r', radiusScale(d[1]) * 1.2);
                    
                    tooltip.style('opacity', 1);
                })
                .on('mousemove', (event, d) => {
                    const [country, value] = d;
                    const containerRect = container.getBoundingClientRect();
                    const x = event.clientX - containerRect.left + 15;
                    const y = event.clientY - containerRect.top + 15;

                    tooltip
                        .html(`<strong>${country}</strong><br/>${valueKey}: ${value.toLocaleString()}`)
                        .style('left', `${x}px`)
                        .style('top', `${y}px`);
                })
                .on('mouseout', function(event, d) {
                    d3.select(this)
                        .transition()
                        .duration(150)
                        .attr('fill', 'rgba(66, 153, 225, 0.7)')
                        .attr('r', radiusScale(d[1]));

                    tooltip.style('opacity', 0);
                });
        }

        const zoom = d3.zoom()
            .scaleExtent([1, 8])
            .on('zoom', (event) => {
                g.attr('transform', event.transform);
            });

        svg.call(zoom as any);

    }, [world, data, locationKey, valueKey]);

    if (!world) {
        return <div className="p-4 text-center text-gray-500" style={{ width: '100%', height: 450 }}>地図データを読み込み中...</div>;
    }

    return (
        <div ref={containerRef} className="relative p-4 bg-white rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold mb-4 text-gray-800">{title}</h3>
            <svg ref={svgRef} className="w-full h-auto rounded"></svg>
            <div 
                ref={tooltipRef} 
                className="absolute text-sm text-white p-2 bg-black bg-opacity-75 rounded-md pointer-events-none"
                style={{ opacity: 0, transition: 'opacity 0.2s' }}
            ></div>
        </div>
    );
};

export default WorldMapComponent;