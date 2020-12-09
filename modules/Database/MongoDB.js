const { MongoClient } = require('mongodb');

class MongoDB {
    /**
     * Creates new object connected with MongoDB database
     * @constructor
     * @param database
     * @param collection
     * @param logger
     */
    constructor(database, collection, logger) {
        this.logger = logger;
        this.database = database;
        this.collection = collection;
        this.url = `mongodb://localhost:27017/${database}`;
    }

    /**
     * Initialize database
     * @return {Promise<MongoClient>}
     */
    async initialize() {
        const client = await MongoClient.connect(this.url, {
            useUnifiedTopology: true,
            useNewUrlParser: true,
        });
        const db = client.db(this.database);
        const existingCollection = await db.listCollections({ name: this.collection }).next();
        if (!existingCollection) {
            await db.createCollection(this.collection);
        }
        await client.close();
    }

    /**
     * Create document in MongoDB
     * @param documents
     * @returns {Promise<any>}
     */

    async createStagingData(documents) {
        const client = await MongoClient.connect(this.url, {
            useUnifiedTopology: true,
            useNewUrlParser: true,
        });
        const db = client.db(this.database);
        await db.collection(this.collection).insertMany(documents);
        await client.close();
    }


    /**
     * Remove document in MongoDB
     * @param documentsIDs
     * @returns {Promise<any>}
     */

    async removeStagingData(documentsIDs) {
        const client = await MongoClient.connect(this.url, {
            useUnifiedTopology: true,
            useNewUrlParser: true,
        });

        const db = client.db(this.database);
        await db.collection(this.collection).removeMany({ '@id': { $in: documentsIDs } });
        await client.close();
    }


    /**
     * Get document in MongoDB
     * @returns {Promise<any>}
     */

    async publishStagingData() {
        const client = await MongoClient.connect(this.url, {
            useUnifiedTopology: true,
            useNewUrlParser: true,
        });
        // const session = client.startSession();
        const db = client.db(this.database);

        // const transactionOptions = {
        //     readPreference: 'primary',
        //     readConcern: { level: 'local' },
        //     writeConcern: { w: 'majority' },
        // };

        // let objects;
        // const transactionResults = await session.withTransaction(async () => {
        // eslint-disable-next-line prefer-const
        const result = await db.collection(this.collection).find({},
            // { session },
        ).toArray();


        await db.collection(this.collection).removeMany({},
            // { session },
        );
        // }, transactionOptions);


        // await session.endSession();
        await client.close();

        return result;
    }

    identify() {
        return 'MongoDB';
    }
}
module.exports = MongoDB;
