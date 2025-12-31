const OpenAI = require('openai');
const { z } = require('zod');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Zod schema for request validation
const RequestSchema = z.object({
  hsCode: z.string().min(4, 'HS Code must be at least 4 characters'),
  destinationCountry: z.string().min(2, 'Destination country is required'),
  importOrExport: z.enum(['Import', 'Export']),
  productNotes: z.string().optional().default(''),
  modeOfTransport: z.string().optional().default(''),
  exportingCountry: z.string().optional().default(''),
  incoTerms: z.string().optional().default(''),
  shipmentType: z.string().optional().default(''),
  databaseData: z.object({
    regulatoryMeasures: z.array(z.any()).optional(),
    policyInformation: z.array(z.any()).optional(),
    hasData: z.boolean().optional()
  }).optional()
});

// Zod schema for AI response validation
const BlockSchema = z.object({
  heading: z.string(),
  items: z.array(z.string())
});

const ResponseSchema = z.object({
  meta: z.object({
    hsCode: z.string(),
    destinationCountry: z.string(),
    importOrExport: z.enum(['Import', 'Export']),
    confidence: z.number().min(0).max(1),
    warnings: z.array(z.string())
  }),
  sections: z.object({
    production: z.object({
      title: z.string(),
      items: z.array(z.string())
    }),
    packaging: z.object({
      title: z.string(),
      blocks: z.array(BlockSchema)
    }),
    documents: z.object({
      title: z.string(),
      blocks: z.array(BlockSchema)
    })
  }),
  disclaimer: z.string()
});

