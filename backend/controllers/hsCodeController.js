const HSCode = require('../models/HSCode');
const MacmapRegulatory = require('../models/MacmapRegulatory');
const AICache = require('../models/AICache');
const OpenAI = require('openai');
const aiPrompts = require('../config/aiPrompts');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Country name mapping for variations
const countryNameMap = {
  'USA': 'United States',
  'US': 'United States',
  'United States': 'United States',
  'UK': 'United Kingdom',
  'Britain': 'United Kingdom',
  'UAE': 'United Arab Emirates',
  'Germany': 'Germany',
  'France': 'France',
  'China': 'China',
  'Japan': 'Japan',
  'India': 'India',
  'Belgium': 'Belgium',
  'Bangladesh': 'Bangladesh'
};

// Search HS Code in database (both indiantradeportal and macmap_regulatory)
exports.searchHSCode = async (req, res) => {
  console.log('=== searchHSCode called ===', req.params, req.query);
  try {
    const { hsCode } = req.params;
    const { country, mode } = req.query; // Get country (destination) and mode from query parameters
    
    // Extract 6-digit HS code for matching
    const hsCode6Digit = hsCode.substring(0, 6);
    
    // Normalize country name for macmap search
    const normalizedCountry = country ? (countryNameMap[country] || country) : null;
    
    console.log('Step 1: Building indiantradeportal query...');
    
    // ========== SEARCH 1: indiantradeportal collection ==========
    // First try exact match (faster)
    let records = [];
    try {
      const searchQuery = {
        HsCode: hsCode,
        Mode: mode || 'Export'
      };
      
      console.log('Step 2: Executing indiantradeportal query (exact match)...');
      records = await HSCode.find(searchQuery).limit(10).maxTimeMS(3000);
      console.log('Step 3: indiantradeportal records found:', records.length);
    } catch (hsError) {
      console.log('indiantradeportal query error/timeout, continuing with macmap only:', hsError.message);
      records = [];
    }

    // Filter by country if specified (for indiantradeportal Data field)
    let filteredData = records;
    if (country) {
      filteredData = records.map(record => {
        if (record.Data && record.Data[country]) {
          return {
            ...record.toObject(),
            Data: {
              [country]: record.Data[country]
            },
            FilteredCountry: country
          };
        }
        return null;
      }).filter(item => item !== null);
    }

    // ========== SEARCH 2: macmap_regulatory collection ==========
    // Search by HS code AND ImportingCountry (destination country)
    let macmapRecords = [];
    
    try {
      // Build query - use correct field name HsCode6Digit
      const macmapQuery = {
        $or: [
          { HsCode6Digit: hsCode6Digit },  // Match 6-digit field (CORRECT NAME)
          { HsCode: hsCode },               // Exact match full code
          { HsCode: new RegExp(`^${hsCode6Digit}`) }  // Starts with 6-digit
        ]
      };

      // If country (destination) is specified, filter by ImportingCountry
      if (country) {
        // Use normalized country name for better matching
        // Match partial name (e.g., "United States" matches "United States of America")
        const searchCountry = normalizedCountry || country;
        macmapQuery.ImportingCountry = new RegExp(searchCountry, 'i');
      }

      console.log('Macmap Query:', JSON.stringify(macmapQuery));
      console.log('Searching for HsCode:', hsCode, 'HsCode6Digit:', hsCode6Digit, 'Country:', country, 'Normalized:', normalizedCountry);
      
      macmapRecords = await MacmapRegulatory.find(macmapQuery)
        .limit(20)
        .lean();  // Use lean() for faster query
        
      console.log('Macmap Records Found:', macmapRecords.length);
      
      // If no results with country filter, try without country
      if (macmapRecords.length === 0 && country) {
        console.log('No results with country filter, trying without...');
        const fallbackQuery = {
          $or: [
            { HsCode6Digit: hsCode6Digit },
            { HsCode: hsCode },
            { HsCode: new RegExp(`^${hsCode6Digit}`) }
          ]
        };
        macmapRecords = await MacmapRegulatory.find(fallbackQuery).limit(10).lean();
        console.log('Fallback Macmap Records Found:', macmapRecords.length);
      }
    } catch (macmapError) {
      console.error('Macmap Search Error:', macmapError.message);
      // Continue without macmap data if there's an error
    }

    // Check if we have any data
    const hasIndianTradePortalData = filteredData.length > 0;
    const hasMacmapData = macmapRecords.length > 0;

    if (!hasIndianTradePortalData && !hasMacmapData) {
      return res.status(404).json({
        success: false,
        message: `No records found for HS Code: ${hsCode}${country ? ` and country: ${country}` : ''}`
      });
    }

    res.json({
      success: true,
      hsCode: hsCode,
      hsCode6Digit: hsCode6Digit,
      country: country || 'All',
      mode: mode || 'Export',
      
      // Indian Trade Portal data
      indianTradePortal: {
        count: filteredData.length,
        data: filteredData
      },
      
      // Macmap Regulatory data
      macmapRegulatory: {
        count: macmapRecords.length,
        data: macmapRecords
      },
      
      // Combined count
      totalCount: filteredData.length + macmapRecords.length,
      
      // Legacy support - keep 'data' field for backward compatibility
      count: filteredData.length,
      data: filteredData
    });
  } catch (error) {
    console.error('Search Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error searching HS Code',
      error: error.message
    });
  }
};

