const { analyzeCompliance, mapV2ToV1 } = require('../services/analyzeCompliance');
const HSCode = require('../models/HSCode');
const MacmapRegulatory = require('../models/MacmapRegulatory');

// POST /api/compliance/analyze - New v2 endpoint
exports.analyze = async (req, res) => {
  try {
    const {
      hsCode,
      destinationCountry,
      importOrExport,
      productNotes,
      modeOfTransport,
      exportingCountry,
      incoTerms,
      shipmentType
    } = req.body;

    console.log(`\n🔍 Fetching database data for AI analysis...`);
    console.log(`   HS Code: ${hsCode}, Country: ${destinationCountry}`);
    
    // Fetch database data for AI to analyze
    const hsCode6Digit = hsCode.substring(0, 6);
    
    // Fetch indiantradeportal data
    let indianTradeData = [];
    try {
      indianTradeData = await HSCode.find({
        HsCode: hsCode,
        Mode: importOrExport || 'Export'
      }).limit(5).lean();
      console.log(`   📊 IndianTradePortal records: ${indianTradeData.length}`);
    } catch (e) {
      console.log(`   ⚠️  IndianTradePortal fetch error: ${e.message}`);
    }
    
    // Fetch macmap data
    let macmapData = [];
    try {
      macmapData = await MacmapRegulatory.find({
        $or: [
          { HsCode6Digit: hsCode6Digit },
          { HsCode: hsCode }
        ],
        ImportingCountry: new RegExp(destinationCountry, 'i')
      }).limit(10).lean();
      
      if (macmapData.length === 0) {
        // Fallback without country filter
        macmapData = await MacmapRegulatory.find({
          $or: [
            { HsCode6Digit: hsCode6Digit },
            { HsCode: hsCode }
          ]
        }).limit(10).lean();
      }
      console.log(`   📊 MacmapRegulatory records: ${macmapData.length}`);
    } catch (e) {
      console.log(`   ⚠️  MacmapRegulatory fetch error: ${e.message}`);
    }
    
    // Extract country-specific data from indiantradeportal nested structure
    const policyInfo = [];
    const country = destinationCountry;
    
    indianTradeData.forEach((record, idx) => {
      const dataFields = record.Data || {};
      
      // DEBUG: Show what keys exist in Data
      const dataKeys = Object.keys(dataFields);
      console.log(`   Record ${idx + 1} Data keys: [${dataKeys.slice(0, 10).join(', ')}${dataKeys.length > 10 ? '...' : ''}]`);
      
      // Check for country-specific nested data: Data.{Country}.{HsCode}
      let countryData = null;
      
      // Try exact match first, or check all country keys
      let countrySection = null;
      
      if (dataFields[country]) {
        console.log(`   ✅ Found exact match for country: ${country}`);
        countrySection = dataFields[country];
      } else {
        // Try to find country by checking all keys (case-insensitive)
        const countryKeys = Object.keys(dataFields);
        const matchingKey = countryKeys.find(key => 
          key.toLowerCase() === country.toLowerCase()
        );
        
        if (matchingKey) {
          console.log(`   ✅ Found country with alternate casing: ${matchingKey}`);
          countrySection = dataFields[matchingKey];
        } else {
          console.log(`   ❌ Country "${country}" not found in Data keys: [${countryKeys.slice(0, 5).join(', ')}...]`);
        }
      }
      
      if (countrySection) {
        
        // Try to find HS code specific data
        // The nested data uses 8-digit HS code, so pad with zeros
        const hsCodeVariants = [
          hsCode.padStart(8, '0'),  // 490400 → 49040000 (MOST LIKELY!)
          hsCode,                    // 490400 as-is
          hsCode + '00',            // 490400 → 49040000 (alternative)
          hsCode.substring(0, 6),   // First 6 digits
          hsCode.substring(0, 4)    // First 4 digits
        ];
        
        // DEBUG: Show HS code variants we're looking for
        const countryKeys = Object.keys(countrySection);
        console.log(`      Country section keys: [${countryKeys.join(', ')}]`);
        console.log(`      Looking for HS variants: [${hsCodeVariants.join(', ')}]`);
        
        for (const variant of hsCodeVariants) {
          if (countrySection[variant]) {
            console.log(`      ✅ Found HS variant: ${variant}`);
            countryData = countrySection[variant];
            break;
          }
        }
        
        if (countryData) {
          console.log(`   ✅ Found country-specific data for ${country} under HS ${hsCode}`);
          
          // Extract trade agreement data
          const countryTradeData = countryData.Data || null;
          const countryDocuments = countryData.Sbs || [];
          const exportPolicyArray = countryData.ExportPolicy || [];
          
          policyInfo.push({
            product_name: record.ProductName || '',
            hs_code: record.HsCode || '',
            mode: record.Mode || '',
            country: country,
            hs_description: countryData.HscodeDescription || '',
            export_policy: exportPolicyArray.map(ep => ({
              description: ep.Description,
              policy: ep.Policy || ep.PolicyDescription,
              restriction: ep.Restriction,
              unit: ep.Unit
            })),
            trade_agreements: countryTradeData ? {
              apta_tariff: countryTradeData['Asia-Pacific Trade Agreement Tariff'],
              apta_rules: countryTradeData['Asia-Pacific Trade Agreement Rules Of Origin'],
              safta_tariff: countryTradeData['South Asian Free Trade Area Tariff'],
              safta_rules: countryTradeData['South Asian Free Trade Area Rules Of Origin'],
              sapta_tariff: countryTradeData['SAARC Preferential Trading Arrangement Tariff'],
              sapta_rules: countryTradeData['SAARC Preferential Trading Arrangement Rules Of Origin'],
              mfn_tariff: countryTradeData['Most Favoured Nation Tariff']
            } : null,
            documents: countryDocuments.map(doc => ({
              title: doc.Document,
              type: doc.TypeOfDocuement || 'General',
              url: doc.DocumentUrl,
              name: doc.DocumentName
            }))
          });
        }
      }
    });
    
    // Check if we have meaningful data
    const hasMeaningfulPolicyData = policyInfo.length > 0 && 
      policyInfo.some(p => 
        p.hs_description ||
        (p.export_policy && p.export_policy.length > 0) ||
        p.trade_agreements ||
        (p.documents && p.documents.length > 0)
      );
    
    console.log(`   📋 Policy info extracted: ${policyInfo.length}`);
    console.log(`   ✅ Has meaningful policy data: ${hasMeaningfulPolicyData}\n`);

    // Call shared service WITH database data
    const result = await analyzeCompliance({
      hsCode,
      destinationCountry,
      importOrExport: importOrExport || 'Export',
      productNotes,
      modeOfTransport,
      exportingCountry,
      incoTerms,
      shipmentType,
      // NEW: Pass extracted database data
      databaseData: {
        regulatoryMeasures: [],
        policyInformation: policyInfo,
        hasData: hasMeaningfulPolicyData
      }
    });

    if (!result.success && result.error) {
      return res.status(400).json({
        success: false,
        message: result.error,
        details: result.details,
        data: result.data
      });
    }

    // Count total items for info bar
    const totalItems = countTotalItems(result.data);

    res.json({
      success: true,
      totalItems,
      ...result.data
    });
  } catch (error) {
    console.error('Compliance analyze error:', error);
    res.status(500).json({
      success: false,
      message: 'Error analyzing compliance requirements',
      error: error.message
    });
  }
};

// Helper to count total items across all sections
function countTotalItems(data) {
  let count = 0;

  // Production items
  count += data.sections?.production?.items?.length || 0;

  // Packaging blocks
  if (data.sections?.packaging?.blocks) {
    data.sections.packaging.blocks.forEach((block) => {
      count += block.items?.length || 0;
    });
  }

  // Document blocks
  if (data.sections?.documents?.blocks) {
    data.sections.documents.blocks.forEach((block) => {
      count += block.items?.length || 0;
    });
  }

  return count;
}

// Wrapper for v1 endpoint - uses v2 service and maps response
exports.analyzeForV1 = async (hsCode, country, mode, data, macmapData) => {
  // Build input from v1 parameters
  const input = {
    hsCode,
    destinationCountry: country,
    importOrExport: mode || 'Export',
    productNotes: data?.[0]?.ProductName || '',
    exportingCountry: 'India'
  };

  // Call v2 service
  const result = await analyzeCompliance(input);

  // Map to v1 format
  return mapV2ToV1(result.data);
};
