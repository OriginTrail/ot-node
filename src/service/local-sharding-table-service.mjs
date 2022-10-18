import {createRequire} from "module";
import {setTimeout} from "timers/promises";
const require = createRequire(import.meta.url);
const mysql = require("mysql2")

class shardingTableService {
    constructor(blockchain) {
        this.blockchain = blockchain;

        this.shardingTable = new Map();
        //getting the sharding table from blockchain
        // this.shardingTable.set('QmHVJmNvsYo8jmEjrGGzNCZNiQhnjqT6m87xGcSGHSmpoW', [10000, 0.1])
        // this.shardingTable.set('QmHVJmNvsYo8jmEjrGGzNCZNiQhnjqT6m87xGcSGHSmpoA', [49000, 0.112312])
        // this.shardingTable.set('QmHVJmNvsYo8jmEjrGGzNCZNiQhnjqT6m87xGcSGHSmpoB', [31322, 0.1])
        // this.shardingTable.set('QmHVJmNvsYo8jmEjrGGzNCZNiQhnjqT6m87xGcSGHSmpoZ', [11230, 0.3])
        // this.shardingTable.set('QmWyf3dtqJnhuCpzEDTNmNFYc5tjxTrXhGcUUmGHdg2gtj', [31000, 1.1])
        // this.shardingTable.set('QmTAf5VEh1r7PWcFk9MUmJfbLFhmZ8S1bAijZ6FsTDLLzN', [15456, 0.6])
        // this.shardingTable.set('QmHVJmNvsYo8jmEjrGGzNCZNiQhnjqT6m87xGcSGHSmpoe', [10000, 0.1])
        // this.shardingTable.set('QmHVJmNvsYo8jmEjrGGzNCZNiQhnjqT6m87xGcSGHSmpKa', [20000, 0.2])
        // this.shardingTable.set('QmHVJmNvsYo8jmEjrGGzNCZNiQhnjqT6m87xGcSGHSmp8D', [30000, 0.34])
        // this.shardingTable.set('QmHVJmNvsYo8jmEjrGGzNCZNiQhnjqT6m87xGcSGHSmpha', [40000, 0.1])
        // this.shardingTable.set('QmHVJmNvsYo8jmEjrGGzNCZNiQhnjqT6m87xGcSGHSmpVS', [50000, 0.5])
        // this.shardingTable.set('QmHVJmNvsYo8jmEjrGGzNCZNiQhnjqT6m87xGcSGHSmp24', [15000, 0.2])
        // this.shardingTable.set('QmHVJmNvsYo8jmEjrGGzNCZNiQhnjqT6m87xGcSGHSmp01', [12000, 0.63])
        // this.shardingTable.set('QmHVJmNvsYo8jmEjrGGzNCZNiQhnjqT6m87xGcSGHSmpCE', [17000, 0.23])
        // this.shardingTable.set('QmHVJmNvsYo8jmEjrGGzNCZNiQhnjqT6m87xGcSGHSmpdd', [19000, 0.11])
        // this.shardingTable.set('QmHVJmNvsYo8jmEjrGGzNCZNiQhnjqT6m87xGcSGHSmpCQ', [10500, 0.1])
        // this.shardingTable.set('QmHVJmNvsYo8jmEjrGGzNCZNiQhnjqT6m87xGcSGHSmp2E', [9000, 0.19])
        // this.shardingTable.set('QmHVJmNvsYo8jmEjrGGzNCZNiQhnjqT6m87xGcSGHSmp7C', [7000, 0.09])
        // this.shardingTable.set('QmHVJmNvsYo8jmEjrGGzNCZNiQhnjqT6m87xGcSGHSmAPC', [8200, 0.04])
        // this.shardingTable.set('QmHVJmNvsYo8jmEjrGGzNCZNiQhnjqT6m87xGcSGHSm35C', [9500, 0.03])
        // this.shardingTable.set('QmHVJmNvsYo8jmEjrGGzNCZNiQhnjqT6m87xGcSGHSm983', [24000, 0.02])
        // this.shardingTable.set('QmHVJmNvsYo8jmEjrGGzNCZNiQhnjqT6m87xGcSGHSm2iC', [21000, 0.11])
        // this.shardingTable.set('QmHVJmNvsYo8jmEjrGGzNCZNiQhnjqT6m87xGcSGHSm01J', [29000, 0.101])
        // this.shardingTable.set('QmHVJmNvsYo8jmEjrGGzNCZNiQhnjqT6m87xGcSGHSm01L', [25500, 0.102])
        // this.shardingTable.set('QmHVJmNvsYo8jmEjrGGzNCZNiQhnjqT6m87xGcSGHSmp16', [4200, 0.132])
        // this.shardingTable.set('QmHVJmNvsYo8jmEjrGGzNCZNiQhnjqT6m87xGcSGHSm1LA', [5000, 0.1005])
        // this.shardingTable.set('QmHVJmNvsYo8jmEjrGGzNCZNiQhnjqT6m87xGcSGHSmp6M', [5500, 0.124])
        // this.shardingTable.set('QmHVJmNvsYo8jmEjrGGzNCZNiQhnjqT6m87xGcSGHSmp8k', [7900, 0.12345])
        // this.shardingTable.set('QmHVJmNvsYo8jmEjrGGzNCZNiQhnjqT6m87xGcSGHSm100', [8800, 0.21])
        // this.shardingTable.set('QmHVJmNvsYo8jmEjrGGzNCZNiQhnjqT6m87xGcSGHS1234', [1900, 0.0001])


        this.shardingTable.set('QmU12cgaJpeaaU4xRC5n95r52AiFTqGdtCaEgnzn9ytpxu', [10000, 0.1])
        this.shardingTable.set('QmXJ8AoFpUBnKHswyANnANmnE9T48xBq5geD4U9KjngKy3', [49000, 0.112312])
        this.shardingTable.set('QmajtBnsXmXqRC2oNhbcWqRgJ8o5prMr1Tscxnv11YHeo3', [31322, 0.1])
        this.shardingTable.set('QmWx3AbppQLpo3N8HvXNVG93uVrzvhBq2HWMJBeu4QxhNy', [11230, 0.3])
        this.shardingTable.set('QmYcMXMw2Uj71RraH4xezAaVFpisCY4FBZUSc1xEnBUWQK', [31000, 1.1])
        this.shardingTable.set('QmXbMc3Kpyv5XL8hQvws8xgJwshsNz8PezxL8XCni12wXb', [15456, 0.6])
        this.shardingTable.set('QmY3EptiY5Kr5nrB93DtAPgzhyhAjAi4jYHUiS2ynZowa7', [10000, 0.1])
        this.shardingTable.set('QmciLYezwcEhJiCzqFZ7rTnjDgyYBQ7Tu3FwgFoKE6mzUu', [20000, 0.2])
        this.shardingTable.set('QmRnyWLU5E7vWSZ1353gbfQ4zSXLLX97QA6dC9rKn2iNAy', [30000, 0.34])
        this.shardingTable.set('QmYnwndBzaXWFzPWYazZPo46VC2DkMGdPvwfZTefNM4TZw', [40000, 0.1])
        //closest peers to 0xc311cca6412f8453067ac7a04831af411b2963734d107541763c1ef7c8e56f65 are
        // QmYcMXMw2Uj71RraH4xezAaVFpisCY4FBZUSc1xEnBUWQK
        // QmU12cgaJpeaaU4xRC5n95r52AiFTqGdtCaEgnzn9ytpxu
        // QmRnyWLU5E7vWSZ1353gbfQ4zSXLLX97QA6dC9rKn2iNAy
        // QmWyf3dtqJnhuCpzEDTNmNFYc5tjxTrXhGcUUmGHdg2gtj
    }

