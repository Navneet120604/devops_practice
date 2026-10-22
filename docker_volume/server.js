const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URL = process.env.MONGO_URL || 'mongodb://admin:password@mongodb:27017/devops_db?authSource=admin';
const DB_NAME = 'devops_db';

// Persistent Volume Directory
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Multer Storage Configuration for Docker Volume
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E6);
        const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        cb(null, `${uniqueSuffix}-${safeName}`);
    }
});
const upload = multer({
    storage,
    limits: { fileSize: 25 * 1024 * 1024 } // 25 MB max
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let dbClient = null;

async function getDb() {
    if (!dbClient) {
        dbClient = new MongoClient(MONGO_URL, {
            serverSelectionTimeoutMS: 5000,
            connectTimeoutMS: 5000
        });
        await dbClient.connect();
        console.log(' Connected to MongoDB database:', DB_NAME);
    }
    return dbClient.db(DB_NAME);
}

// Helper: Calculate directory size & disk stats
function getStorageStats() {
    try {
        const files = fs.readdirSync(UPLOAD_DIR);
        let totalBytes = 0;
        files.forEach(f => {
            const stat = fs.statSync(path.join(UPLOAD_DIR, f));
            totalBytes += stat.size;
        });
        return {
            fileCountOnDisk: files.length,
            totalBytesUsed: totalBytes,
            totalMBUsed: (totalBytes / (1024 * 1024)).toFixed(2),
            storagePath: UPLOAD_DIR
        };
    } catch (e) {
        return { fileCountOnDisk: 0, totalBytesUsed: 0, totalMBUsed: 0, storagePath: UPLOAD_DIR };
    }
}

// --- REST APIs ---

// 1. Health & Storage Volume Telemetry
app.get('/api/system/storage-info', async (req, res) => {
    try {
        const db = await getDb();
        await db.command({ ping: 1 });
        const dbDocCount = await db.collection('documents').countDocuments();
        const diskStats = getStorageStats();

        res.json({
            status: 'ok',
            database: {
                connected: true,
                collection: 'documents',
                indexedRecords: dbDocCount
            },
            volume: {
                isPersistent: true,
                mountPoint: UPLOAD_DIR,
                filesOnVolume: diskStats.fileCountOnDisk,
                usedDiskSpaceMB: diskStats.totalMBUsed
            }
        });
    } catch (err) {
        res.status(500).json({ status: 'error', error: err.message });
    }
});

// 2. Get All Documents (Sorted by latest)
app.get('/api/documents', async (req, res) => {
    try {
        const db = await getDb();
        const docs = await db.collection('documents')
            .find({})
            .sort({ uploadedAt: -1 })
            .toArray();
        res.json(docs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. Upload File to Docker Volume & Index in MongoDB
app.post('/api/documents/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const { description, category, author } = req.body;

        const docRecord = {
            originalName: req.file.originalname,
            storedFilename: req.file.filename,
            sizeBytes: req.file.size,
            sizeFormatted: (req.file.size / 1024).toFixed(1) + ' KB',
            mimeType: req.file.mimetype,
            description: description ? description.trim() : 'Production asset',
            category: category || 'General',
            author: author ? author.trim() : 'Navneet (DevOps)',
            volumePath: path.join(UPLOAD_DIR, req.file.filename),
            uploadedAt: new Date()
        };

        const db = await getDb();
        const result = await db.collection('documents').insertOne(docRecord);

        res.status(201).json({
            message: 'File stored to Docker Volume and indexed into MongoDB successfully!',
            document: { ...docRecord, _id: result.insertedId }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4. Download / View Stored File from Docker Volume
app.get('/api/documents/:id/download', async (req, res) => {
    try {
        const { id } = req.params;
        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid document ID' });
        }

        const db = await getDb();
        const doc = await db.collection('documents').findOne({ _id: new ObjectId(id) });
        if (!doc) {
            return res.status(404).json({ error: 'Document not found in database' });
        }

        const filePath = path.join(UPLOAD_DIR, doc.storedFilename);
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'File not found on Docker volume disk!' });
        }

        res.download(filePath, doc.originalName);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 5. Delete File from Docker Volume and MongoDB
app.delete('/api/documents/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid document ID' });
        }

        const db = await getDb();
        const doc = await db.collection('documents').findOne({ _id: new ObjectId(id) });
        if (!doc) {
            return res.status(404).json({ error: 'Document record not found' });
        }

        // Delete from Docker Volume disk
        const filePath = path.join(UPLOAD_DIR, doc.storedFilename);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        // Delete from MongoDB
        await db.collection('documents').deleteOne({ _id: new ObjectId(id) });

        res.json({ message: 'Document removed from Docker Volume and MongoDB' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(` Docker Volume Asset Hub running on port ${PORT}`);
    console.log(` Persistent volume path: ${UPLOAD_DIR}`);
});

process.on('SIGINT', async () => {
    if (dbClient) await dbClient.close();
    server.close(() => process.exit(0));
});
