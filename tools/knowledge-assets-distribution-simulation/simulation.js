/* eslint-disable no-nested-ternary */
/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable no-await-in-loop */
import 'dotenv/config';
import crypto from 'crypto';
import DeepExtend from 'deep-extend';
import rc from 'rc';
import fs from 'fs-extra';
import D3Node from 'd3-node';
import * as d3 from 'd3';
import sharp from 'sharp';
import { readFile } from 'fs/promises';
import { createRequire } from 'module';
import { create as createLibP2PKey, createFromPrivKey } from 'peer-id';
import { HASH_RING_SIZE } from '../../src/constants/constants.js';
import BlockchainModuleManagerMock from './mocks/blockchain-module-manager-mock.js';
import HashingService from '../../src/service/hashing-service.js';
import ProximityScoringService from '../../src/service/proximity-scoring-service.js';
import Logger from '../../src/logger/logger.js';

const require = createRequire(import.meta.url);
const configjson = require('../../config/config.json');
const pjson = require('../../package.json');

function getConfig() {
    let config;
    let userConfig;

    if (process.env.USER_CONFIG_PATH) {
        const configurationFilename = process.env.USER_CONFIG_PATH;
        const pathSplit = configurationFilename.split('/');
        userConfig = JSON.parse(fs.readFileSync(configurationFilename));
        userConfig.configFilename = pathSplit[pathSplit.length - 1];
    }

    const defaultConfig = JSON.parse(JSON.stringify(configjson[process.env.NODE_ENV]));

    if (userConfig) {
        config = DeepExtend(defaultConfig, userConfig);
    } else {
        config = rc(pjson.name, defaultConfig);
    }

    if (!config.configFilename) {
        config.configFilename = '.origintrail_noderc';
    }
    return config;
}

function getLogger() {
    return new Logger('debug');
}

const config = getConfig();
const logger = getLogger();
const blockchain = 'hardhat1:31337';
const blockchainModuleManagerMock = new BlockchainModuleManagerMock();
const hashingService = new HashingService({ config, logger });
const proximityScoringService = new ProximityScoringService({
    config,
    logger,
    blockchainModuleManager: blockchainModuleManagerMock,
});

