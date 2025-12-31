const mongoose = require('mongoose');
require('dotenv').config();

const HSCode = require('./models/HSCode');
const MacmapRegulatory = require('./models/MacmapRegulatory');

async function verifyDatabaseData() {
  try {
    console.log('🔍 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected\n');

    const hsCode = '490400';
    const country = 'Bangladesh';

    console.log('═══════════════════════════════════════════════════');
    console.log(`📊 CHECKING DATABASE FOR: HS ${hsCode} → ${country}`);
    console.log('═══════════════════════════════════════════════════\n');

    // 1. Check indiantradeportal collection
    console.log('1️⃣  INDIANTRADEPORTAL COLLECTION:');
    console.log('─────────────────────────────────────────────────');
    const indiaData = await HSCode.find({
      HsCode: { $regex: new RegExp('^' + hsCode.substring(0, 4)) }
    }).limit(5);

    if (indiaData.length > 0) {
      console.log(`✅ Found ${indiaData.length} records\n`);
      indiaData.forEach((record, i) => {
        console.log(`Record ${i + 1}:`);
        console.log(`  HS Code: ${record.HsCode}`);
        console.log(`  Product: ${record.ProductName}`);
        console.log(`  Mode: ${record.Mode || 'N/A'}`);
        
        const data = record.Data || {};
        console.log(`  Export Policy: ${data.ExportPolicy || data.export_policy || 'Not specified'}`);
        console.log(`  Import Policy: ${data.ImportPolicy || data.import_policy || 'Not specified'}`);
        console.log(`  Restrictions: ${data.Restrictions || data.restrictions || 'None'}`);
        console.log(`  Special Notes: ${data.SpecialNotes || data.special_notes || 'None'}`);
        console.log('');
      });
    } else {
      console.log('❌ NO DATA FOUND in indiantradeportal\n');
    }

    // 2. Check macmap_regulatory collection
    console.log('\n2️⃣  MACMAP_REGULATORY COLLECTION:');
    console.log('─────────────────────────────────────────────────');
    const macmapData = await MacmapRegulatory.find({
      HsCode: { $regex: new RegExp('^' + hsCode.substring(0, 6)) },
      ImportingCountry: country
    }).limit(10);

    if (macmapData.length > 0) {
      console.log(`✅ Found ${macmapData.length} records for ${country}\n`);
      
      macmapData.forEach((record, i) => {
        console.log(`Record ${i + 1}:`);
        console.log(`  HS Code: ${record.HsCode}`);
        console.log(`  Product: ${record.ProductName || 'N/A'}`);
        console.log(`  Importing Country: ${record.ImportingCountry}`);
        console.log(`  Exporting Country: ${record.ExportingCountry}`);
        
        if (record.Data && Array.isArray(record.Data)) {
          console.log(`  Measure Sections:`);
          record.Data.forEach(d => {
            console.log(`    - ${d.MeasureSection}: ${d.MeasureTotalCount} measures`);
          });
        }
        
        if (record.AllMeasures && Array.isArray(record.AllMeasures)) {
          console.log(`  Total AllMeasures: ${record.AllMeasures.length}`);
          console.log(`  First 5 Measures:`);
          record.AllMeasures.slice(0, 5).forEach((m, j) => {
            console.log(`    ${j + 1}. ${m.Title || 'Untitled'} ${m.Code ? `(${m.Code})` : ''}`);
            if (m.Summary) console.log(`       ${m.Summary.substring(0, 100)}...`);
            if (m.LegislationTitle) console.log(`       Law: ${m.LegislationTitle.substring(0, 80)}...`);
          });
        } else {
          console.log(`  AllMeasures: EMPTY or NOT ARRAY`);
        }
        console.log('');
      });
    } else {
      console.log(`❌ NO DATA FOUND for ${country} in macmap_regulatory\n`);
      
      // Try without country filter
      console.log('🔍 Checking for ANY records with this HS code...');
      const anyMacmap = await MacmapRegulatory.find({
        HsCode: { $regex: new RegExp('^' + hsCode.substring(0, 6)) }
      }).limit(5);
      
      if (anyMacmap.length > 0) {
        console.log(`✅ Found ${anyMacmap.length} records for OTHER countries:`);
        anyMacmap.forEach(r => {
          console.log(`  - ${r.ImportingCountry}: ${r.HsCode}`);
        });
      } else {
        console.log('❌ NO macmap data for this HS code at all');
      }
    }

    // 3. Summary
    console.log('\n═══════════════════════════════════════════════════');
    console.log('📋 SUMMARY:');
    console.log('═══════════════════════════════════════════════════');
    console.log(`India Portal Records: ${indiaData.length}`);
    console.log(`Macmap Records (${country}): ${macmapData.length}`);
    
    if (indiaData.length === 0 && macmapData.length === 0) {
      console.log('\n❌ NO DATABASE DATA AVAILABLE');
      console.log('   → AI will use FALLBACK/TEMPLATE data');
      console.log('   → That\'s why you see generic requirements\n');
    } else {
      console.log('\n✅ DATABASE DATA IS AVAILABLE');
      console.log('   → AI SHOULD analyze this data');
      console.log('   → If you see generic output, AI is NOT using database properly\n');
      
      // Show what should be in AI output
      if (macmapData.length > 0 && macmapData[0].AllMeasures) {
        console.log('📌 SPECIFIC DOCUMENTS THAT SHOULD APPEAR IN AI OUTPUT:');
        const uniqueTitles = new Set();
        macmapData.forEach(r => {
          if (r.AllMeasures) {
            r.AllMeasures.slice(0, 10).forEach(m => {
              if (m.Title && m.Title.length > 10) {
                uniqueTitles.add(m.Title);
              }
            });
          }
        });
        
        Array.from(uniqueTitles).slice(0, 15).forEach((title, i) => {
          console.log(`   ${i + 1}. ${title}`);
        });
      }
    }

    await mongoose.connection.close();
    console.log('\n🔌 Connection closed');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

verifyDatabaseData();