// Search ONLY macmap_regulatory collection
exports.searchMacmapRegulatory = async (req, res) => {
  try {
    const { hsCode } = req.params;
    const { importingCountry, exportingCountry } = req.query;
    
    // Extract 6-digit HS code
    const hsCode6Digit = hsCode.substring(0, 6);
    
    // Build query for macmap_regulatory - use correct field name HsCode6Digit
    const query = {
      $or: [
        { HsCode: hsCode },
        { HsCode: { $regex: `^${hsCode6Digit}` } },
        { HsCode6Digit: hsCode6Digit },
        { HsCode6Digit: { $regex: `^${hsCode6Digit}` } }
      ]
    };

    // Filter by ImportingCountry (destination country) if specified
    if (importingCountry) {
      query.ImportingCountry = { $regex: new RegExp(importingCountry, 'i') };
    }

    // Filter by ExportingCountry (origin country) if specified
    if (exportingCountry) {
      query.ExportingCountry = { $regex: new RegExp(exportingCountry, 'i') };
    }

    const records = await MacmapRegulatory.find(query).limit(50);

    if (records.length === 0) {
      return res.status(404).json({
        success: false,
        message: `No macmap regulatory records found for HS Code: ${hsCode}`,
        searchCriteria: {
          hsCode,
          hsCode6Digit,
          importingCountry: importingCountry || 'All',
          exportingCountry: exportingCountry || 'All'
        }
      });
    }

    // Extract unique countries for reference
    const uniqueImportingCountries = [...new Set(records.map(r => r.ImportingCountry).filter(Boolean))];
    const uniqueExportingCountries = [...new Set(records.map(r => r.ExportingCountry).filter(Boolean))];

    res.json({
      success: true,
      hsCode: hsCode,
      hsCode6Digit: hsCode6Digit,
      count: records.length,
      importingCountry: importingCountry || 'All',
      exportingCountry: exportingCountry || 'All',
      availableImportingCountries: uniqueImportingCountries,
      availableExportingCountries: uniqueExportingCountries,
      data: records
    });
  } catch (error) {
    console.error('Macmap Search Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error searching macmap_regulatory',
      error: error.message
    });
  }
};

// Debug endpoint to check macmap_regulatory collection
exports.debugMacmap = async (req, res) => {
  try {
    const mongoose = require('mongoose');
    
    // Get list of all collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);
    
    // Try to find any document in macmap_regulatory
    let sampleDoc = null;
    let docCount = 0;
    
    try {
      sampleDoc = await MacmapRegulatory.findOne().lean();
      docCount = await MacmapRegulatory.countDocuments();
    } catch (e) {
      console.log('Error querying MacmapRegulatory:', e.message);
    }
    
    // Also try direct collection access
    let directSample = null;
    let directCount = 0;
    try {
      const db = mongoose.connection.db;
      directSample = await db.collection('macmap_regulatory').findOne();
      directCount = await db.collection('macmap_regulatory').countDocuments();
    } catch (e) {
      console.log('Error with direct access:', e.message);
    }
    
    res.json({
      success: true,
      debug: {
        allCollections: collectionNames,
        macmapRegulatoryModel: {
          sampleDocument: sampleDoc,
          documentCount: docCount
        },
        directCollectionAccess: {
          sampleDocument: directSample,
          documentCount: directCount
        }
      }
    });
  } catch (error) {
    console.error('Debug Error:', error);
    res.status(500).json({
      success: false,
      message: 'Debug error',
      error: error.message
    });
  }
};