    async pullBlockchainShardingTable(smartContractAddress) {
        //web3-service.callContractFunction(smartContractAddress,‘getPeersFromShardingTable’, args:[guardPeerId]).call();
        const con = mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: process.env.REPOSITORY_PASSWORD,
        });
        con.query("USE operationaldb");
        con.query("CREATE TABLE IF NOT EXISTS peer_info(peer_id varchar(46),peer_id_sha char(64),stake decimal(28,18),ask decimal(28,18), last_seen_timestamp DATETIME, peer_ip_address varchar(32),blockchain varchar(24));");

        const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
        let insert_query = "INSERT INTO peer_info VALUES";
        this.shardingTable.forEach((value, key) => {
            insert_query += `('${key}',SHA2('${key}',256),'${value[0]}',${value[1]},'${now}','NULL','NULL'),`;
        })
        con.query(insert_query.slice(0, -1) + ';');

        await setTimeout(500);
        con.end()
    }


    async updateLocalTable(blockchainTableUpdateEvent) {
        let peerId, stake, ask;
        ({ peerId, stake, ask } = blockchainTableUpdateEvent.currentTarget);

        const con = mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: process.env.REPOSITORY_PASSWORD,
        });
        con.query("USE operationaldb");
        let delete_query = `DELETE FROM peer_info WHERE peer_id='${peerId}';`;
        con.query(delete_query);

        const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
        let insert_query = `INSERT INTO peer_info VALUES ('${peerId}',SHA2('${peerId}', 256), ${stake}, ${ask}, '${now}', 'NULL', 'NULL');`;
        con.query(insert_query);

        con.end();
    }

    async findNeighbourhood(assertionId, k){
        const con = mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: process.env.REPOSITORY_PASSWORD,
        });
        con.query(`USE operationaldb`);
        const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
        async function getResults(){
            var sql = `SELECT peer_id,peer_id_sha,stake,ask,last_seen_timestamp,BINARY(SHA2('${assertionId}',256)) ^ BINARY(peer_id_sha)
            as DISTANCE
            FROM peer_info WHERE last_seen_timestamp BETWEEN '2022-10-16 11:09:27' AND '${now}'  
         ORDER BY DISTANCE LIMIT ${k};`
            const results = await con.promise().query(sql)
            return results[0]
        }
        let results = await getResults();
        results.forEach(element => element.DISTANCE = element.DISTANCE.readInt16BE())
        con.end()
        //returns the array of nodes
        return results;
    }

    async getBidSuggestion(neighbourhood, R0, higherPercentile) {
        const neighbourhoodSortedByAsk = neighbourhood.sort(
            (node_one, node_two) => node_one.ask < node_two.ask
        );

        const eligibleNodes = neighbourhoodSortedByAsk.slice(
            0,
            Math.ceil((higherPercentile / 100) * neighbourhood.length),
        );

        const eligibleNodesSortedByStake = eligibleNodes.sort(
            (node_one, node_two) => node_one.stake > node_two.stake
        );

        const awardedNodes = eligibleNodesSortedByStake.slice(0, R0);

        return Math.max(...awardedNodes.map(node => node.ask)) * R0;
    }

    async findEligibleNodes(neighbourhood, bid, R1, R0) {
        return neighbourhood.filter((node) => node.ask <= (bid / R0)).slice(0, R1)
    }
}
//export default shardingTableService;
const service = new shardingTableService("ethereum");
await service.pullBlockchainShardingTable();

const blockchainTableUpdateEvent = {
    currentTarget: {
        peerId: "QmHVJmNvsYo8jmEjrGGzNCZNiQhnjqT6m87xGcSGHSmpoW",
        stake: 50000,
        ask: 0.2,
    }
};

service.updateLocalTable(blockchainTableUpdateEvent);

const textEncoder = new TextEncoder();
const neighbourhood = await service.findNeighbourhood('0xc311cca6412f8453067ac7a04831af411b2963734d107541763c1ef7c8e56f65', 4);
//const neighbourhood = await service.findNeighbourhood('QmHVJmNvsYo8jmEjrGGzNCZNiQhnjqT6m87xGcSGHSmpoW', 20);
console.log(neighbourhood)


const bidSuggestion = await service.getBidSuggestion(neighbourhood, 3, 50);
console.log(`Suggested Bid: ${bidSuggestion} (TRAC / (kb * epoch))`);

const eligibleNodes = await service.findEligibleNodes(neighbourhood, bidSuggestion, 8, 3);
console.log("Eligible nodes:");
console.log(eligibleNodes);