const mongoose = require('mongoose');

// Define flexible schema since the structure is nested
const HSCodeSchema = new mongoose.Schema({
  ScraperName: String,
  HsCode: String,
  HsCodeSearched: String,
  ProductName: String,
  Source: String,
  Mode: String,
  Month: String,
  Year: String,
  Data: mongoose.Schema.Types.Mixed,
  DateCreated: Date,
  DateUpdated: Date
}, { 
  strict: false,
  collection: 'indiantradeportal'
});

module.exports = mongoose.model('HSCode', HSCodeSchema);