// Ask OpenAI about the retrieved data
exports.askOpenAI = async (req, res) => {
  try {
    const { prompt, data } = req.body;

    if (!prompt || !data) {
      return res.status(400).json({
        success: false,
        message: 'Prompt and data are required'
      });
    }

    // Extract and SUMMARIZE data to avoid token limits
    const summarizedData = data.slice(0, 3).map(record => {
      // Handle deeply nested Data structure: Data -> Country -> HSCode -> actual data
      const dataContent = record.Data || {};
      
      // Get the first country key (e.g., "Belgium", "Bangladesh", etc.)
      const countryKeys = Object.keys(dataContent);
      const firstCountryData = countryKeys.length > 0 ? dataContent[countryKeys[0]] : {};
      
      // Get the first HS code key from country data
      const hsCodeKeys = Object.keys(firstCountryData);
      const actualData = hsCodeKeys.length > 0 ? firstCountryData[hsCodeKeys[0]] : {};
      
      // Summarize nested arrays to reduce tokens
      const gstRates = actualData.Gst?.Details ? 
        actualData.Gst.Details.map(g => `${g.GstRate} (${g.GstDescription})`).join('; ') : 'Not available';
      
      const documentCount = actualData.Sbs ? actualData.Sbs.length : 0;
      const documentTypes = actualData.Sbs ? 
        [...new Set(actualData.Sbs.map(d => d.TypeOfDocuement))].join(', ') : 'Not available';
      // Extract ALL document names (not just 3)
      const allDocuments = actualData.Sbs ? 
        actualData.Sbs.map(d => d.Document).join('; ') : 'Not available';
      
      const exportPolicyText = actualData.ExportPolicy?.[0] ? 
        `${actualData.ExportPolicy[0].Policy} - ${actualData.ExportPolicy[0].PolicyDescription}` : 'Not available';
      
      const dutyDrawbackRate = actualData.DutyDrawback?.[0]?.DrawbackRate || 'Not available';
      
      const rodtepRate = actualData.RodTep ? 
        `DTA: ${actualData.RodTep.RODTEPRateDTAExportsAgeOfFOB}%, SEZ: ${actualData.RodTep['RoDTEPRatesAA/EOU/SEZExportsAgeOfFOB']}%` : 'Not available';
      
      const tariffMFN = actualData.Data?.['Most Favoured Nation Tariff '] || 'Not available';
      
      return {
        HsCode: record.HsCode || record.HsCodeSearched,
        Mode: record.Mode,
        Country: record.FilteredCountry || record.Country,
        ProductName: record.ProductName,
        Source: record.Source,
        Year: record.Year,
        Month: record.Month,
        HscodeDescription: actualData.HscodeDescription || 'Not available',
        
        // Summarized information (not full objects)
        ExportPolicy: exportPolicyText,
        GstRates: gstRates,
        DocumentsCount: documentCount,
        DocumentTypes: documentTypes,
        AllDocuments: allDocuments,
        DutyDrawbackRate: dutyDrawbackRate,
        RodTepRates: rodtepRate,
        MFNTariff: tariffMFN,
        InterestSubvention: actualData.InterestSubvention?.[0]?.MSMESectorManufacturers || 'Not available',
      };
    });

    // Extract unique values for summary
    const uniqueCountries = [...new Set(summarizedData.map(r => r.Country).filter(Boolean))];
    const uniqueModes = [...new Set(summarizedData.map(r => r.Mode).filter(Boolean))];
    const uniqueSources = [...new Set(summarizedData.map(r => r.Source).filter(Boolean))];
    const uniqueYears = [...new Set(summarizedData.map(r => r.Year).filter(Boolean))];

    // Create detailed data summary with ACTUAL database values
    const totalRecords = data.length;
    const dataSummary = `
=== YOUR DATABASE SEARCH RESULTS FOR HS CODE ${summarizedData[0]?.HsCode || 'N/A'} ===

Total Records Found in Database: ${totalRecords}
Showing Sample: First 3 records (detailed analysis below)
Mode (Import/Export): ${uniqueModes.join(', ') || 'Not specified'}
Countries: ${uniqueCountries.join(', ') || 'Not specified'}
Data Source: ${uniqueSources.join(', ') || 'Not specified'}
Years: ${uniqueYears.join(', ') || 'Not specified'}

=== DETAILED SAMPLE RECORDS (3 of ${totalRecords}) ===
${JSON.stringify(summarizedData, null, 2)}

CRITICAL INSTRUCTIONS FOR AI:
1. These are ACTUAL records from the user's MongoDB database (${totalRecords} total records)
2. ANSWER THE USER'S SPECIFIC QUESTION - don't give full analysis for every question
3. Use ONLY this data - never use your general knowledge about HS codes
4. AllDocuments field contains ALL ${summarizedData[0]?.DocumentsCount || 0} document names - list them when asked
5. GstRates field contains ALL GST rates with descriptions - list them when asked
6. If user asks general question like "Analyze" or "Key points" - then give full analysis
7. If user asks specific question like "What is GST?" or "List documents" - answer ONLY that
8. If information is not in the records, say "Not found in your database"
`;

    // Prepare context for OpenAI with STRICT instructions
    const contextMessage = `${dataSummary}\n\nUser Question: ${prompt}`;

    console.log('Sending to OpenAI, context length:', contextMessage.length);
    console.log('Number of records being sent:', summarizedData.length);

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a trade data analyst. IMPORTANT RULES:\n\n1. ANSWER THE USER'S SPECIFIC QUESTION - Don't give full analysis for every question\n2. If user asks 'What are GST rates?' - ONLY talk about GST rates, nothing else\n3. If user asks 'List documents' - ONLY list the documents from AllDocuments field\n4. If user asks 'Analyze this data' or 'Give key points' - THEN give full detailed analysis\n5. Use ONLY the database records provided - never use general knowledge\n6. Be DIRECT and FOCUSED on what user asks\n7. For document lists: List ALL documents from AllDocuments field, number them 1, 2, 3...\n8. For GST: List each rate with its description clearly\n9. For policy: State the exact policy text\n10. If info not found, say 'Not found in database'\n\nEXAMPLES:\n- 'What is export policy?' → Answer: 'Export Permitted Freely - Free'\n- 'List GST rates' → List only GST rates with descriptions\n- 'Show documents' → List all documents numbered 1-16\n- 'Analyze data' → Give full comprehensive analysis with all sections"
        },
        {
          role: "user",
          content: contextMessage
        }
      ],
      temperature: 0.7,
      max_tokens: 2000
    });

    const answer = completion.choices[0].message.content;

    res.json({
      success: true,
      answer: answer,
      usage: completion.usage
    });
  } catch (error) {
    console.error('OpenAI Error:', error);
    console.error('Error details:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: 'Error processing request with OpenAI',
      error: error.message
    });
  }
};

