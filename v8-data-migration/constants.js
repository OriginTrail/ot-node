import { createRequire } from 'module';

// Triple store constants
export const SCHEMA_CONTEXT = 'http://schema.org/';
export const METADATA_NAMED_GRAPH = 'metadata:graph';
export const PRIVATE_ASSERTION_ONTOLOGY =
    '<https://ontology.origintrail.io/dkg/1.0#privateAssertionID>';
export const TRIPLE_STORE_CONNECT_MAX_RETRIES = 10;
export const TRIPLE_STORE_CONNECT_RETRY_FREQUENCY = 10;
export const N_QUADS = 'application/n-quads';
export const OT_BLAZEGRAPH = 'ot-blazegraph';
export const OT_FUSEKI = 'ot-fuseki';
export const OT_GRAPHDB = 'ot-graphdb';
export const PRIVATE_CURRENT = 'privateCurrent';
export const PUBLIC_CURRENT = 'publicCurrent';
export const DKG_REPOSITORY = 'dkg';
export const VISIBILITY = {
    PUBLIC: 'public',
    PRIVATE: 'private',
};
// TODO: Change to some other value after testing
export const BATCH_SIZE = 1;
// TODO: Add correct path to noderc.json file
export const NODERC_CONFIG_PATH =
    '/Users/zvonimir/projects/ot-node/data-migration/noderc_config.json';
export const ENV_PATH = '/Users/zvonimir/projects/ot-node/data-migration/.env';
// TODO: Change url if needed
export const DKG_REPOSITORY_URL = 'http://localhost:9999';

const require = createRequire(import.meta.url);

export const ABIs = {
    Hub: require('./abi/Hub.json'),
    ContentAssetStorageV2: require('./abi/ContentAssetStorageV2.json'),
    ContentAssetStorage: require('./abi/ContentAssetStorage.json'),
};

// TODO: Remove rpc endpoints from here. They should be read from noderc_config.json. What if rpc endpoints are not defined in noderc_config.json?
export const BLOCKCHAINS = {
    BASE_DEVNET: {
        ID: 'base:84532',
        ENV: 'devnet',
        NAME: 'base_devnet',
        CONTENT_ASSET_STORAGE_CONTRACT_ADDRESS: '0xBe08A25dcF2B68af88501611e5456571f50327B4',
        RPC_ENDPOINT: 'https://sepolia.base.org',
    },
    BASE_TESTNET: {
        ID: 'base:84532',
        ENV: 'testnet',
        NAME: 'base_testnet',
        CONTENT_ASSET_STORAGE_CONTRACT_ADDRESS: '0x9e3071Dc0730CB6dd0ce42969396D716Ea33E7e1',
        RPC_ENDPOINT: 'https://sepolia.base.org',
    },
    BASE_MAINNET: {
        ID: 'base:8453',
        ENV: 'mainnet',
        NAME: 'base_mainnet',
        CONTENT_ASSET_STORAGE_CONTRACT_ADDRESS: '0x3bdfA81079B2bA53a25a6641608E5E1E6c464597',
        RPC_ENDPOINT:
            'https://api-base-mainnet-archive.dwellir.com/39af1cad-1abb-430d-8c46-a46104e85db5',
    },
    GNOSIS_DEVNET: {
        ID: 'gnosis:10200',
        ENV: 'devnet',
        NAME: 'gnosis_devnet',
        CONTENT_ASSET_STORAGE_CONTRACT_ADDRESS: '0x3db64dD0Ac054610d1e2Af9Cca0fbCB1A7f4C2d8',
        RPC_ENDPOINT: 'https://rpc.chiadochain.net',
    },
    GNOSIS_TESTNET: {
        ID: 'gnosis:10200',
        ENV: 'testnet',
        NAME: 'gnosis_testnet',
        CONTENT_ASSET_STORAGE_CONTRACT_ADDRESS: '0xeA3423e02c8d231532dab1BCE5D034f3737B3638',
        RPC_ENDPOINT: 'https://rpc.chiadochain.net',
    },
    GNOSIS_MAINNET: {
        ID: 'gnosis:100',
        ENV: 'mainnet',
        NAME: 'gnosis_mainnet',
        CONTENT_ASSET_STORAGE_CONTRACT_ADDRESS: '0xf81a8C0008DE2DCdb73366Cf78F2b178616d11DD',
        RPC_ENDPOINT: 'https://api-gnosis-archive.dwellir.com/357127e1-2557-439c-89f5-0f15c8d53922',
    },
    NEUROWEB_TESTNET: {
        ID: 'otp:20430',
        ENV: 'testnet',
        NAME: 'neuroweb_testnet',
        CONTENT_ASSET_STORAGE_CONTRACT_ADDRESS: '0x1A061136Ed9f5eD69395f18961a0a535EF4B3E5f',
        RPC_ENDPOINT: 'https://lofar-testnet.origin-trail.network/',
    },
    NEUROWEB_MAINNET: {
        ID: 'otp:2043',
        ENV: 'mainnet',
        NAME: 'neuroweb_mainnet',
        CONTENT_ASSET_STORAGE_CONTRACT_ADDRESS: '0x5cAC41237127F94c2D21dAe0b14bFeFa99880630',
        RPC_ENDPOINT: 'https://astrosat-parachain-rpc.origin-trail.network/',
    },
    HARDHAT: {
        ID: 'hardhat1:31337',
        ENV: 'development',
        NAME: 'hardhat',
        CONTENT_ASSET_STORAGE_CONTRACT_ADDRESS: '0x8aafc28174bb6c3bdc7be92f18c2f134e876c05e',
        RPC_ENDPOINT: 'http://localhost:8545',
    },
};

export const CONTENT_ASSET_STORAGE_CONTRACT = 'ContentAssetStorage';
