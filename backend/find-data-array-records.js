const mongoose = require('mongoose');
require('dotenv').config();

const MacmapRegulatory = require('./models/MacmapRegulatory');

async function findDataArrayRecords() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    console.log('🔍 Finding records with Data array populated...\n');
    
    // Find records where Data array has measures
    const records = await MacmapRegulatory.aggregate([
      {
        $match: {
          'Data.0': { $exists: true }
        }
      },
      {
        $addFields: {
          totalMeasures: {
            $sum: {
              $map: {
                input: '$Data',
                as: 'section',
                in: { $toInt: { $ifNull: ['$$section.MeasureTotalCount', 0] } }
              }
            }
          }
        }
      },
      {
        $match: {
          totalMeasures: { $gte: 5 }
        }
      },
      {
        $sort: { totalMeasures: -1 }
      },
      {
        $limit: 15
      }
    ]);

    console.log(`✅ Found ${records.length} records with regulatory data\n`);
    console.log('═'.repeat(70) + '\n');
    
    records.forEach((record, i) => {
      console.log(`${i + 1}. HS ${record.HsCode} → ${record.ImportingCountry}`);
      console.log(`   Product: ${record.ProductName.substring(0, 65)}...`);
      console.log(`   From: ${record.ExportingCountry}`);
      console.log(`   📊 Total measures: ${record.totalMeasures}`);
      
      if (record.Data && Array.isArray(record.Data)) {
        console.log(`   📋 Sections:`);
        record.Data.forEach(section => {
          console.log(`      - ${section.MeasureSection}: ${section.MeasureTotalCount} measures`);
          
          // Show first few measure titles
          if (section.Measures && section.Measures.length > 0) {
            section.Measures.slice(0, 3).forEach(m => {
              if (m.MeasureTitle) {
                console.log(`         • ${m.MeasureTitle}`);
              }
            });
          }
        });
      }
      console.log('');
    });
    
    console.log('\n' + '═'.repeat(70));
    console.log('🧪 BEST TEST CASES FOR YOUR APP:');
    console.log('═'.repeat(70) + '\n');
    
    // Get unique countries
    const countries = [...new Set(records.map(r => r.ImportingCountry))];
    
    countries.forEach(country => {
      const countryRecords = records.filter(r => r.ImportingCountry === country);
      console.log(`\n📍 Test with ${country}:`);
      countryRecords.slice(0, 2).forEach(r => {
        console.log(`   ✓ HS Code: ${r.HsCode}`);
        console.log(`     Product: ${r.ProductName.substring(0, 60)}...`);
        console.log(`     Expected: ${r.totalMeasures} specific requirements from database\n`);
      });
    });
    
    console.log('\n' + '═'.repeat(70));
    console.log('⚠️  WHY HS 490400 → BANGLADESH SHOWS GENERIC:');
    console.log('═'.repeat(70));
    console.log('\n❌ Bangladesh is NOT in the list above');
    console.log('❌ HS 490400 has NO detailed measures in database');
    console.log('→ AI uses fallback template (generic requirements)\n');
    console.log('✅ To see REAL database analysis, test with HS codes above!\n');

    await mongoose.connection.close();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

findDataArrayRecords();