// Check if AI cache exists in database
exports.getAICache = async (req, res) => {
  try {
    const { hsCode, country, mode } = req.params;
    
    const cachedResult = await AICache.findOne({ hsCode, country, mode });
    
    if (cachedResult) {
      console.log(`Found cached AI result for ${hsCode}_${country}_${mode}`);
      return res.json({
        success: true,
        cachedResult: cachedResult
      });
    }
    
    res.json({
      success: false,
      message: 'No cached result found'
    });
  } catch (error) {
    console.error('Error checking AI cache:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking cache',
      error: error.message
    });
  }
};

// Helper: Parse and validate AI JSON response
function parseAndValidateAIResponse(aiResponse) {
  // Extract JSON from response (handle potential markdown wrapping)
  const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error('No JSON found in AI response:', aiResponse);
    throw new Error('AI response does not contain valid JSON');
  }

  let parsed;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error('JSON parse error:', e.message);
    console.error('Raw response:', aiResponse);
    throw new Error(`Invalid JSON format: ${e.message}`);
  }

  // Validate required keys for 3-section structure
  const requiredKeys = ['production_stage', 'packaging_and_labeling', 'documents_required'];
  const missingKeys = requiredKeys.filter((key) => !Array.isArray(parsed[key]));

  if (missingKeys.length > 0) {
    console.error('Missing or invalid keys:', missingKeys);
    // Provide defaults for missing keys
    missingKeys.forEach((key) => {
      parsed[key] = [];
    });
  }

  return parsed;
}

// Helper: Remove null, empty, and duplicate values from array
function cleanArray(arr) {
  if (!Array.isArray(arr)) return [];
  return [...new Set(arr.filter((item) => item && item.trim && item.trim() !== ''))];
}

