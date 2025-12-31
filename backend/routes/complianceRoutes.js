const express = require('express');
const router = express.Router();
const complianceController = require('../controllers/complianceController');

// POST /api/compliance/analyze - v2 endpoint with structured response
router.post('/analyze', complianceController.analyze);

module.exports = router;
