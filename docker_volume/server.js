const express = require('express');
const { MongoClient } = require('mongodb');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Environment variables se MongoDB connection URL
const MONGO_URL = process.env.MONGO_URL || 'mongodb://admin:password@mongodb:27017';
const DB_NAME = 'devops_db';

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let dbClient = null;

async function getDb() {
    if (!dbClient) {
        dbClient = new MongoClient(MONGO_URL);
        await dbClient.connect();
    }
    return dbClient.db(DB_NAME);
}

// Health/Status API
app.get('/api/status', async (req, res) => {
    try {
        const db = await getDb();
        await db.command({ ping: 1 });
        res.json({ status: 'ok', database: 'connected', dbName: DB_NAME });
    } catch (err) {
        res.status(500).json({ status: 'error', database: 'disconnected', error: err.message });
    }
});

// Get users from MongoDB
app.get('/api/users', async (req, res) => {
    try {
        const db = await getDb();
        const users = await db.collection('users').find({}).toArray();
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add user to MongoDB
app.post('/api/users', async (req, res) => {
    try {
        const { name, role } = req.body;
        if (!name || !role) {
            return res.status(400).json({ error: 'Name and role are required' });
        }
        const db = await getDb();
        const result = await db.collection('users').insertOne({
            name,
            role,
            createdAt: new Date()
        });
        res.status(201).json({ message: 'User added successfully', id: result.insertedId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on port ${PORT}`);
});