// Helper: Normalize MongoDB data into categorized structure for AI
function normalizeInputData(hsCode, country, mode, data, macmapData) {
  const normalized = {
    hs_code: hsCode,
    trade_flow: mode,
    origin_country: 'India',
    destination_country: country,
    production_requirements: [],
    packaging_labeling: [],
    documents_required: [],
    regulatory_compliance: []
  };

  // Extract from indiantradeportal data
  if (data && data.length > 0) {
    const record = data[0];
    const dataContent = record.Data || {};
    const countryKeys = Object.keys(dataContent);
    const firstCountryData = countryKeys.length > 0 ? dataContent[countryKeys[0]] : {};
    const hsCodeKeys = Object.keys(firstCountryData);
    const actualData = hsCodeKeys.length > 0 ? firstCountryData[hsCodeKeys[0]] : {};

    // Production requirements from export policy and quality standards
    if (actualData.ExportPolicy?.[0]) {
      const policy = actualData.ExportPolicy[0];
      if (policy.Policy) {
        normalized.production_requirements.push(`Export Policy: ${policy.Policy}`);
      }
      if (policy.PolicyDescription) {
        normalized.production_requirements.push(policy.PolicyDescription);
      }
    }

    // GST as regulatory compliance
    if (actualData.Gst?.Details) {
      actualData.Gst.Details.forEach((g) => {
        if (g.GstRate && g.GstDescription) {
          normalized.regulatory_compliance.push(`GST ${g.GstRate}: ${g.GstDescription}`);
        }
      });
    }

    // Documents required (operational documents only)
    if (actualData.Sbs) {
      actualData.Sbs.forEach((d) => {
        if (d.Document) {
          normalized.documents_required.push(d.Document);
        }
      });
    }

    // Duty drawback as regulatory
    if (actualData.DutyDrawback?.[0]?.DrawbackRate) {
      normalized.regulatory_compliance.push(
        `Duty Drawback Rate: ${actualData.DutyDrawback[0].DrawbackRate}`
      );
    }

    // Packaging/labeling from Packaging field if exists
    if (actualData.Packaging) {
      if (Array.isArray(actualData.Packaging)) {
        actualData.Packaging.forEach((p) => {
          if (p.Requirement) normalized.packaging_labeling.push(p.Requirement);
        });
      }
    }

    // Labeling requirements
    if (actualData.Labeling) {
      if (Array.isArray(actualData.Labeling)) {
        actualData.Labeling.forEach((l) => {
          if (l.Requirement) normalized.packaging_labeling.push(l.Requirement);
        });
      }
    }
  }

  // Extract from macmap_regulatory data
  if (macmapData && macmapData.length > 0) {
    macmapData.slice(0, 5).forEach((record) => {
      // AllMeasures contain regulatory requirements
      if (record.AllMeasures && Array.isArray(record.AllMeasures)) {
        record.AllMeasures.forEach((m) => {
          if (m.Title) {
            // Categorize based on measure type
            const title = m.Title.toLowerCase();
            const item = m.Summary ? `${m.Title}: ${m.Summary}` : m.Title;

            if (title.includes('label') || title.includes('packaging') || title.includes('marking')) {
              normalized.packaging_labeling.push(item);
            } else if (title.includes('certificate') || title.includes('document') || title.includes('license')) {
              normalized.documents_required.push(item);
            } else if (title.includes('production') || title.includes('quality') || title.includes('standard')) {
              normalized.production_requirements.push(item);
            } else {
              normalized.regulatory_compliance.push(item);
            }
          }
        });
      }

      // Data contains measure sections
      if (record.Data && Array.isArray(record.Data)) {
        record.Data.forEach((d) => {
          if (d.MeasureSection) {
            normalized.regulatory_compliance.push(
              `${d.MeasureSection} (${d.MeasureDirection || 'N/A'}): ${d.MeasureTotalCount || 0} measures`
            );
          }
        });
      }
    });
  }

  // Clean all arrays - remove nulls, empties, duplicates
  normalized.production_requirements = cleanArray(normalized.production_requirements);
  normalized.packaging_labeling = cleanArray(normalized.packaging_labeling);
  normalized.documents_required = cleanArray(normalized.documents_required);
  normalized.regulatory_compliance = cleanArray(normalized.regulatory_compliance);

  return normalized;
}

