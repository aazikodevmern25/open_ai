const mongoose = require('mongoose');
require('dotenv').config();

const MacmapRegulatory = require('./models/MacmapRegulatory');

async function inspectDataStructure() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    console.log('🔍 Inspecting Data array structure...\n');
    
    const record = await MacmapRegulatory.findOne({
      'Data.0': { $exists: true }
    });

    if (record) {
      console.log(`Record: ${record.HsCode} - ${record.ProductName}`);
      console.log(`${record.ExportingCountry} → ${record.ImportingCountry}\n`);
      
      console.log('Full Data Array Structure:');
      console.log(JSON.stringify(record.Data, null, 2));
      
      console.log('\n' + '═'.repeat(60));
      console.log('WHAT THIS MEANS FOR AI:');
      console.log('═'.repeat(60));
      
      if (record.Data && Array.isArray(record.Data)) {
        record.Data.forEach((section, i) => {
          console.log(`\nSection ${i + 1}: ${section.MeasureSection}`);
          console.log(`Total Count: ${section.MeasureTotalCount}`);
          
          if (section.MeasureDirection) {
            console.log(`Direction: ${section.MeasureDirection}`);
          }
          
          // Check for nested measures
          if (section.Measures && Array.isArray(section.Measures)) {
            console.log(`Detailed Measures: ${section.Measures.length}`);
            section.Measures.slice(0, 3).forEach((m, j) => {
              console.log(`\n  Measure ${j + 1}:`);
              console.log(JSON.stringify(m, null, 4));
            });
          }
        });
      }
    } else {
      console.log('No record with Data found');
    }

    await mongoose.connection.close();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

inspectDataStructure();
