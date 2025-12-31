const mongoose = require('mongoose');
require('dotenv').config();

const MacmapRegulatory = require('./models/MacmapRegulatory');

async function findRecordsWithData() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('🔍 Searching for records WITH actual measure data...\n');
    
    // Find records where Data array is not empty
    const recordsWithData = await MacmapRegulatory.find({
      $or: [
        { 'Data.0': { $exists: true } },  // Data array has at least one element
        { 'AllMeasures.0': { $exists: true } }  // AllMeasures array has at least one element
      ]
    }).limit(5);

    if (recordsWithData.length > 0) {
      console.log(`✅ Found ${recordsWithData.length} records WITH regulatory data:\n`);
      
      recordsWithData.forEach((record, i) => {
        console.log(`Record ${i + 1}:`);
        console.log(`  HS Code: ${record.HsCode}`);
        console.log(`  Product: ${record.ProductName}`);
        console.log(`  ${record.ExportingCountry} → ${record.ImportingCountry}`);
        console.log(`  Data sections: ${record.Data?.length || 0}`);
        console.log(`  AllMeasures: ${record.AllMeasures?.length || 0}`);
        
        if (record.Data && record.Data.length > 0) {
          console.log(`\n  📋 Data Sections:`);
          record.Data.forEach(d => {
            console.log(`     - ${d.MeasureSection}: ${d.MeasureTotalCount} measures`);
          });
        }
        
        if (record.AllMeasures && record.AllMeasures.length > 0) {
          console.log(`\n  📌 Sample Measures:`);
          record.AllMeasures.slice(0, 5).forEach((m, j) => {
            console.log(`     ${j + 1}. ${m.Title || 'Untitled'}`);
            if (m.Code) console.log(`        Code: ${m.Code}`);
          });
        }
        console.log('\n' + '─'.repeat(60) + '\n');
      });
    } else {
      console.log('❌ NO records found with actual measure data!');
      console.log('\n📊 Database Status:');
      
      const totalRecords = await MacmapRegulatory.countDocuments();
      const emptyData = await MacmapRegulatory.countDocuments({ Data: [] });
      const noAllMeasures = await MacmapRegulatory.countDocuments({ AllMeasures: { $exists: false } });
      
      console.log(`   Total records: ${totalRecords}`);
      console.log(`   Records with empty Data: ${emptyData}`);
      console.log(`   Records without AllMeasures: ${noAllMeasures}`);
      console.log('\n❗ PROBLEM: Database has records but NO actual regulatory requirements!');
      console.log('   → This is why AI output is generic/template-based');
      console.log('   → Need to re-scrape macmap data properly\n');
    }

    await mongoose.connection.close();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

findRecordsWithData();