// Process with AI and save to database
exports.processAndSaveAI = async (req, res) => {
  try {
    const { hsCode, country, mode, data, macmapData } = req.body;

    if (!hsCode || !country || !mode || !data) {
      return res.status(400).json({
        success: false,
        message: 'hsCode, country, mode, and data are required'
      });
    }

    // Check if already cached
    const existingCache = await AICache.findOne({ hsCode, country, mode });
    if (existingCache) {
      console.log(`\n💾 ============================================`);
      console.log(`💾 RETURNING CACHED RESULT (NOT calling OpenAI)`);
      console.log(`💾 Cache key: ${hsCode}_${country}_${mode}`);
      console.log(`💾 Cached at: ${existingCache.createdAt}`);
      console.log(`💾 ============================================\n`);
      return res.json({
        success: true,
        productionInfo: existingCache.productionInfo,
        packagingInfo: existingCache.packagingInfo,
        importantDocuments: existingCache.importantDocuments || [],
        regulatoryInfo: existingCache.regulatoryInfo || null,
        fromCache: true,
        source: 'DATABASE_CACHE'
      });
    }

    // Use shared v2 service
    const { analyzeCompliance, mapV2ToV1 } = require('../services/analyzeCompliance');

    // Build input for v2 service WITH DATABASE DATA
    const productName = data?.[0]?.ProductName || '';
    
    console.log(`\n🔍 Extracting database data for AI...`);
    console.log(`   indiantradeportal records: ${data?.length || 0}`);
    console.log(`   macmap records: ${macmapData?.length || 0}`);
    
    // Extract regulatory measures from database
    const regulatoryDetails = macmapData?.slice(0, 10).map((record) => {
      const dataArray = record.Data || [];
      const allMeasures = record.AllMeasures || [];
      
      return {
        hs_code: record.HsCode,
        product: record.ProductName,
        importing_country: record.ImportingCountry,
        measure_section: dataArray.map(d => d.MeasureSection).filter(Boolean).join(', '),
        measure_count: dataArray.map(d => d.MeasureTotalCount).filter(Boolean).join(', '),
        data_sections: dataArray.map(d => ({
          section: d.MeasureSection,
          count: d.MeasureTotalCount,
          measures: d.Measures?.slice(0, 10).map(m => ({
            code: m.MeasureCode,
            title: m.MeasureTitle,
            summary: m.MeasureSummary
          })) || []
        })),
        all_measures: allMeasures.slice(0, 15).map((m) => ({
          code: m.Code,
          title: m.Title,
          summary: m.Summary || '',
          legislation: m.LegislationTitle || ''
        }))
      };
    }).filter(r => 
      // Only keep records that have meaningful data
      (r.data_sections && r.data_sections.length > 0) || 
      (r.all_measures && r.all_measures.length > 0)
    ) || [];

    // Extract export/import policy from indiantradeportal data
    const policyInfo = [];
    
    data?.slice(0, 5).forEach((record) => {
      const dataFields = record.Data || {};
      
      // NEW STRUCTURE: Check for country-specific nested data: Data.{Country}.{HsCode}
      let countryData = null;
      let countryTradeData = null;
      let countryDocuments = [];
      let exportPolicyArray = [];
      
      // Try to find country-specific data in Data.{CountryName}
      if (dataFields[country]) {
        // Found country-specific section
        const countrySection = dataFields[country];
        
        // Try to find HS code specific data within country section
        const hsCodeVariants = [
          hsCode,
          hsCode.padStart(8, '0'),
          hsCode.substring(0, 6),
          hsCode.substring(0, 4)
        ];
        
        for (const variant of hsCodeVariants) {
          if (countrySection[variant]) {
            countryData = countrySection[variant];
            break;
          }
        }
        
        if (countryData) {
          console.log(`   ✅ Found country-specific data for ${country} under HS ${hsCode}`);
          
          // Extract trade agreement data from nested Data object
          if (countryData.Data && typeof countryData.Data === 'object') {
            countryTradeData = countryData.Data;
          }
          
          // Extract documents from Sbs array
          if (countryData.Sbs && Array.isArray(countryData.Sbs)) {
            countryDocuments = countryData.Sbs;
          }
          
          // Extract export policy
          if (countryData.ExportPolicy && Array.isArray(countryData.ExportPolicy)) {
            exportPolicyArray = countryData.ExportPolicy;
          }
        }
      }
      
      // Build policy info object
      if (countryData) {
        const policyEntry = {
          product_name: record.ProductName || '',
          hs_code: record.HsCode || '',
          mode: record.Mode || '',
          country: country,
          hs_description: countryData.HscodeDescription || '',
          
          // Export policy from array
          export_policy: exportPolicyArray.map(ep => ({
            description: ep.Description,
            policy: ep.Policy || ep.PolicyDescription,
            restriction: ep.Restriction,
            unit: ep.Unit
          })),
          
          // Trade agreements
          trade_agreements: countryTradeData ? {
            apta_tariff: countryTradeData['Asia-Pacific Trade Agreement Tariff'],
            apta_rules: countryTradeData['Asia-Pacific Trade Agreement Rules Of Origin'],
            safta_tariff: countryTradeData['South Asian Free Trade Area Tariff'],
            safta_rules: countryTradeData['South Asian Free Trade Area Rules Of Origin'],
            sapta_tariff: countryTradeData['SAARC Preferential Trading Arrangement Tariff'],
            sapta_rules: countryTradeData['SAARC Preferential Trading Arrangement Rules Of Origin'],
            mfn_tariff: countryTradeData['Most Favoured Nation Tariff']
          } : null,
          
          // Country-specific documents
          documents: countryDocuments.map(doc => ({
            title: doc.Document,
            type: doc.TypeOfDocuement || 'General',
            url: doc.DocumentUrl,
            name: doc.DocumentName
          }))
        };
        
        policyInfo.push(policyEntry);
      }
    });
    
    // Check if we have MEANINGFUL data
    const hasMeaningfulRegulatoryData = regulatoryDetails.length > 0 && 
      regulatoryDetails.some(r => 
        (r.data_sections && r.data_sections.length > 0) || 
        (r.all_measures && r.all_measures.length > 0)
      );
    
    const hasMeaningfulPolicyData = policyInfo.length > 0 && 
      policyInfo.some(p => 
        p.hs_description ||
        (p.export_policy && p.export_policy.length > 0) ||
        p.trade_agreements ||
        (p.documents && p.documents.length > 0)
      );
    
    console.log(`   📋 Regulatory details extracted: ${regulatoryDetails.length}`);
    console.log(`   📋 Policy info extracted: ${policyInfo.length}`);
    console.log(`   ✅ Has meaningful regulatory data: ${hasMeaningfulRegulatoryData}`);
    console.log(`   ✅ Has meaningful policy data: ${hasMeaningfulPolicyData}\n`);
    
    const v2Input = {
      hsCode,
      destinationCountry: country,
      importOrExport: mode || 'Export',
      productNotes: productName,
      exportingCountry: 'India',
      // NEW: Pass actual database data to AI
      databaseData: {
        regulatoryMeasures: regulatoryDetails,
        policyInformation: policyInfo,
        hasData: hasMeaningfulRegulatoryData || hasMeaningfulPolicyData
      }
    };

    // Call v2 service (will call OpenAI API)
    const v2Result = await analyzeCompliance(v2Input);
    
    console.log(`\n📊 ============================================`);
    console.log(`📊 AI PROCESSING COMPLETE`);
    console.log(`📊 Source: ${v2Result.source || 'UNKNOWN'}`);
    console.log(`📊 Success: ${v2Result.success}`);
    console.log(`📊 Confidence: ${v2Result.data?.meta?.confidence || 0}`);
    console.log(`📊 ============================================\n`);

    // Map v2 response to v1 format
    const v1Response = mapV2ToV1(v2Result.data);

    // Extract regulatoryMeasures for caching (preserve existing behavior)
    const regulatoryMeasures =
      macmapData?.slice(0, 5).map((record) => ({
        HsCode: record.HsCode,
        ProductName: record.ProductName,
        ImportingCountry: record.ImportingCountry,
        ExportingCountry: record.ExportingCountry,
        Measures:
          record.Data?.map((d) => ({
            Section: d.MeasureSection,
            Direction: d.MeasureDirection,
            TotalCount: d.MeasureTotalCount
          })) || [],
        AllMeasures:
          record.AllMeasures?.map((m) => ({
            Code: m.Code,
            Title: m.Title,
            Summary: m.Summary,
            LegislationTitle: m.LegislationTitle
          })) || []
      })) || [];

    // Save to database
    const newCache = new AICache({
      hsCode,
      country,
      mode,
      productionInfo: v1Response.productionInfo,
      packagingInfo: v1Response.packagingInfo,
      importantDocuments: v1Response.importantDocuments,
      regulatoryInfo: v1Response.regulatoryInfo,
      macmapMeasures: regulatoryMeasures
    });

    await newCache.save();
    console.log(
      `Saved new AI cache for ${hsCode}_${country}_${mode} with ${v1Response.importantDocuments.length} important docs (v2 service)`
    );

    res.json({
      success: true,
      productionInfo: v1Response.productionInfo,
      packagingInfo: v1Response.packagingInfo,
      importantDocuments: v1Response.importantDocuments,
      regulatoryInfo: v1Response.regulatoryInfo,
      macmapMeasures: regulatoryMeasures,
      fromCache: false,
      source: v2Result.source || 'OPENAI_API',
      aiProcessed: true
    });
  } catch (error) {
    console.error('Error processing AI:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing with AI',
      error: error.message
    });
  }
};

