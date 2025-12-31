const mongoose = require('mongoose');

// Schema for macmap_regulatory collection
const MacmapRegulatorySchema = new mongoose.Schema({
  ScraperName: String,
  HsCode: String,           // Full HS code (e.g., "01039100")
  HsCode6Digit: String,     // 6-digit HS code (e.g., "010391") - CORRECT FIELD NAME
  ProductName: String,
  ImportingCountry: String, // Destination country (e.g., "United States of America")
  ExportingCountry: String, // Origin country (e.g., "India")
  Source: String,
  TargetYear: String,
  Mode: String,
  Month: String,
  Year: String,
  Data: mongoose.Schema.Types.Mixed,
  Measures: mongoose.Schema.Types.Mixed,
  AllMeasures: mongoose.Schema.Types.Mixed,
  NtmYear: String,
  DataSource: String,
  TranspositionComment: String,
  DateCreated: Date,
  DateUpdated: Date
}, { 
  strict: false,
  collection: 'macmap_regulatory'
});

// Create indexes for faster search
MacmapRegulatorySchema.index({ HsCode: 1 });
MacmapRegulatorySchema.index({ HsCode6Digit: 1 });
MacmapRegulatorySchema.index({ ImportingCountry: 1 });
MacmapRegulatorySchema.index({ ExportingCountry: 1 });

module.exports = mongoose.model('MacmapRegulatory', MacmapRegulatorySchema);
