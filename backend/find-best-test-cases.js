const mongoose = require('mongoose');
require('dotenv').config();

const MacmapRegulatory = require('./models/MacmapRegulatory');

async function findBestTestCases() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    console.log('🔍 Finding HS codes with RICH regulatory data...\n');
    console.log('═'.repeat(70) + '\n');
    
    // Find records with most AllMeasures
    const richRecords = await MacmapRegulatory.aggregate([
      {
        $match: {
          'AllMeasures.0': { $exists: true }
        }
      },
      {
        $project: {
          HsCode: 1,
          ProductName: 1,
          ImportingCountry: 1,
          ExportingCountry: 1,
          measureCount: { $size: '$AllMeasures' },
          dataCount: { $size: { $ifNull: ['$Data', []] } }
        }
      },
      {
        $match: {
          measureCount: { $gte: 10 }  // At least 10 measures
        }
      },
      {
        $sort: { measureCount: -1 }
      },
      {
        $limit: 10
      }
    ]);

    if (richRecords.length > 0) {
      console.log('✅ TOP 10 HS CODES WITH DETAILED REGULATORY DATA:\n');
      
      richRecords.forEach((record, i) => {
        console.log(`${i + 1}. HS ${record.HsCode} → ${record.ImportingCountry}`);
        console.log(`   Product: ${record.ProductName}`);
        console.log(`   From: ${record.ExportingCountry}`);
        console.log(`   📊 Data sections: ${record.dataCount}`);
        console.log(`   📋 Total measures: ${record.measureCount}`);
        console.log('');
      });
      
      console.log('\n' + '═'.repeat(70));
      console.log('🧪 RECOMMENDED TESTS:');
      console.log('═'.repeat(70) + '\n');
      
      // Group by destination country
      const byCountry = {};
      richRecords.forEach(r => {
        if (!byCountry[r.ImportingCountry]) {
          byCountry[r.ImportingCountry] = [];
        }
        byCountry[r.ImportingCountry].push(r);
      });
      
      Object.keys(byCountry).forEach(country => {
        console.log(`\n📍 ${country}:`);
        byCountry[country].slice(0, 3).forEach(r => {
          console.log(`   ✓ HS ${r.HsCode} - ${r.ProductName.substring(0, 60)}...`);
          console.log(`     → ${r.measureCount} detailed requirements in database`);
        });
      });
      
      console.log('\n\n' + '═'.repeat(70));
      console.log('🎯 HOW TO VERIFY AI IS USING DATABASE:');
      console.log('═'.repeat(70));
      console.log('\n1. Clear cache: node clear-cache-and-test.js');
      console.log('2. Start server: npm run dev');
      console.log('3. Search one of the above HS codes');
      console.log('4. Check backend logs for:');
      console.log('   🤖 Database Data: YES ✅');
      console.log('   🤖   - Policy records: X');
      console.log('   🤖   - Regulatory measures: Y');
      console.log('\n5. AI output should include SPECIFIC documents like:');
      console.log('   - Authorization requirement for SPS reasons');
      console.log('   - Certification requirement');
      console.log('   - Marking requirements');
      console.log('   - Conformity assessment');
      console.log('   - Import licensing procedures');
      console.log('\n6. Compare with HS 490400 → Bangladesh');
      console.log('   → Should show DIFFERENT requirements!\n');
      
    } else {
      console.log('❌ No records with detailed measures found');
    }

    await mongoose.connection.close();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

findBestTestCases();