// Helper: Format string array to numbered text for frontend
function formatArrayToText(title, items) {
  if (!Array.isArray(items) || items.length === 0) {
    return `No ${title.toLowerCase()} available.`;
  }

  const lines = items.map((item, i) => `${i + 1}. ${item}`);
  return `${title}:\n\n${lines.join('\n')}`;
}

// Test AI instructions with sample data
exports.testAIInstructions = async (req, res) => {
  try {
    const { hsCode, country, mode, instructions } = req.body;

    // Fetch sample data
    const sampleData = await HSCode.find({ HsCode: hsCode }).limit(1);

    if (!sampleData || sampleData.length === 0) {
      return res.json({
        success: false,
        message: 'No sample data found for this HS Code'
      });
    }

    // Test with simple instructions
    const testPrompt = `Test these AI instructions with sample export data:

HS Code: ${hsCode}
Country: ${country}
Mode: ${mode}

Sample Documents: Bill of Lading, Commercial Invoice, Packing List, Certificate of Origin, Insurance Certificate, Health Certificate, Phytosanitary Certificate, Export License

YOUR INSTRUCTIONS:
${instructions}

Apply your instructions and return the result.`;

    const testCompletion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "You are testing AI instructions. Follow the user's instructions exactly." },
        { role: "user", content: testPrompt }
      ],
      temperature: 0.3,
      max_tokens: 500
    });

    const testResult = testCompletion.choices[0].message.content;

    res.json({
      success: true,
      results: testResult
    });

  } catch (error) {
    console.error('Error testing AI instructions:', error);
    res.status(500).json({
      success: false,
      message: 'Error testing instructions',
      error: error.message
    });
  }
};

