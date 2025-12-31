const mongoose = require('mongoose');
require('dotenv').config();

const MacmapRegulatory = require('./models/MacmapRegulatory');

async function testWithRealData() {
  try {
    console.log('🔍 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected\n');

    const hsCode = '490400';
    
    // Test with Germany (we know it has data)
    console.log('═══════════════════════════════════════════════════');
    console.log(`📊 TESTING: HS ${hsCode} → GERMANY (HAS DATA)`);
    console.log('═══════════════════════════════════════════════════\n');

    const germanyData = await MacmapRegulatory.find({
      HsCode: hsCode,
      ImportingCountry: 'Germany'
    }).limit(3);

    if (germanyData.length > 0) {
      console.log(`✅ Found ${germanyData.length} records for Germany\n`);
      
      germanyData.forEach((record, i) => {
        console.log(`Record ${i + 1}:`);
        console.log(`  HS Code: ${record.HsCode}`);
        console.log(`  Product: ${record.ProductName || 'N/A'}`);
        
        if (record.AllMeasures && record.AllMeasures.length > 0) {
          console.log(`  📋 Total Measures: ${record.AllMeasures.length}`);
          console.log(`  📌 Specific Requirements:\n`);
          
          record.AllMeasures.slice(0, 15).forEach((m, j) => {
            if (m.Title) {
              console.log(`     ${j + 1}. ${m.Title}`);
              if (m.Code) console.log(`        Code: ${m.Code}`);
              if (m.Summary) console.log(`        ${m.Summary.substring(0, 120)}...`);
              console.log('');
            }
          });
        }
      });
      
      console.log('\n✅ CONCLUSION:');
      console.log('   → Germany has REAL regulatory data');
      console.log('   → AI SHOULD extract these specific measures');
      console.log('   → Output should be DIFFERENT from Bangladesh\n');
      
    } else {
      console.log('❌ No Germany data found\n');
    }

    await mongoose.connection.close();
    console.log('🔌 Connection closed');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

testWithRealData();
