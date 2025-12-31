const mongoose = require('mongoose');
require('dotenv').config();

const MacmapRegulatory = require('./models/MacmapRegulatory');

async function inspectFullRecord() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const record = await MacmapRegulatory.findOne({
      HsCode: '490400',
      ImportingCountry: 'Germany'
    });

    if (record) {
      console.log('Full Record Structure:');
      console.log(JSON.stringify(record.toObject(), null, 2));
    } else {
      console.log('No record found');
    }

    await mongoose.connection.close();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

inspectFullRecord();