// Default fallback response with full content (never empty)
function getFallbackResponse(hsCode, destinationCountry, importOrExport, warnings = []) {
  const isEU = ['Germany', 'Belgium', 'France', 'Netherlands', 'Italy', 'Spain', 'Austria', 'Poland', 'Sweden', 'Denmark', 'Finland', 'Portugal', 'Greece', 'Czech Republic', 'Romania', 'Hungary', 'Ireland'].includes(destinationCountry);
  
  return {
    meta: {
      hsCode,
      destinationCountry,
      importOrExport,
      confidence: 0.7,
      warnings: warnings.length > 0 ? warnings : []
    },
    sections: {
      production: {
        title: 'PRODUCTION STAGE — What You Must Ensure (AI Filtered)',
        items: isEU ? [
          'Design product to EU standards (EN / IEC / ISO)',
          'Confirm CE marking applicability (required for most industrial/electrical goods)',
          'Ensure RoHS compliance (no restricted substances: lead, mercury, cadmium, hexavalent chromium, PBB, PBDE)',
          'Check REACH compliance (SVHC disclosure mandatory if concentration >0.1%)',
          'Avoid banned chemicals/materials at raw material sourcing level',
          'Maintain batch/serial number traceability for quality control and recalls',
          'Keep production & test records for minimum 10 years (EU requirement)',
          'Complete product testing before shipment (functional, safety, quality)',
          'Prepare EU Declaration of Conformity (DoC) signed by manufacturer'
        ] : [
          'Design product to international standards (IEC / ISO)',
          'Check applicable certifications for destination market',
          'Ensure product safety compliance with destination country requirements',
          'Avoid banned chemicals/materials at raw material sourcing level',
          'Maintain batch/serial number traceability for quality control',
          'Keep production & test records for 5-10 years',
          'Complete product testing before shipment (functional, safety, quality)',
          'Prepare Certificate of Conformity if required by destination'
        ]
      },
      packaging: {
        title: 'LABELING & PACKAGING — What to Follow During Packing',
        blocks: [
          { 
            heading: 'Product Labelling', 
            items: [
              'Manufacturer name & full registered address',
              'Product model number / identification code',
              'Serial number or batch number for traceability',
              'Country of origin: Made in India',
              isEU ? 'CE marking (if product falls under CE directives)' : 'Applicable certification marks',
              'Electrical ratings (voltage/frequency/power) if electrical product',
              'Safety symbols & warning icons per ISO 7010',
              isEU ? 'WEEE symbol (crossed-out wheeled bin) for electronics' : 'Recycling symbols if applicable'
            ]
          },
          {
            heading: 'Language Rules',
            items: [
              `${destinationCountry === 'Germany' ? 'German' : destinationCountry === 'France' ? 'French' : 'English'} language mandatory for safety warnings`,
              `${destinationCountry === 'Germany' ? 'German' : destinationCountry === 'France' ? 'French' : 'English'} language required for user instructions/manuals`,
              `${destinationCountry === 'Germany' ? 'German' : destinationCountry === 'France' ? 'French' : 'English'} language required for installation manuals (if applicable)`,
              'Multi-language packaging acceptable but must include local language'
            ]
          },
          { 
            heading: 'Packaging Rules', 
            items: [
              'Strong export-grade packaging suitable for sea/air freight',
              'Net & gross weight clearly marked on outer carton (in kg)',
              'Handling marks: Fragile / This Side Up / Keep Dry as applicable (ISO 780)',
              'No banned plastics or restricted packaging materials',
              isEU ? 'Environmental symbols: Green Dot, recycling symbols where required' : 'Recycling symbols where applicable',
              'Dimensions (L x W x H) marked on cartons',
              'Proper cushioning/void fill for fragile items'
            ]
          }
        ]
      },
      documents: {
        title: 'DOCUMENTS REQUIRED — For Smooth Customs Clearance',
        blocks: [
          { 
            heading: 'Commercial Documents', 
            items: [
              `Commercial Invoice (correct HS code ${hsCode}, Incoterms, full itemization, value)`,
              'Packing List (net/gross weights, dimensions, number of packages, content description)',
              'Bill of Lading / Airway Bill (original + 2 non-negotiable copies)',
              'Insurance Certificate (CIF/CIP shipments)',
              'Proforma Invoice (for customs valuation reference)'
            ]
          },
          { 
            heading: 'Compliance Documents', 
            items: isEU ? [
              'EU Declaration of Conformity (DoC) signed by manufacturer',
              'CE certificate / test reports from notified body (if required)',
              'RoHS declaration / test report',
              'REACH declaration / SVHC disclosure',
              'Safety Data Sheet (16-section SDS if chemical content)',
              'Quality inspection certificate (third-party or self-certified)',
              'Fumigation certificate (ISPM-15 if wooden packaging)'
            ] : [
              'Certificate of Conformity / Product certification',
              'Quality inspection certificate',
              'Test reports (safety, performance)',
              'Safety Data Sheet (if chemical content)',
              'Fumigation certificate (ISPM-15 if wooden packaging)'
            ]
          },
          { 
            heading: 'Origin & Import Documents', 
            items: isEU ? [
              'Certificate of Origin (Chamber of Commerce certified)',
              'EUR.1 or Form A for preferential tariff (if trade agreement applicable)',
              'EU Importer name, address, and EORI number (mandatory)',
              'Authorised EU Representative details (required for certain product categories)',
              'Import license (if product requires specific authorization)',
              'Customs declaration forms (Single Administrative Document)'
            ] : [
              'Certificate of Origin (Chamber of Commerce certified)',
              'Preferential origin certificate (if trade agreement applicable)',
              'Importer name, address, and contact details',
              'Import license (if required by destination country)',
              'Customs declaration forms'
            ]
          }
        ]
      }
    },
    disclaimer: `This is automated guidance for HS code ${hsCode} to ${destinationCountry}. Always verify with official customs authorities.`
  };
}