function generateRandomNumber(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateRandomHashes(numberOfHashes) {
    const hashes = [];

    for (let i = 0; i < numberOfHashes; i += 1) {
        const randomString = crypto.randomBytes(20).toString('hex');
        const hash = `0x${crypto.createHash('sha256').update(randomString).digest('hex')}`;
        hashes.push(hash);
    }

    return numberOfHashes === 1 ? hashes[0] : hashes;
}

async function generateRandomNodes(
    numberOfNodes,
    stakeMin = 50000,
    stakeMax = 1000000,
    hashFunctionId = 1,
) {
    const nodes = [];

    for (let i = 0; i < numberOfNodes; i += 1) {
        const libp2pPrivKey = (await createLibP2PKey({ bits: 1024, keyType: 'RSA' })).toJSON()
            .privKey;
        const nodeId = (await createFromPrivKey(libp2pPrivKey)).toB58String();
        const sha256 = await hashingService.callHashFunction(hashFunctionId, nodeId);
        const stake = String(generateRandomNumber(stakeMin, stakeMax));

        nodes.push({ nodeId, sha256, stake });
    }

    return nodes;
}

async function readJsonFromFile(filePath) {
    try {
        const data = await readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        logger.error(`Error reading file: ${error.stack}`);
        throw error;
    }
}

function convertSvgToJpg(svgString, outputImageName) {
    sharp(Buffer.from(svgString))
        .flatten({ background: '#FFFFFF' })
        .jpeg({ quality: 100 })
        .toBuffer()
        .then((buffer) => {
            fs.writeFile(
                `tools/knowledge-assets-distribution-simulation/plots/${outputImageName}.jpg`,
                buffer,
                (err) => {
                    if (err) {
                        logger.error(`Error saving the JPG file: ${err.stack}`);
                    } else {
                        logger.info(
                            `Plot saved as "tools/knowledge-assets-distribution-simulation/plots/${outputImageName}.jpg"`,
                        );
                    }
                },
            );
        })
        .catch((error) => {
            logger.error('Error converting SVG to JPG:', error);
        });
}

function generateStakeDistributionPlot(data, outputImageName) {
    logger.info('Generating Node-Stake Distribution Plot.');

    const d3n = new D3Node();
    const margin = { top: 60, right: 30, bottom: 60, left: 90 };
    const width = 2000 - margin.left - margin.right;
    const height = 1000 - margin.top - margin.bottom;

    data.sort((a, b) => d3.descending(a.stake, b.stake));

    const svg = d3n
        .createSVG(width + margin.left + margin.right, height + margin.top + margin.bottom)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    svg.append('text')
        .attr('x', width / 2)
        .attr('y', 0 - margin.top / 2)
        .attr('text-anchor', 'middle')
        .style('font-size', '20px')
        .style('text-decoration', 'underline')
        .text('Node-Stake Distribution Plot');

    const x = d3
        .scaleBand()
        .range([0, width])
        .domain(data.map((_, i) => i + 1))
        .padding(0.2);

    svg.append('text')
        .attr('transform', `translate(${width / 2}, ${height + margin.top - 20})`)
        .style('text-anchor', 'middle')
        .text('Node Index');

    const y = d3
        .scaleLinear()
        .domain([0, Math.round(d3.max(data.map((node) => node.stake)) * 1.1)])
        .range([height, 0]);

    svg.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('y', 0 - margin.left)
        .attr('x', 0 - height / 2)
        .attr('dy', '1em')
        .style('text-anchor', 'middle')
        .text('Stake');

    svg.selectAll('rect')
        .data(data)
        .enter()
        .append('rect')
        .attr('x', (_, i) => x(i + 1))
        .attr('width', x.bandwidth())
        .attr('y', (d) => y(d.stake))
        .attr('height', (d) => height - y(d.stake))
        .attr('fill', 'steelblue');

    svg.append('g')
        .attr('transform', `translate(0, ${height})`)
        .call(d3.axisBottom(x))
        .selectAll('text')
        .style('text-anchor', 'end')
        .attr('dx', '-.8em')
        .attr('dy', '.15em')
        .attr('transform', 'rotate(-65)');

    svg.append('g').call(d3.axisLeft(y));

    convertSvgToJpg(d3n.svgString(), outputImageName);
}

function generateScatterPlot(data, metric, outputImageName) {
    const d3n = new D3Node();
    const margin = { top: 60, right: 30, bottom: 60, left: 60 };
    const width = 2000 - margin.left - margin.right;
    const height = 1000 - margin.top - margin.bottom;

    const svg = d3n
        .createSVG(width + margin.left + margin.right, height + margin.top + margin.bottom)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    svg.append('text')
        .attr('x', width / 2)
        .attr('y', 0 - margin.top / 2)
        .attr('text-anchor', 'middle')
        .style('font-size', '20px')
        .style('text-decoration', 'underline')
        .text(`Stake / KAs ${metric[0].toUpperCase() + metric.slice(1)} Relation Plot`);

    const minStake = d3.min(data.map((node) => node.stake));
    const maxStake = d3.max(data.map((node) => node.stake));

    const x = d3
        .scaleLinear()
        .domain([Math.round(minStake * 0.9), Math.round(maxStake * 1.1)])
        .range([0, width]);

    svg.append('text')
        .attr('transform', `translate(${width / 2}, ${height + margin.top - 20})`)
        .style('text-anchor', 'middle')
        .text('Stake');

    const minKAsNum = d3.min(data.map((node) => node[metric]));
    const maxKAsNum = d3.max(data.map((node) => node[metric]));

    const y = d3
        .scaleLinear()
        .domain([Math.round(minKAsNum * 0.9), Math.round(maxKAsNum * 1.1)])
        .range([height, 0]);

    svg.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('y', 0 - margin.left)
        .attr('x', 0 - height / 2)
        .attr('dy', '1em')
        .style('text-anchor', 'middle')
        .text(`Knowledge Assets ${metric}`);

    svg.append('g').attr('transform', `translate(0, ${height})`).call(d3.axisBottom(x).ticks(15));

    svg.append('g').call(d3.axisLeft(y).ticks(30));

    svg.append('g')
        .selectAll('dot')
        .data(data)
        .enter()
        .append('circle')
        .attr('cx', (d) => x(d.stake))
        .attr('cy', (d) => y(d[metric]))
        .attr('r', 5)
        .style('fill', '#69b3a2');

    svg.append('line')
        .style('stroke', 'red')
        .style('stroke-width', 2)
        .style('stroke-dasharray', '3, 3')
        .attr('x1', 0)
        .attr('y1', y(minKAsNum))
        .attr('x2', width)
        .attr('y2', y(minKAsNum));

    svg.append('line')
        .style('stroke', 'red')
        .style('stroke-width', 2)
        .style('stroke-dasharray', '3, 3')
        .attr('x1', 0)
        .attr('y1', y(maxKAsNum))
        .attr('x2', width)
        .attr('y2', y(maxKAsNum));

    convertSvgToJpg(d3n.svgString(), outputImageName);
}

function generateBoxPlot(data, metric, outputImageName) {
    const d3n = new D3Node();
    const margin = { top: 60, right: 30, bottom: 60, left: 60 };
    const width = 2000 - margin.left - margin.right;
    const height = 1000 - margin.top - margin.bottom;

    const svg = d3n
        .createSVG(width + margin.left + margin.right, height + margin.top + margin.bottom)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    svg.append('text')
        .attr('x', width / 2)
        .attr('y', 0 - margin.top / 2)
        .attr('text-anchor', 'middle')
        .style('font-size', '20px')
        .style('text-decoration', 'underline')
        .text(`${metric[0].toUpperCase() + metric.slice(1)} Distribution Plot`);

    const groupedData = d3.group(data, (d) => d.nodeId);
    const valuesPerNode = Array.from(groupedData.values(), (d) => d.map((item) => item[metric]));

    const x = d3
        .scaleBand()
        .domain(valuesPerNode.map((_, i) => i))
        .range([0, width]);

    svg.append('text')
        .attr('transform', `translate(${width / 2}, ${height + margin.top - 20})`)
        .style('text-anchor', 'middle')
        .text('Node Index');

    const y = d3
        .scaleLinear()
        .domain([0, d3.max(data, (d) => d[metric])])
        .nice()
        .range([height, 0]);

    svg.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('y', 0 - margin.left)
        .attr('x', 0 - height / 2)
        .attr('dy', '1em')
        .style('text-anchor', 'middle')
        .text(metric[0].toUpperCase() + metric.slice(1));

    svg.append('g')
        .attr('transform', `translate(0, ${height})`)
        .call(d3.axisBottom(x))
        .selectAll('text')
        .style('text-anchor', 'end')
        .attr('dx', '-.8em')
        .attr('dy', '.15em')
        .attr('transform', 'rotate(-65)');

    svg.append('g').call(d3.axisLeft(y).ticks(30));

    const boxWidth = x.bandwidth() - 3;

    valuesPerNode.forEach((d, i) => {
        const box = svg
            .append('g')
            .attr('transform', `translate(${x(i) + (x.bandwidth() - boxWidth) / 2},0)`);

        const q1 = d3.quantile(d, 0.25);
        const median = d3.quantile(d, 0.5);
        const q3 = d3.quantile(d, 0.75);
        const iqr = q3 - q1;
        const lowerLimit = q1 - 1.5 * iqr;
        const upperLimit = q3 + 1.5 * iqr;

        const lowerWhisker = d3.max([d3.min(data, (n) => n[metric]), lowerLimit]);
        const upperWhisker = d3.min([d3.max(data, (n) => n[metric]), upperLimit]);

        box.append('rect')
            .attr('y', y(q3))
            .attr('height', y(q1) - y(q3))
            .attr('width', boxWidth)
            .style('fill', '#69b3a2');

        box.append('line')
            .attr('y1', y(median))
            .attr('y2', y(median))
            .attr('x1', 0)
            .attr('x2', boxWidth)
            .style('stroke', 'black')
            .style('width', 80);

        box.append('line')
            .attr('y1', y(lowerWhisker))
            .attr('y2', y(upperWhisker))
            .attr('x1', boxWidth / 2)
            .attr('x2', boxWidth / 2)
            .style('stroke', 'black');

        box.append('line')
            .attr('y1', y(lowerWhisker))
            .attr('y2', y(lowerWhisker))
            .attr('x1', boxWidth * 0.25)
            .attr('x2', boxWidth * 0.75)
            .style('stroke', 'black');

        box.append('line')
            .attr('y1', y(upperWhisker))
            .attr('y2', y(upperWhisker))
            .attr('x1', boxWidth * 0.25)
            .attr('x2', boxWidth * 0.75)
            .style('stroke', 'black');
    });

    convertSvgToJpg(d3n.svgString(), outputImageName);
}

async function runSimulation(
    nodesMode,
    knowledgeAssetsMode,
    nodesFilePath,
    knowledgeAssetsFilePath,
    numberOfNodes,
    numberOfKAs,
    proximityScoreFunctionsPairId,
    r0 = 3,
    r2 = 20,
) {
    let nodes;
    if (nodesMode === 'load') {
        nodes = await readJsonFromFile(nodesFilePath);
    } else if (nodesMode === 'generate') {
        nodes = await generateRandomNodes(numberOfNodes);
    } else {
        logger.error(`Invalid nodes mode: ${nodesMode}. Use "load" or "generate".`);
        return;
    }

    let knowledgeAssets;
    if (knowledgeAssetsMode === 'load') {
        knowledgeAssets = await readJsonFromFile(knowledgeAssetsFilePath);
    } else if (knowledgeAssetsMode === 'generate') {
        knowledgeAssets = generateRandomHashes(numberOfKAs);
    } else {
        logger.error(`Invalid KAs mode: ${knowledgeAssetsMode}. Use "load" or "generate".`);
        return;
    }

    logger.info(
        `Running simulation in '${nodesMode}' nodes mode and '${knowledgeAssetsMode}' KAs mode ` +
            `with ${nodes.length} nodes and ${numberOfKAs} KAs.`,
    );

    generateStakeDistributionPlot(
        nodes.map((node) => ({ ...node, stake: Number(node.stake) })),
        `${nodesMode}-${knowledgeAssetsMode}-${nodes.length}-${numberOfKAs}-${proximityScoreFunctionsPairId}-nodes-stake-distribution`,
    );

    const metrics = [];
    const replicas = {};

    for (const node of nodes) {
        replicas[node.nodeId] = {
            stake: Number(node.stake),
            replicated: 0,
            won: 0,
        };
    }

    const idealMaxDistanceInNeighborhood = HASH_RING_SIZE.div(nodes.length).mul(Math.ceil(r2 / 2));
    for (const key of knowledgeAssets) {
        const nodesWithDistances = await Promise.all(
            nodes.map(async (node) => {
                const distance = await proximityScoringService.callProximityFunction(
                    blockchain,
                    proximityScoreFunctionsPairId,
                    node.sha256,
                    key,
                );

                return { ...node, distance };
            }),
        );

        const nodesSortedByDistance = nodesWithDistances
            .sort((a, b) => a.distance.sub(b.distance))
            .slice(0, r2);

        const maxDistanceInNeighborhood =
            nodesSortedByDistance[nodesSortedByDistance.length - 1].distance;
        const maxDistance =
            maxDistanceInNeighborhood <= idealMaxDistanceInNeighborhood
                ? maxDistanceInNeighborhood
                : idealMaxDistanceInNeighborhood;

        for (const node of nodesSortedByDistance) {
            replicas[node.nodeId].replicated += 1;
        }

        const nodesWithScores = await Promise.all(
            nodesSortedByDistance.map(async (node) => {
                const { normalizedDistance, finalScore } =
                    await proximityScoringService.callScoreFunction(
                        blockchain,
                        proximityScoreFunctionsPairId,
                        node.distance,
                        node.stake,
                        maxDistance,
                        r2,
                        nodes.length,
                        blockchainModuleManagerMock.getMinimumStake(),
                        blockchainModuleManagerMock.getMaximumStake(),
                        true,
                    );

                metrics.push({ nodeId: node.nodeId, normalizedDistance, score: finalScore });

                return { ...node, score: finalScore };
            }),
        );

        const nodesSortedByScore = nodesWithScores.sort((a, b) => b.score - a.score);

        for (const [index, node] of nodesSortedByScore.entries()) {
            if (index < r0) {
                replicas[node.nodeId].won += 1;
            } else {
                break;
            }
        }
    }

    generateScatterPlot(
        Object.values(replicas),
        'replicated',
        `${nodesMode}-${knowledgeAssetsMode}-${nodes.length}-${numberOfKAs}-${proximityScoreFunctionsPairId}-stake-replications-relation`,
    );
    generateScatterPlot(
        Object.values(replicas),
        'won',
        `${nodesMode}-${knowledgeAssetsMode}-${nodes.length}-${numberOfKAs}-${proximityScoreFunctionsPairId}-stake-wins-relation`,
    );

    generateBoxPlot(
        metrics,
        'normalizedDistance',
        `${nodesMode}-${knowledgeAssetsMode}-${nodes.length}-${numberOfKAs}-${proximityScoreFunctionsPairId}-mapped-distances-distribution`,
    );
    generateBoxPlot(
        metrics,
        'score',
        `${nodesMode}-${knowledgeAssetsMode}-${nodes.length}-${numberOfKAs}-${proximityScoreFunctionsPairId}-scores-distribution`,
    );
}

const args = process.argv.slice(2);
const nodesMode = args[0];
const knowledgeAssetsMode = args[1];
const nodesFilePath = nodesMode === 'load' ? args[2] : undefined;
const knowledgeAssetsFilePath =
    knowledgeAssetsMode === 'load' ? (nodesMode === 'load' ? args[3] : args[2]) : undefined;
const numberOfNodes =
    nodesMode === 'generate' ? parseInt(nodesMode === 'load' ? args[3] : args[2], 10) : undefined;
const numberOfKAs =
    knowledgeAssetsMode === 'generate'
        ? parseInt(
              knowledgeAssetsMode === 'load'
                  ? nodesMode === 'load'
                      ? args[4]
                      : args[3]
                  : nodesMode === 'generate'
                  ? args[3]
                  : args[2],
              10,
          )
        : undefined;
const proximityScoreFunctionsPairId = parseInt(args[args.length - 1], 10);

if (
    (nodesMode === 'load' && !nodesFilePath) ||
    (nodesMode === 'generate' && Number.isNaN(numberOfNodes)) ||
    (knowledgeAssetsMode === 'load' && !knowledgeAssetsFilePath) ||
    (knowledgeAssetsMode === 'generate' && Number.isNaN(numberOfKAs)) ||
    Number.isNaN(proximityScoreFunctionsPairId)
) {
    logger.error('Incorrect arguments. Please provide the correct format.');
    if (nodesMode === 'load') {
        logger.error('For loading nodes, a file path must be provided.');
    }
    if (knowledgeAssetsMode === 'load') {
        logger.error('For loading knowledge assets, a file path must be provided.');
    }
    if (nodesMode === 'generate') {
        logger.error('For generating nodes, the number of nodes must be specified.');
    }
    if (knowledgeAssetsMode === 'generate') {
        logger.error('For generating knowledge assets, the number of KAs must be specified.');
    }
    logger.error('A proximity score functions pair ID must always be provided.');
    logger.error(
        'Usage examples:\n' +
            'node simulate.js load load <nodesFilePath> <knowledgeAssetsFilePath> <proximityScoreFunctionsPairId>\n' +
            'node simulate.js generate generate <numberOfNodes> <numberOfKAs> <proximityScoreFunctionsPairId>\n' +
            'node simulate.js load generate <nodesFilePath> <numberOfKAs> <proximityScoreFunctionsPairId>\n' +
            'node simulate.js generate load <numberOfNodes> <knowledgeAssetsFilePath> <proximityScoreFunctionsPairId>',
    );
} else {
    runSimulation(
        nodesMode,
        knowledgeAssetsMode,
        nodesFilePath,
        knowledgeAssetsFilePath,
        numberOfNodes,
        numberOfKAs,
        proximityScoreFunctionsPairId,
    ).catch((error) => logger.error(`Simulation error: ${error.stack}`));
}
