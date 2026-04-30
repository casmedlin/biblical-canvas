const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');

// Global error handlers to prevent bootloops
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('UNHANDLED REJECTION at:', promise, 'reason:', reason);
});

const ENV_PATH = path.join(__dirname, '../.env');
if (fs.existsSync(ENV_PATH)) {
  require('dotenv').config({ path: ENV_PATH });
}

const app = express();
const port = process.env.PORT || 8284;

// Basic middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// Logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Setup Uploads Directory
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, 'uploads');
console.log('Using uploads directory:', UPLOADS_DIR);
if (!fs.existsSync(UPLOADS_DIR)) {
  try {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  } catch (err) {
    console.error('Failed to create uploads directory:', err);
  }
}

// Health check endpoint
app.get('/health', (req, res) => res.status(200).send('OK'));

// Serve uploaded files
app.use('/uploads', express.static(UPLOADS_DIR));

// Serve static frontend files
const FRONTEND_DIR = path.join(__dirname, '../dist');
if (fs.existsSync(FRONTEND_DIR)) {
  app.use(express.static(FRONTEND_DIR));
  console.log('Serving frontend from:', FRONTEND_DIR);
} else {
  console.warn('Warning: Frontend dist directory not found at', FRONTEND_DIR);
}

// Multer Setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    cb(null, `design-${timestamp}${path.extname(file.originalname) || '.png'}`);
  }
});
const upload = multer({ storage: storage });

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';

// Admin endpoints
app.post('/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    res.json({ token: 'admin-token-123' });
  } else {
    res.status(401).json({ error: 'Invalid password' });
  }
});

const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader === 'Bearer admin-token-123') {
    next();
  } else {
    res.status(403).json({ error: 'Unauthorized' });
  }
};

app.get('/list', authenticate, (req, res) => {
  try {
    const files = fs.readdirSync(UPLOADS_DIR);
    const configFiles = files.filter(f => f.startsWith('config-') && f.endsWith('.json'));
    
    const designs = configFiles.map(file => {
      try {
        const content = fs.readFileSync(path.join(UPLOADS_DIR, file), 'utf8');
        const data = JSON.parse(content);
        const imageName = path.basename(data.imagePath);
        const requestHost = req.get('host') || `localhost:${port}`;
        const imageUrl = `${req.protocol}://${requestHost}/uploads/${imageName}`;
        
        return {
          timestamp: data.timestamp,
          imageUrl: imageUrl,
          config: data.config
        };
      } catch (e) { return null; }
    }).filter(d => d !== null).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    res.json(designs);
  } catch (err) {
    res.status(500).json({ error: 'Server error listing designs' });
  }
});

app.post('/share', upload.single('image'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image provided' });

    const designConfig = JSON.parse(req.body.config || '{}');
    const timestamp = Date.now();
    const configPath = path.join(UPLOADS_DIR, `config-${timestamp}.json`);

    fs.writeFileSync(configPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      imagePath: req.file.path,
      config: designConfig
    }, null, 2));

    const requestHost = req.get('host') || `localhost:${port}`;
    const fileUrl = `${req.protocol}://${requestHost}/uploads/${req.file.filename}`;

    res.status(200).json({ message: 'Shared successfully', url: fileUrl });
  } catch (err) {
    res.status(500).json({ error: 'Server error saving design' });
  }
});

// SPA Routing Fallback
if (fs.existsSync(FRONTEND_DIR)) {
  app.get('*', (req, res) => {
    if (!req.url.startsWith('/uploads') && !req.url.startsWith('/login') && !req.url.startsWith('/list') && !req.url.startsWith('/share')) {
      res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
    }
  });
}

app.listen(port, '0.0.0.0', () => {
  console.log(`Biblical Canvas Server running on port ${port}`);
});