// System prompt for OpenAI - Enhanced for detailed professional output
const SYSTEM_PROMPT = `You are an expert international trade compliance consultant with 20+ years experience.
Generate comprehensive, professionally-formatted trade compliance checklists.

CRITICAL: Return ONLY valid JSON matching the exact schema provided. No markdown, no extra text.

RULES:
1. ALWAYS fill all sections with specific, actionable items (minimum 5 items per section)
2. NEVER return empty arrays - always provide relevant requirements
3. Include technical standards (EN/IEC/ISO), certifications (CE/RoHS/REACH), legal requirements
4. For EU destinations: MUST include CE marking, RoHS, REACH compliance items
5. Each item must be a complete, actionable statement (not generic)

GOOD EXAMPLES:
- "Design product to EU standards (EN / IEC / ISO)"
- "Confirm CE marking applicability for industrial/electrical goods"
- "Ensure RoHS compliance - no lead, mercury, cadmium, hexavalent chromium"
- "Check REACH compliance and SVHC disclosure requirements"
- "Manufacturer name & full registered address on product label"
- "Commercial Invoice with correct HS code, Incoterms, and full itemization"

BAD EXAMPLES (NEVER DO THIS):
- "Ensure compliance" (too vague)
- "Label properly" (not specific)
- Empty arrays []`;

