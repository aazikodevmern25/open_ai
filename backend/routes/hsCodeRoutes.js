const express = require('express');
const router = express.Router();
const hsCodeController = require('../controllers/hsCodeController');

// Search HS Code (both collections)
router.get('/search/:hsCode', hsCodeController.searchHSCode);

// Search only macmap_regulatory collection
router.get('/macmap-regulatory/:hsCode', hsCodeController.searchMacmapRegulatory);

// Debug endpoint to test macmap collection
router.get('/debug-macmap', hsCodeController.debugMacmap);

// Ask OpenAI about the data
router.post('/ask', hsCodeController.askOpenAI);

// Check AI cache in database
router.get('/ai-cache/:hsCode/:country/:mode', hsCodeController.getAICache);

// Process with AI and save to database
router.post('/process-ai', hsCodeController.processAndSaveAI);

// Update AI configuration from training panel
router.post('/update-ai-config', hsCodeController.updateAIConfig);

// Test AI instructions with sample data
router.post('/test-ai-instructions', hsCodeController.testAIInstructions);

module.exports = router;
