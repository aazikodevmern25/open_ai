const HSCode = require('../models/HSCode');
const AICache = require('../models/AICache');
const OpenAI = require('openai');
const aiPrompts = require('../config/aiPrompts');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Search HS Code in database
exports.searchHSCode = async (req, res) => {
  try {
    const { hsCode } = req.params;
    const { country, mode } = req.query; // Get country and mode from query parameters
    
    // Build search query
    const searchQuery = {
      $or: [
        { HsCode: hsCode },
        { HsCodeSearched: hsCode }
      ]
    };

    // Add Mode filter if specified (Import or Export)
    if (mode) {
      searchQuery.Mode = mode;
    } else {
      // Default to Export if not specified
      searchQuery.Mode = 'Export';
    }
    
    // Search for records with matching HS Code and Mode
    const records = await HSCode.find(searchQuery).limit(10);

    if (records.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No export records found for this HS Code'
      });
    }

    // Filter by country if specified
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

      if (filteredData.length === 0) {
        return res.status(404).json({
          success: false,
          message: `No data found for country: ${country}`
        });
      }
    }

    res.json({
      success: true,
      count: filteredData.length,
      country: country || 'All',
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

// Process with AI and save to database
exports.processAndSaveAI = async (req, res) => {
  try {
    const { hsCode, country, mode, data } = req.body;
    
    if (!hsCode || !country || !mode || !data) {
      return res.status(400).json({
        success: false,
        message: 'hsCode, country, mode, and data are required'
      });
    }

    // Check if already cached
    const existingCache = await AICache.findOne({ hsCode, country, mode });
    if (existingCache) {
      console.log(`Returning existing cache for ${hsCode}_${country}_${mode}`);
      return res.json({
        success: true,
        productionInfo: existingCache.productionInfo,
        packagingInfo: existingCache.packagingInfo,
        importantDocuments: existingCache.importantDocuments || [],
        fromCache: true
      });
    }

    // Extract summary from data
    const summarizedData = data.slice(0, 3).map(record => {
      const dataContent = record.Data || {};
      const countryKeys = Object.keys(dataContent);
      const firstCountryData = countryKeys.length > 0 ? dataContent[countryKeys[0]] : {};
      const hsCodeKeys = Object.keys(firstCountryData);
      const actualData = hsCodeKeys.length > 0 ? firstCountryData[hsCodeKeys[0]] : {};
      
      const gstRates = actualData.Gst?.Details ? 
        actualData.Gst.Details.map(g => `${g.GstRate} (${g.GstDescription})`).join('; ') : 'Not available';
      
      const documentCount = actualData.Sbs ? actualData.Sbs.length : 0;
      const allDocuments = actualData.Sbs ? 
        actualData.Sbs.map(d => d.Document).join('; ') : 'Not available';
      
      const exportPolicyText = actualData.ExportPolicy?.[0] ? 
        `${actualData.ExportPolicy[0].Policy} - ${actualData.ExportPolicy[0].PolicyDescription}` : 'Not available';
      
      return {
        HsCode: record.HsCode || record.HsCodeSearched,
        Mode: record.Mode,
        Country: record.FilteredCountry || record.Country,
        ProductName: record.ProductName,
        ExportPolicy: exportPolicyText,
        GstRates: gstRates,
        DocumentsCount: documentCount,
        AllDocuments: allDocuments,
      };
    });

    const dataSummary = `
HS Code: ${hsCode}
Country: ${country}
Mode: ${mode}
Product: ${summarizedData[0]?.ProductName || 'Not specified'}

Export Policy: ${summarizedData[0]?.ExportPolicy || 'Not available'}
GST Rates: ${summarizedData[0]?.GstRates || 'Not available'}
Documents (${summarizedData[0]?.DocumentsCount || 0}): ${summarizedData[0]?.AllDocuments || 'None'}
`;

    // Generate Production Info with simple prompt
    const productionCompletion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are an export compliance expert. Provide production stage requirements."
        },
        {
          role: "user",
          content: `For exporting HS Code ${hsCode} to ${country} (${mode}):\n\n${dataSummary}\n\nProvide key production requirements and compliance points.`
        }
      ],
      temperature: 0.5,
      max_tokens: 1000
    });

    const productionInfo = productionCompletion.choices[0].message.content;

    // Generate Packaging Info with simple prompt
    const packagingCompletion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a packaging expert. Provide packaging and labeling requirements."
        },
        {
          role: "user",
          content: `For exporting ${summarizedData[0]?.ProductName || 'product'} (HS ${hsCode}) to ${country}:\n\nProvide essential packaging and labeling requirements.`
        }
      ],
      temperature: 0.5,
      max_tokens: 800
    });

    const packagingInfo = packagingCompletion.choices[0].message.content;

    // Generate filtered important documents list using admin instructions
    const adminInstructions = aiPrompts.systemPrompts.documentFilter || 'Select 5-8 critical export documents.';
    const docsCompletion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: adminInstructions
        },
        {
          role: "user",
          content: `From these ${summarizedData[0]?.DocumentsCount || 0} documents for exporting to ${country}:\n${summarizedData[0]?.AllDocuments || 'No documents'}\n\nApply the instructions and return ONLY a JSON array.`
        }
      ],
      temperature: 0.3,
      max_tokens: 500
    });

    let importantDocuments = [];
    try {
      const docsResponse = docsCompletion.choices[0].message.content;
      // Try to parse JSON array from response
      const jsonMatch = docsResponse.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        importantDocuments = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.log('Could not parse documents JSON, using empty array');
    }

    // Save to database
    const newCache = new AICache({
      hsCode,
      country,
      mode,
      productionInfo,
      packagingInfo,
      importantDocuments: importantDocuments
    });

    await newCache.save();
    console.log(`Saved new AI cache for ${hsCode}_${country}_${mode} with ${importantDocuments.length} important docs`);

    res.json({
      success: true,
      productionInfo,
      packagingInfo,
      importantDocuments,
      fromCache: false
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