// Build user prompt - with DATABASE DATA analysis
function buildUserPrompt(data) {
  const isEU = ['Germany', 'Belgium', 'France', 'Netherlands', 'Italy', 'Spain', 'Austria', 'Poland', 'Sweden', 'Denmark', 'Finland', 'Portugal', 'Greece', 'Czech Republic', 'Romania', 'Hungary', 'Ireland', 'Slovakia', 'Bulgaria', 'Croatia', 'Slovenia', 'Lithuania', 'Latvia', 'Estonia', 'Luxembourg', 'Malta', 'Cyprus'].includes(data.destinationCountry);
  
  const language = data.destinationCountry === 'Germany' ? 'German' : 
                   data.destinationCountry === 'France' ? 'French' : 
                   data.destinationCountry === 'Belgium' ? 'French/Dutch/German' :
                   data.destinationCountry === 'Netherlands' ? 'Dutch' :
                   data.destinationCountry === 'Italy' ? 'Italian' :
                   data.destinationCountry === 'Spain' ? 'Spanish' : 'English';

  const originCountry = data.exportingCountry || 'India';
  const hsCode = data.hsCode;
  const destCountry = data.destinationCountry;
  const incoTerms = data.incoTerms || 'FOB';
  const transport = data.modeOfTransport || 'sea/air freight';
  
  // Extract database data if available
  const hasDbData = data.databaseData?.hasData;
  const regulatoryMeasures = data.databaseData?.regulatoryMeasures || [];
  const policyInfo = data.databaseData?.policyInformation || [];
  
  let databaseContext = '';
  if (hasDbData) {
    databaseContext = `\n\n=== DATABASE ANALYSIS REQUIRED ===\n\n`;
    
    if (policyInfo.length > 0) {
      databaseContext += `EXPORT/IMPORT POLICY DATA FROM DATABASE:\n`;
      policyInfo.forEach((policy, i) => {
        databaseContext += `\nPolicy ${i+1}:
- HS Code: ${policy.hs_code}
- Product: ${policy.product_name}
- Country: ${policy.country}
- Description: ${policy.hs_description || 'N/A'}\n`;
        
        // Export policy
        if (policy.export_policy && policy.export_policy.length > 0) {
          databaseContext += `\nExport Policy:\n`;
          policy.export_policy.forEach((ep, j) => {
            databaseContext += `  ${j+1}. ${ep.description}
     Policy: ${ep.policy}
     Restriction: ${ep.restriction || 'None'}
     Unit: ${ep.unit}\n`;
          });
        }
        
        // Trade agreements
        if (policy.trade_agreements) {
          databaseContext += `\nTrade Agreements for ${policy.country}:\n`;
          const ta = policy.trade_agreements;
          if (ta.apta_tariff) {
            databaseContext += `  • Asia-Pacific Trade Agreement (APTA):
     Tariff: ${ta.apta_tariff}%
     Rules of Origin: ${typeof ta.apta_rules === 'object' ? 'See agreement' : ta.apta_rules}\n`;
          }
          if (ta.safta_tariff) {
            databaseContext += `  • South Asian Free Trade Area (SAFTA):
     Tariff: ${ta.safta_tariff}%
     Rules of Origin: ${typeof ta.safta_rules === 'object' ? 'See agreement' : ta.safta_rules}\n`;
          }
          if (ta.sapta_tariff) {
            databaseContext += `  • SAARC Preferential Trading Arrangement (SAPTA):
     Tariff: ${ta.sapta_tariff}
     Rules of Origin: ${ta.sapta_rules}\n`;
          }
          if (ta.mfn_tariff) {
            databaseContext += `  • Most Favoured Nation (MFN) Tariff: ${ta.mfn_tariff}%\n`;
          }
        }
        
        // Country-specific documents
        if (policy.documents && policy.documents.length > 0) {
          databaseContext += `\nRequired Documents for ${policy.country}:\n`;
          policy.documents.forEach((doc, j) => {
            databaseContext += `  ${j+1}. ${doc.title}
     Type: ${doc.type}
     Document: ${doc.name || 'See official documentation'}\n`;
          });
        }
      });
    }
    
    if (regulatoryMeasures.length > 0) {
      databaseContext += `\n\nREGULATORY MEASURES FROM DATABASE:\n`;
      regulatoryMeasures.forEach((measure, i) => {
        databaseContext += `\nMeasure Group ${i+1} (${measure.hs_code} → ${measure.importing_country}):
- Product: ${measure.product}
- Measure Sections: ${measure.measure_section || 'N/A'}
- Total Counts: ${measure.measure_count || 'N/A'}\n`;
        
        // Show detailed measures from data_sections
        if (measure.data_sections && measure.data_sections.length > 0) {
          databaseContext += `\nDetailed Measures by Section:\n`;
          measure.data_sections.forEach((section, s) => {
            if (section.measures && section.measures.length > 0) {
              databaseContext += `\n  Section: ${section.section} (${section.count} measures)\n`;
              section.measures.forEach((m, j) => {
                if (m.title) {
                  databaseContext += `    ${j+1}. ${m.title}${m.code ? ` (${m.code})` : ''}
       ${m.summary || 'See requirements'}\n`;
                }
              });
            }
          });
        }
        
        // Show AllMeasures if available
        if (measure.all_measures && measure.all_measures.length > 0) {
          databaseContext += `\nAdditional Requirements:\n`;
          measure.all_measures.forEach((m, j) => {
            if (m.title) {
              databaseContext += `  ${j+1}. ${m.title}${m.code ? ` (Code: ${m.code})` : ''}
     ${m.summary || m.legislation || 'See official documentation'}\n`;
            }
          });
        }
      });
    }
    
    databaseContext += `\n\nIMPORTANT: Analyze the above database records and extract SPECIFIC requirements.
- For documents: List exact certificates/forms mentioned in the data
- For compliance: Extract specific standards, regulations, testing requirements
- For labeling: Mention specific marking/labeling requirements from the data
- If database mentions specific documents (e.g., "EUR.1", "Phytosanitary Certificate"), include them
- If no specific data, use general EU/international requirements as baseline\n\n`;
  }

  // Build production items based on destination
  const productionItems = isEU ? [
    "Design product to EU standards (EN / IEC / ISO)",
    "Confirm CE marking applicability (required for most industrial/electrical goods)",
    "Ensure RoHS compliance (no restricted substances: lead, mercury, cadmium, hexavalent chromium, PBB, PBDE)",
    "Check REACH compliance (SVHC disclosure mandatory if concentration >0.1%)",
    "Avoid banned chemicals/materials at raw material sourcing level",
    "Maintain batch/serial number traceability for quality control and recalls",
    "Keep production & test records for minimum 10 years (EU requirement)",
    "Complete product testing before shipment (functional, safety, quality)",
    "Prepare EU Declaration of Conformity (DoC) signed by manufacturer"
  ] : [
    "Design product to international standards (IEC / ISO)",
    "Check applicable certifications for destination market",
    "Ensure product safety compliance with destination country requirements",
    "Avoid banned chemicals/materials at raw material sourcing level",
    "Maintain batch/serial number traceability for quality control",
    "Keep production & test records for 5-10 years",
    "Complete product testing before shipment (functional, safety, quality)",
    "Prepare Certificate of Conformity if required by destination"
  ];

  // Build labeling items
  const labelItems = [
    "Manufacturer name & full registered address",
    "Product model number / identification code",
    "Serial number or batch number for traceability",
    `Country of origin: Made in ${originCountry}`,
    isEU ? "CE marking (if product falls under CE directives)" : "Applicable certification marks",
    "Electrical ratings (voltage/frequency/power) if electrical product",
    "Safety symbols & warning icons per ISO 7010",
    isEU ? "WEEE symbol (crossed-out wheeled bin) for electronics" : "Recycling symbols if applicable"
  ];

  // Build language items
  const languageItems = [
    `${language} language mandatory for safety warnings`,
    `${language} language required for user instructions/manuals`,
    `${language} language required for installation manuals (if applicable)`,
    "Multi-language packaging acceptable but must include local language"
  ];

  // Build packaging items
  const packagingItems = [
    `Strong export-grade packaging suitable for ${transport}`,
    "Net & gross weight clearly marked on outer carton (in kg)",
    "Handling marks: Fragile / This Side Up / Keep Dry as applicable (ISO 780)",
    "No banned plastics or restricted packaging materials",
    isEU ? "Environmental symbols: Green Dot, recycling symbols where required" : "Recycling symbols where applicable",
    "Dimensions (L x W x H) marked on cartons",
    "Proper cushioning/void fill for fragile items"
  ];

  // Build document items
  const commercialDocs = [
    `Commercial Invoice (correct HS code ${hsCode}, Incoterms ${incoTerms}, full itemization, value)`,
    "Packing List (net/gross weights, dimensions, number of packages, content description)",
    "Bill of Lading / Airway Bill (original + 2 non-negotiable copies)",
    "Insurance Certificate (CIF/CIP shipments)",
    "Proforma Invoice (for customs valuation reference)"
  ];

  const complianceDocs = isEU ? [
    "EU Declaration of Conformity (DoC) signed by manufacturer",
    "CE certificate / test reports from notified body (if required)",
    "RoHS declaration / test report",
    "REACH declaration / SVHC disclosure",
    "Safety Data Sheet (16-section SDS if chemical content)",
    "Quality inspection certificate (third-party or self-certified)",
    "Fumigation certificate (ISPM-15 if wooden packaging)"
  ] : [
    "Certificate of Conformity / Product certification",
    "Quality inspection certificate",
    "Test reports (safety, performance)",
    "Safety Data Sheet (if chemical content)",
    "Fumigation certificate (ISPM-15 if wooden packaging)"
  ];

  const originDocs = isEU ? [
    "Certificate of Origin (Chamber of Commerce certified)",
    "EUR.1 or Form A for preferential tariff (if trade agreement applicable)",
    "EU Importer name, address, and EORI number (mandatory)",
    "Authorised EU Representative details (required for certain product categories)",
    "Import license (if product requires specific authorization)",
    "Customs declaration forms (Single Administrative Document)"
  ] : [
    "Certificate of Origin (Chamber of Commerce certified)",
    "Preferential origin certificate (if trade agreement applicable)",
    "Importer name, address, and contact details",
    "Import license (if required by destination country)",
    "Customs declaration forms"
  ];

  return `Generate export compliance requirements for this shipment:

HS CODE: ${hsCode}
PRODUCT: ${data.productNotes || 'General merchandise'}
TRADE FLOW: ${data.importOrExport} from ${originCountry} to ${destCountry}
TRANSPORT: ${transport}
INCOTERMS: ${incoTerms}
DESTINATION TYPE: ${isEU ? 'EU MARKET (CE/RoHS/REACH mandatory)' : 'NON-EU MARKET'}
${databaseContext}
Generate JSON based on the above database data. Use the template structure below, but CUSTOMIZE the items based on:
1. Specific requirements from the database records above
2. Any certificates, forms, or documents mentioned in the data
3. Compliance standards referenced in regulatory measures
4. Keep EU-specific items (CE/RoHS/REACH) if destination is EU
5. Add any specific documents from database (e.g., Phytosanitary, Veterinary, etc.)

Template structure to follow:

{
  "meta": {
    "hsCode": "${hsCode}",
    "destinationCountry": "${destCountry}",
    "importOrExport": "${data.importOrExport}",
    "confidence": 0.85,
    "warnings": []
  },
  "sections": {
    "production": {
      "title": "PRODUCTION STAGE — What You Must Ensure (AI Filtered)",
      "items": ${JSON.stringify(productionItems)}
    },
    "packaging": {
      "title": "LABELING & PACKAGING — What to Follow During Packing",
      "blocks": [
        {
          "heading": "Product Labelling",
          "items": ${JSON.stringify(labelItems)}
        },
        {
          "heading": "Language Rules",
          "items": ${JSON.stringify(languageItems)}
        },
        {
          "heading": "Packaging Rules",
          "items": ${JSON.stringify(packagingItems)}
        }
      ]
    },
    "documents": {
      "title": "DOCUMENTS REQUIRED — For Smooth Customs Clearance",
      "blocks": [
        {
          "heading": "Commercial Documents",
          "items": ${JSON.stringify(commercialDocs)}
        },
        {
          "heading": "Compliance Documents",
          "items": ${JSON.stringify(complianceDocs)}
        },
        {
          "heading": "Origin & Import Documents",
          "items": ${JSON.stringify(originDocs)}
        }
      ]
    }
  },
  "disclaimer": "This is automated guidance based on HS code ${hsCode} for ${destCountry}. Always verify with official customs authorities and trade compliance experts."
}

IMPORTANT: Return this JSON structure with the items customized for HS code ${hsCode}. You may add/modify items based on specific product requirements, but NEVER return empty arrays.`;
}

