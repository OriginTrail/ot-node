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
     * Reinitialize database
     * @return {Promise<MongoClient>}
     */
    async reinitialize() {
        const client = await MongoClient.connect(this.url, {
            useUnifiedTopology: true,
            useNewUrlParser: true,
        });
        const db = client.db(this.database);
        const existingCollection = await db.listCollections({ name: this.collection }).next();
        if (existingCollection) {
            await db.dropCollection(this.collection);
        }
        await db.createCollection(this.collection);
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
     * Find in MongoDB
     * @returns {Promise<any>}
     */

    async findStagingData() {
        const client = await MongoClient.connect(this.url, {
            useUnifiedTopology: true,
            useNewUrlParser: true,
        });

        const db = client.db(this.database);
        let results = [];

        try {
            results = await db.collection(this.collection).find({}).toArray();
        } catch (error) {
            throw error;
        }

        await client.close();

        return results;
    }

    /**
     * Find and remove in MongoDB
     * @returns {Promise<any>}
     */

    async findAndRemoveStagingData() {
        const client = await MongoClient.connect(this.url, {
            useUnifiedTopology: true,
            useNewUrlParser: true,
        });


        const db = client.db(this.database);

        // const session = client.startSession();
        // session.startTransaction();
        let results = [];

        try {
            results = await db.collection(this.collection).find({}).toArray();
            await db.collection(this.collection).removeMany({});

            // await session.commitTransaction();
        } catch (error) {
            // await session.abortTransaction();
            throw error;
        }


        // await session.endSession();
        await client.close();

        return results;
    }

    identify() {
        return 'MongoDB';
    }
}
module.exports = MongoDB;