// Update AI configuration from frontend
exports.updateAIConfig = async (req, res) => {
  try {
    const { instructions } = req.body;
    
    const fs = require('fs');
    const path = require('path');
    
    // Create new config with simple instructions
    const newConfig = {
      systemPrompts: {
        documentFilter: instructions
      },
      userPrompts: {
        documentFilter: (country, allDocuments, totalCount) => `
From these ${totalCount} documents for exporting to ${country}:
${allDocuments}

APPLY THESE INSTRUCTIONS:
${instructions}

Return ONLY the JSON array, nothing else.`
      },
      modelSettings: {
        documentFilter: {
          model: "gpt-3.5-turbo",
          temperature: 0.3,
          max_tokens: 500
        },
        productionAnalysis: {
          model: "gpt-3.5-turbo",
          temperature: 0.5,
          max_tokens: 1000
        },
        packagingAnalysis: {
          model: "gpt-3.5-turbo",
          temperature: 0.5,
          max_tokens: 800
        }
      },
      analyticsConfig: {
        minDocuments: 5,
        maxDocuments: 8
      }
    };
    
    // Write to config file
    const configPath = path.join(__dirname, '../config/aiPrompts.js');
    const configContent = `// AI Prompt Configuration - Auto-generated from Training Panel
// Last updated: ${new Date().toLocaleString()}

module.exports = ${JSON.stringify(newConfig, null, 2).replace(/"(\w+)":/g, '$1:').replace(/: "function/g, ': function').replace(/}"/g, '}')};
`;
    
    fs.writeFileSync(configPath, configContent);
    
    // Clear require cache to reload config
    delete require.cache[require.resolve('../config/aiPrompts')];
    
    res.json({
      success: true,
      message: 'AI configuration updated successfully'
    });
    
  } catch (error) {
    console.error('Error updating AI config:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating configuration',
      error: error.message
    });
  }
};