// Main analyze function
async function analyzeCompliance(inputData) {
  // Validate request
  const validationResult = RequestSchema.safeParse(inputData);
  if (!validationResult.success) {
    const errors = validationResult.error.errors.map((e) => e.message);
    return {
      success: false,
      error: 'Validation failed',
      details: errors,
      data: getFallbackResponse(
        inputData.hsCode || '',
        inputData.destinationCountry || '',
        inputData.importOrExport || 'Export',
        errors
      )
    };
  }

  const data = validationResult.data;

  try {
    console.log(`\n🤖 ============================================`);
    console.log(`🤖 CALLING OPENAI API`);
    console.log(`🤖 HS Code: ${data.hsCode}`);
    console.log(`🤖 Destination: ${data.destinationCountry}`);
    console.log(`🤖 Mode: ${data.importOrExport}`);
    console.log(`🤖 Database Data: ${data.databaseData?.hasData ? 'YES ✅' : 'NO ❌'}`);
    if (data.databaseData?.hasData) {
      console.log(`🤖   - Policy records: ${data.databaseData.policyInformation?.length || 0}`);
      console.log(`🤖   - Regulatory measures: ${data.databaseData.regulatoryMeasures?.length || 0}`);
    }
    console.log(`🤖 ============================================\n`);

    const startTime = Date.now();
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserPrompt(data) }
      ],
      temperature: 0.3,  // Slightly higher for more detailed output
      max_tokens: 3000   // Increased for comprehensive responses
    });

    const aiResponse = completion.choices[0].message.content;
    const endTime = Date.now();
    
    console.log(`\n✅ ============================================`);
    console.log(`✅ OPENAI API RESPONSE RECEIVED`);
    console.log(`✅ Time taken: ${endTime - startTime}ms`);
    console.log(`✅ Tokens used: ${completion.usage.total_tokens} (prompt: ${completion.usage.prompt_tokens}, completion: ${completion.usage.completion_tokens})`);
    console.log(`✅ Response length: ${aiResponse.length} characters`);
    console.log(`✅ First 200 chars: ${aiResponse.substring(0, 200)}...`);
    console.log(`✅ ============================================\n`);

    // Parse JSON from response
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('No JSON found in AI response');
      return {
        success: true,
        data: getFallbackResponse(data.hsCode, data.destinationCountry, data.importOrExport, [
          'AI response format error'
        ])
      };
    }

    let parsed;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch (e) {
      console.error('JSON parse error:', e.message);
      return {
        success: true,
        data: getFallbackResponse(data.hsCode, data.destinationCountry, data.importOrExport, [
          'AI response parse error'
        ])
      };
    }

    // Validate AI response structure
    const responseValidation = ResponseSchema.safeParse(parsed);
    if (!responseValidation.success) {
      console.error('⚠️  AI response validation failed:', responseValidation.error.errors);
      console.log('⚠️  USING FALLBACK with partial AI data merge');
      // Try to use partial data with fallback
      const fallback = getFallbackResponse(data.hsCode, data.destinationCountry, data.importOrExport);

      // Merge any valid data from parsed response
      if (parsed.sections?.production?.items) {
        fallback.sections.production.items = parsed.sections.production.items;
      }
      if (parsed.sections?.packaging?.blocks) {
        fallback.sections.packaging.blocks = parsed.sections.packaging.blocks;
      }
      if (parsed.sections?.documents?.blocks) {
        fallback.sections.documents.blocks = parsed.sections.documents.blocks;
      }
      if (parsed.meta?.warnings) {
        fallback.meta.warnings = [...fallback.meta.warnings, ...parsed.meta.warnings];
      }
      if (parsed.disclaimer) {
        fallback.disclaimer = parsed.disclaimer;
      }

      return { success: true, data: fallback, source: 'FALLBACK_WITH_PARTIAL_AI' };
    }

    console.log('✅ AI response validation SUCCESS - using pure AI data');
    return { success: true, data: responseValidation.data, source: 'OPENAI_API' };
  } catch (error) {
    console.error('OpenAI API error:', error.message);
    return {
      success: true,
      data: getFallbackResponse(data.hsCode, data.destinationCountry, data.importOrExport, [
        `API error: ${error.message}`
      ])
    };
  }
}

// Map v2 response to v1 format for backward compatibility
function mapV2ToV1(v2Response) {
  const { sections } = v2Response;

  // Format production items as text
  const productionInfo =
    sections.production.items.length > 0
      ? `${sections.production.title}:\n\n${sections.production.items.map((item, i) => `${i + 1}. ${item}`).join('\n')}`
      : 'No production requirements available.';

  // Flatten packaging blocks into text
  const packagingParts = sections.packaging.blocks
    .filter((block) => block.items.length > 0)
    .map((block) => `${block.heading}:\n${block.items.map((item) => `• ${item}`).join('\n')}`);
  const packagingInfo =
    packagingParts.length > 0
      ? `${sections.packaging.title}:\n\n${packagingParts.join('\n\n')}`
      : 'No packaging requirements available.';

  // Flatten document blocks into array
  const importantDocuments = sections.documents.blocks.flatMap((block) => block.items);

  // No separate regulatory info in v2
  const regulatoryInfo = null;

  return {
    productionInfo,
    packagingInfo,
    importantDocuments,
    regulatoryInfo
  };
}

module.exports = {
  analyzeCompliance,
  mapV2ToV1,
  RequestSchema,
  ResponseSchema,
  getFallbackResponse
};
