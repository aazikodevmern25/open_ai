const mongoose = require('mongoose');

const AICacheSchema = new mongoose.Schema({
  hsCode: {
    type: String,
    required: true
  },
  country: {
    type: String,
    required: true
  },
  mode: {
    type: String,
    required: true,
    enum: ['Export', 'Import']
  },
  productionInfo: {
    type: String,
    required: true
  },
  packagingInfo: {
    type: String,
    required: true
  },
  importantDocuments: [{
    type: String
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Compound index for fast lookups
AICacheSchema.index({ hsCode: 1, country: 1, mode: 1 }, { unique: true });

module.exports = mongoose.model('AICache', AICacheSchema);
