// Script to clear AI cache and test the new prompts
require('dotenv').config();
const mongoose = require('mongoose');

async function clearCacheAndTest() {
  console.log('🔧 Connecting to MongoDB...');
  
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Connected to MongoDB');
  
  // Clear AI cache
  const db = mongoose.connection.db;
  const result = await db.collection('aicaches').deleteMany({});
  console.log(`🗑️  Cleared ${result.deletedCount} cached AI results`);
  
  // Test the new analyzeCompliance function
  const { analyzeCompliance } = require('./services/analyzeCompliance');
  
  console.log('\n🧪 Testing analyzeCompliance with Belgium (EU)...\n');
  
  const testInput = {
    hsCode: '482290',
    destinationCountry: 'Belgium',
    importOrExport: 'Export',
    productNotes: 'Paper products',
    modeOfTransport: 'Sea freight',
    exportingCountry: 'India',
    incoTerms: 'FOB',
    shipmentType: 'FCL'
  };
  
  try {
    const result = await analyzeCompliance(testInput);
    
    console.log('📦 PRODUCTION ITEMS:', result.data?.sections?.production?.items?.length || 0);
    if (result.data?.sections?.production?.items) {
      result.data.sections.production.items.forEach((item, i) => {
        console.log(`   ${i+1}. ${item}`);
      });
    }
    
    console.log('\n📋 PACKAGING - Product Labelling:', result.data?.sections?.packaging?.blocks?.[0]?.items?.length || 0);
    if (result.data?.sections?.packaging?.blocks?.[0]?.items) {
      result.data.sections.packaging.blocks[0].items.forEach((item, i) => {
        console.log(`   ${i+1}. ${item}`);
      });
    }
    
    console.log('\n📋 PACKAGING - Language Rules:', result.data?.sections?.packaging?.blocks?.[1]?.items?.length || 0);
    if (result.data?.sections?.packaging?.blocks?.[1]?.items) {
      result.data.sections.packaging.blocks[1].items.forEach((item, i) => {
        console.log(`   ${i+1}. ${item}`);
      });
    }
    
    console.log('\n📋 PACKAGING - Packaging Rules:', result.data?.sections?.packaging?.blocks?.[2]?.items?.length || 0);
    if (result.data?.sections?.packaging?.blocks?.[2]?.items) {
      result.data.sections.packaging.blocks[2].items.forEach((item, i) => {
        console.log(`   ${i+1}. ${item}`);
      });
    }
    
    console.log('\n📄 DOCUMENTS - Commercial:', result.data?.sections?.documents?.blocks?.[0]?.items?.length || 0);
    if (result.data?.sections?.documents?.blocks?.[0]?.items) {
      result.data.sections.documents.blocks[0].items.forEach((item, i) => {
        console.log(`   ${i+1}. ${item}`);
      });
    }
    
    console.log('\n📄 DOCUMENTS - Compliance:', result.data?.sections?.documents?.blocks?.[1]?.items?.length || 0);
    if (result.data?.sections?.documents?.blocks?.[1]?.items) {
      result.data.sections.documents.blocks[1].items.forEach((item, i) => {
        console.log(`   ${i+1}. ${item}`);
      });
    }
    
    console.log('\n📄 DOCUMENTS - Origin & Import:', result.data?.sections?.documents?.blocks?.[2]?.items?.length || 0);
    if (result.data?.sections?.documents?.blocks?.[2]?.items) {
      result.data.sections.documents.blocks[2].items.forEach((item, i) => {
        console.log(`   ${i+1}. ${item}`);
      });
    }
    
    // Count total items
    const totalItems = 
      (result.data?.sections?.production?.items?.length || 0) +
      (result.data?.sections?.packaging?.blocks?.reduce((sum, b) => sum + (b.items?.length || 0), 0) || 0) +
      (result.data?.sections?.documents?.blocks?.reduce((sum, b) => sum + (b.items?.length || 0), 0) || 0);
    
    console.log(`\n✅ TOTAL ITEMS: ${totalItems}`);
    console.log(`\n📊 SUCCESS: ${result.success}`);
    console.log(`📊 CONFIDENCE: ${result.data?.meta?.confidence || 0}`);
    
    if (result.data?.meta?.warnings?.length > 0) {
      console.log(`⚠️  WARNINGS:`, result.data.meta.warnings);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
  
  await mongoose.connection.close();
  console.log('\n🔌 MongoDB connection closed');
}

clearCacheAndTest();
