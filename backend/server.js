const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const cors = require('cors');
const connectDB = require('./config/database');
const hsCodeRoutes = require('./routes/hsCodeRoutes');
const complianceRoutes = require('./routes/complianceRoutes');

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increase payload limit for large data
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Connect to MongoDB
connectDB();

// Root route
app.get('/', (req, res) => {
  res.json({ 
    success: true,
    message: 'HS Code AI Search API',
    version: '2.0.0',
    endpoints: {
      health: '/health',
      search: '/api/hscode/search/:hsCode',
      ask: '/api/hscode/ask',
      complianceAnalyze: '/api/compliance/analyze'
    }
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

// Routes
app.use('/api/hscode', hsCodeRoutes);
app.use('/api/compliance', complianceRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.path} not found`,
    availableRoutes: ['/', '/health', '/api/hscode/search/:hsCode', '/api/hscode/ask', '/api/compliance/analyze']
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
