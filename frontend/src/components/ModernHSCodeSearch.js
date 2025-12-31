import React, { useState, useEffect, useRef } from 'react';
import api from '../config/api';
import { Search, FileText, Package, AlertCircle, ChevronDown, Info, Loader } from 'lucide-react';
import './ModernHSCodeSearch.css';

const ModernHSCodeSearch = () => {
  const [formData, setFormData] = useState({
    hsCode: '',
    productNotes: '',
    modeOfTransport: '',
    importExport: 'Export',
    destinationCountry: '',
    exportingCountry: '',
    incoTerms: '',
    shipmentType: ''
  });

  const [showHsDropdown, setShowHsDropdown] = useState(false);
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [hsSearchTerm, setHsSearchTerm] = useState('');
  const [countrySearchTerm, setCountrySearchTerm] = useState('');

  const hsCodes = ['482290', '482110', '482190', '481840', '482010'];
  const countries = ['Belgium', 'Bangladesh', 'USA', 'UK', 'Germany', 'France', 'China', 'Japan', 'India'];

  const filteredHsCodes = hsCodes.filter(code => 
    code.toLowerCase().includes(hsSearchTerm.toLowerCase())
  );

  const filteredCountries = countries.filter(country => 
    country.toLowerCase().includes(countrySearchTerm.toLowerCase())
  );

  const hsDropdownRef = useRef(null);
  const countryDropdownRef = useRef(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (hsDropdownRef.current && !hsDropdownRef.current.contains(event.target)) {
        setShowHsDropdown(false);
      }
      if (countryDropdownRef.current && !countryDropdownRef.current.contains(event.target)) {
        setShowCountryDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [searchResults, setSearchResults] = useState(null);
  const [macmapResults, setMacmapResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('documents');
  const [expandedSections, setExpandedSections] = useState({
    production: true,
    labeling: false,
    documents: false,
    regulatory: false
  });
  const [aiPackagingInfo, setAiPackagingInfo] = useState(null);
  const [packagingLoading, setPackagingLoading] = useState(false);
  const [aiProductionInfo, setAiProductionInfo] = useState(null);
  const [productionLoading, setProductionLoading] = useState(false);
  const [aiCache, setAiCache] = useState({});
  const [filteredDocuments, setFilteredDocuments] = useState([]);
  const [aiDocumentsInfo, setAiDocumentsInfo] = useState(null);
  const [aiFilteredDocs, setAiFilteredDocs] = useState([]);
  const [aiRegulatoryInfo, setAiRegulatoryInfo] = useState(null);
  // V2 Compliance state
  const [complianceData, setComplianceData] = useState(null);
  const [complianceLoading, setComplianceLoading] = useState(false);
  const [totalComplianceItems, setTotalComplianceItems] = useState(0);

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    
    if (!formData.hsCode.trim()) {
      setError('Please enter an HS Code');
      return;
    }

    setLoading(true);
    setError('');
    setSearchResults(null);
    setMacmapResults(null);
    setComplianceData(null);

    try {
      // Build query parameters
      const params = new URLSearchParams();
      if (formData.destinationCountry.trim()) {
        params.append('country', formData.destinationCountry.trim());
      }
      if (formData.importExport) {
        params.append('mode', formData.importExport);
      }
      
      const queryString = params.toString();
      const url = queryString 
        ? `/api/hscode/search/${formData.hsCode}?${queryString}`
        : `/api/hscode/search/${formData.hsCode}`;
      
      const response = await api.get(url);
      
      // Set Indian Trade Portal data
      setSearchResults(response.data);
      
      // Set Macmap Regulatory data (from combined response)
      if (response.data.macmapRegulatory) {
        setMacmapResults(response.data.macmapRegulatory);
        console.log('Macmap Regulatory data:', response.data.macmapRegulatory.count, 'records');
      }
      
      // Reset AI info for new search
      setAiPackagingInfo(null);
      setAiProductionInfo(null);
      setAiRegulatoryInfo(null);
      
      // Call v2 compliance API
      fetchComplianceData();
    } catch (err) {
      setError(err.response?.data?.message || 'Error searching HS Code');
    } finally {
      setLoading(false);
    }
  };

  // V2 Compliance API call
  const fetchComplianceData = async () => {
    if (!formData.hsCode || !formData.destinationCountry) {
      console.log('Missing required fields for compliance analysis');
      return;
    }

    setComplianceLoading(true);
    try {
      const response = await api.post('/api/compliance/analyze', {
        hsCode: formData.hsCode,
        destinationCountry: formData.destinationCountry,
        importOrExport: formData.importExport || 'Export',
        productNotes: formData.productNotes,
        modeOfTransport: formData.modeOfTransport,
        exportingCountry: formData.exportingCountry,
        incoTerms: formData.incoTerms,
        shipmentType: formData.shipmentType
      });

      if (response.data.success) {
        setComplianceData(response.data);
        setTotalComplianceItems(response.data.totalItems || 0);
        
        // Also set legacy state for backward compatibility
        const sections = response.data.sections;
        if (sections?.production?.items) {
          setAiProductionInfo(sections.production.items.map((item, i) => `${i + 1}. ${item}`).join('\n'));
        }
        if (sections?.packaging?.blocks) {
          const packagingText = sections.packaging.blocks
            .map(block => `${block.heading}:\n${block.items.map(item => `• ${item}`).join('\n')}`)
            .join('\n\n');
          setAiPackagingInfo(packagingText);
        }
        if (sections?.documents?.blocks) {
          const docs = sections.documents.blocks.flatMap(block => block.items);
          setAiFilteredDocs(docs);
        }
        
        console.log('V2 Compliance data loaded:', response.data.totalItems, 'items');
      }
    } catch (err) {
      console.error('Error fetching compliance data:', err);
      // Fallback to v1 API
      generateProductionInfo(
        searchResults?.data,
        formData.hsCode,
        formData.destinationCountry,
        formData.importExport,
        macmapResults?.data || []
      );
    } finally {
      setComplianceLoading(false);
    }
  };

  const generateProductionInfo = async (dataArray, hsCode, country, mode, macmapDataArray) => {
    if (productionLoading || !dataArray) return;
    
    const cacheKey = `${hsCode}_${country}_${mode}`;
    
    // Check frontend cache first
    if (aiCache[cacheKey]) {
      console.log('Using frontend cached production info');
      setAiProductionInfo(aiCache[cacheKey]);
      return;
    }
    
    setProductionLoading(true);
    try {
      // First check if AI result exists in database
      const checkResponse = await api.get(`/api/hscode/ai-cache/${hsCode}/${country}/${mode}`);
      if (checkResponse.data.success && checkResponse.data.cachedResult) {
        console.log('Using DATABASE cached AI result');
        setAiProductionInfo(checkResponse.data.cachedResult.productionInfo);
        setAiPackagingInfo(checkResponse.data.cachedResult.packagingInfo);
        setAiDocumentsInfo(checkResponse.data.cachedResult.productionInfo);
        setAiFilteredDocs(checkResponse.data.cachedResult.importantDocuments || []);
        setAiRegulatoryInfo(checkResponse.data.cachedResult.regulatoryInfo || null);
        setAiCache(prev => ({ ...prev, [cacheKey]: checkResponse.data.cachedResult.productionInfo }));
        setProductionLoading(false);
        return;
      }
    } catch (err) {
      console.log('No cached result in database, will generate new');
    }
    
    try {
      // Generate new AI result - include macmap data
      const response = await api.post('/api/hscode/process-ai', {
        hsCode: hsCode,
        country: country,
        mode: mode,
        data: dataArray,
        macmapData: macmapDataArray  // Send macmap regulatory data
      });
      
      if (response.data.success) {
        setAiProductionInfo(response.data.productionInfo);
        setAiPackagingInfo(response.data.packagingInfo);
        setAiDocumentsInfo(response.data.productionInfo);
        setAiFilteredDocs(response.data.importantDocuments || []);
        setAiRegulatoryInfo(response.data.regulatoryInfo || null);
        setAiCache(prev => ({ ...prev, [cacheKey]: response.data.productionInfo }));
        console.log('AI processed and saved to database with', response.data.importantDocuments?.length || 0, 'important docs and regulatory info');
      }
    } catch (err) {
      console.error('Error generating production info:', err);
      setAiProductionInfo(null);
    } finally {
      setProductionLoading(false);
    }
  };

  const generatePackagingInfo = async () => {
    if (!searchResults || packagingLoading) return;
    
    // Check cache first
    const cacheKey = `packaging_${formData.hsCode}_${formData.destinationCountry}_${formData.importExport}`;
    if (aiCache[cacheKey]) {
      console.log('Using cached packaging info');
      setAiPackagingInfo(aiCache[cacheKey]);
      return;
    }
    
    if (aiPackagingInfo) return; // Already have it
    
    setPackagingLoading(true);
    try {
      const response = await api.post('/api/hscode/ask', {
        prompt: 'Based on this export data, provide ONLY the most important labeling and packaging requirements. Format as bullet points. Include: 1) Essential label requirements 2) Critical packaging rules 3) Required marks/symbols. Keep it concise and focused on what exporters MUST do.',
        data: searchResults.data
      });
      const aiResult = response.data.answer;
      setAiPackagingInfo(aiResult);
      
      // Save to cache
      setAiCache(prev => ({ ...prev, [cacheKey]: aiResult }));
      console.log('Saved to cache:', cacheKey);
    } catch (err) {
      console.error('Error generating packaging info:', err);
      setAiPackagingInfo('Unable to generate packaging information');
    } finally {
      setPackagingLoading(false);
    }
  };

  const extractDocuments = () => {
    if (!searchResults?.data?.[0]?.Data) return [];
    
    const record = searchResults.data[0];
    const dataContent = record.Data || {};
    const countryKeys = Object.keys(dataContent);
    const firstCountryData = countryKeys.length > 0 ? dataContent[countryKeys[0]] : {};
    const hsCodeKeys = Object.keys(firstCountryData);
    const actualData = hsCodeKeys.length > 0 ? firstCountryData[hsCodeKeys[0]] : {};
    
    return actualData.Sbs || [];
  };

  const extractGST = () => {
    if (!searchResults?.data?.[0]?.Data) return [];
    
    const record = searchResults.data[0];
    const dataContent = record.Data || {};
    const countryKeys = Object.keys(dataContent);
    const firstCountryData = countryKeys.length > 0 ? dataContent[countryKeys[0]] : {};
    const hsCodeKeys = Object.keys(firstCountryData);
    const actualData = hsCodeKeys.length > 0 ? firstCountryData[hsCodeKeys[0]] : {};
    
    return actualData.Gst?.Details || [];
  };

  const extractExportPolicy = () => {
    if (!searchResults?.data?.[0]?.Data) return null;
    
    const record = searchResults.data[0];
    const dataContent = record.Data || {};
    const countryKeys = Object.keys(dataContent);
    const firstCountryData = countryKeys.length > 0 ? dataContent[countryKeys[0]] : {};
    const hsCodeKeys = Object.keys(firstCountryData);
    const actualData = hsCodeKeys.length > 0 ? firstCountryData[hsCodeKeys[0]] : {};
    
    return actualData.ExportPolicy?.[0] || null;
  };

  const documents = extractDocuments();
  const gstDetails = extractGST();
  const exportPolicy = extractExportPolicy();

  return (
    <div className="modern-container">
      <div className="modern-header">
        <div className="header-brand">
          <img src="/aaziko-logo.png" alt="Aaziko" className="header-logo" />
          <div className="header-text">
            <h1>Aaziko Trade Map</h1>
            <p>Simple Global Trade Analytics</p>
          </div>
        </div>
      </div>
      
      <div className="welcome-section">
        <h2>Welcome to Global Trade Analytics</h2>
        <p>Discover trade opportunities, analyze market trends, and make informed decisions with our comprehensive trade data platform.</p>
      </div>

      <form onSubmit={handleSearch} className="modern-form">
        <div className="form-row">
          <div className="form-field searchable-dropdown" ref={hsDropdownRef}>
            <label>*HS Code</label>
            <input
              type="text"
              name="hsCode"
              value={formData.hsCode || hsSearchTerm}
              onChange={(e) => {
                setHsSearchTerm(e.target.value);
                setFormData({...formData, hsCode: e.target.value});
                setShowHsDropdown(true);
              }}
              onFocus={() => setShowHsDropdown(true)}
              placeholder="HS Code"
              className="form-input"
            />
            {showHsDropdown && filteredHsCodes.length > 0 && (
              <div className="dropdown-list">
                {filteredHsCodes.map((code) => (
                  <div
                    key={code}
                    className="dropdown-item"
                    onClick={() => {
                      setFormData({...formData, hsCode: code});
                      setHsSearchTerm(code);
                      setShowHsDropdown(false);
                    }}
                  >
                    {code}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="form-field">
            <label>*Product Notes</label>
            <input
              type="text"
              name="productNotes"
              value={formData.productNotes}
              onChange={handleInputChange}
              placeholder="Please Enter Product Details..."
              className="form-input"
            />
          </div>

          <div className="form-field">
            <label>*Made Of Transport</label>
            <select 
              name="modeOfTransport" 
              value={formData.modeOfTransport} 
              onChange={handleInputChange}
              className="form-select"
            >
              <option value="">HS Code</option>
              <option value="Sea">Sea</option>
              <option value="Air">Air</option>
              <option value="Road">Road</option>
            </select>
          </div>

          <div className="form-field">
            <label>*Import or Export</label>
            <select 
              name="importExport" 
              value={formData.importExport} 
              onChange={handleInputChange}
              className="form-select"
            >
              <option value="Import">Import</option>
              <option value="Export">Export</option>
            </select>
          </div>

          <div className="form-field searchable-dropdown" ref={countryDropdownRef}>
            <label>*Destination Country</label>
            <input
              type="text"
              name="destinationCountry"
              value={formData.destinationCountry || countrySearchTerm}
              onChange={(e) => {
                setCountrySearchTerm(e.target.value);
                setFormData({...formData, destinationCountry: e.target.value});
                setShowCountryDropdown(true);
              }}
              onFocus={() => setShowCountryDropdown(true)}
              placeholder="Destination Country"
              className="form-input"
            />
            {showCountryDropdown && filteredCountries.length > 0 && (
              <div className="dropdown-list">
                {filteredCountries.map((country) => (
                  <div
                    key={country}
                    className="dropdown-item"
                    onClick={() => {
                      setFormData({...formData, destinationCountry: country});
                      setCountrySearchTerm(country);
                      setShowCountryDropdown(false);
                    }}
                  >
                    {country}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="form-field">
            <label>*Exporting Country</label>
            <select 
              name="exportingCountry" 
              value={formData.exportingCountry} 
              onChange={handleInputChange}
              className="form-select"
            >
              <option value="">Select Country</option>
              <option value="India">India</option>
              <option value="China">China</option>
              <option value="USA">USA</option>
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-field">
            <label>*Inco Terms ( FOB )</label>
            <select 
              name="incoTerms" 
              value={formData.incoTerms} 
              onChange={handleInputChange}
              className="form-select"
            >
              <option value="">HS Code</option>
              <option value="FOB">FOB</option>
              <option value="CIF">CIF</option>
              <option value="CFR">CFR</option>
            </select>
          </div>

          <div className="form-field">
            <label>*Shipment Type</label>
            <select 
              name="shipmentType" 
              value={formData.shipmentType} 
              onChange={handleInputChange}
              className="form-select"
            >
              <option value=""></option>
              <option value="FCL">FCL</option>
              <option value="LCL">LCL</option>
            </select>
          </div>

          <div className="form-field search-button-container">
            <button type="submit" className="search-button" disabled={loading}>
              <Search size={18} />
              {loading ? 'Searching...' : 'Search'}
            </button>
          </div>
        </div>
      </form>

      {error && (
        <div className="error-message">
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      {searchResults && (
        <div className="results-container">
          <div className="tab-buttons">
            <button 
              className={activeTab === 'production' ? 'tab-button-active' : 'tab-button'}
              onClick={() => setActiveTab('production')}
            >
              <AlertCircle size={18} />
              Things Need To Take Care While Production
            </button>
            <button 
              className={activeTab === 'packaging' ? 'tab-button-active' : 'tab-button'}
              onClick={() => {
                setActiveTab('packaging');
                generatePackagingInfo();
              }}
            >
              <Package size={18} />
              Packaging Type
            </button>
            <button 
              className={activeTab === 'documents' ? 'tab-button-active' : 'tab-button'}
              onClick={() => setActiveTab('documents')}
            >
              <FileText size={18} />
              Document Requirement
            </button>
            <button 
              className={activeTab === 'regulatory' ? 'tab-button-active' : 'tab-button'}
              onClick={() => setActiveTab('regulatory')}
            >
              <AlertCircle size={18} />
              Regulatory Requirements ({macmapResults?.count || 0})
            </button>
          </div>

          <div className="tab-content">
            {activeTab === 'documents' && (
              <div className="documents-content">
                {complianceLoading ? (
                  <div className="loading-message">
                    <Loader size={24} className="spinner" />
                    <p>AI is filtering important documents...</p>
                  </div>
                ) : complianceData?.sections?.documents ? (
                  <div className="ai-documents-section">
                    <p className="filtered-docs-note">
                      ✓ AI filtered documents for smooth customs clearance
                    </p>
                    {complianceData.sections.documents.blocks.map((block, blockIndex) => (
                      <div key={blockIndex} className="compliance-block">
                        <h4>{block.heading}</h4>
                        {block.items.length > 0 ? (
                          <div className="documents-grid">
                            {block.items.map((doc, index) => (
                              <div key={index} className="document-item">
                                <FileText size={20} className="doc-icon" />
                                <span className="doc-name">{doc}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="no-data">No specific documents in this category.</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : aiFilteredDocs.length > 0 ? (
                  <div className="ai-documents-grid-section">
                    <p className="filtered-docs-note">
                      ✓ AI filtered {aiFilteredDocs.length} most important documents from {documents.length} total
                    </p>
                    <div className="documents-grid">
                      {aiFilteredDocs.map((doc, index) => {
                        // Handle both string and object formats
                        const docName = typeof doc === 'string' ? doc : (doc['Doc Name'] || doc.name || JSON.stringify(doc));
                        const docCode = typeof doc === 'object' ? doc['Doc Code'] : null;
                        const whyRequired = typeof doc === 'object' ? doc['Why required'] : null;
                        const condition = typeof doc === 'object' ? doc['Condition'] : null;
                        
                        return (
                          <div key={index} className="document-item" title={whyRequired || docName}>
                            <FileText size={20} className="doc-icon" />
                            <div className="doc-details">
                              {docCode && <span className="doc-code">{docCode}</span>}
                              <span className="doc-name">{docName}</span>
                              {condition && <span className="doc-condition">{condition}</span>}
                            </div>
                            {whyRequired && <Info size={18} className="info-icon" title={whyRequired} />}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : documents.length > 0 ? (
                  <div className="ai-documents-grid-section">
                    <p className="filtered-docs-note">
                      Showing all {documents.length} documents (AI filtering in progress...)
                    </p>
                    <div className="documents-grid">
                      {documents.slice(0, 8).map((doc, index) => (
                        <div key={index} className="document-item">
                          <FileText size={20} className="doc-icon" />
                          <span className="doc-name">{doc.Document}</span>
                          <Info size={18} className="info-icon" />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="no-data">No documents found for this HS Code and Country</p>
                )}
              </div>
            )}

            {activeTab === 'production' && (
              <div className="production-content">
                {/* V2 Info Bar */}
                {complianceData && totalComplianceItems > 0 && (
                  <p className="filtered-docs-note">
                    ✓ AI filtered {totalComplianceItems} most important compliance points
                  </p>
                )}

                {/* Loading State */}
                {complianceLoading && (
                  <div className="loading-message">
                    <Loader size={24} className="spinner" />
                    <p>AI is analyzing compliance requirements...</p>
                  </div>
                )}

                {/* V2 Production Section */}
                {!complianceLoading && complianceData?.sections?.production && (
                  <div className="expandable-section">
                    <button 
                      className="section-header"
                      onClick={() => setExpandedSections({...expandedSections, production: !expandedSections.production})}
                    >
                      <Package size={20} />
                      <span>{complianceData.sections.production.title}</span>
                      <ChevronDown size={20} className={expandedSections.production ? 'rotated' : ''} />
                    </button>
                    {expandedSections.production && (
                      <div className="section-content">
                        {complianceData.sections.production.items.length > 0 ? (
                          <ul className="requirements-list">
                            {complianceData.sections.production.items.map((item, index) => (
                              <li key={index}>{item}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="no-data">No specific production requirements identified.</p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* V2 Packaging Section */}
                {!complianceLoading && complianceData?.sections?.packaging && (
                  <div className="expandable-section">
                    <button 
                      className="section-header collapsed"
                      onClick={() => setExpandedSections({...expandedSections, labeling: !expandedSections.labeling})}
                    >
                      <Package size={20} />
                      <span>{complianceData.sections.packaging.title}</span>
                      <ChevronDown size={20} className={expandedSections.labeling ? 'rotated' : ''} />
                    </button>
                    {expandedSections.labeling && (
                      <div className="section-content">
                        {complianceData.sections.packaging.blocks.map((block, blockIndex) => (
                          <div key={blockIndex} className="compliance-block">
                            <h4>{block.heading}</h4>
                            {block.items.length > 0 ? (
                              <ul className="requirements-list">
                                {block.items.map((item, itemIndex) => (
                                  <li key={itemIndex}>{item}</li>
                                ))}
                              </ul>
                            ) : (
                              <p className="no-data">No specific requirements.</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* V2 Documents Section */}
                {!complianceLoading && complianceData?.sections?.documents && (
                  <div className="expandable-section">
                    <button 
                      className="section-header collapsed"
                      onClick={() => setExpandedSections({...expandedSections, documents: !expandedSections.documents})}
                    >
                      <FileText size={20} />
                      <span>{complianceData.sections.documents.title}</span>
                      <ChevronDown size={20} className={expandedSections.documents ? 'rotated' : ''} />
                    </button>
                    {expandedSections.documents && (
                      <div className="section-content">
                        {complianceData.sections.documents.blocks.map((block, blockIndex) => (
                          <div key={blockIndex} className="compliance-block">
                            <h4>{block.heading}</h4>
                            {block.items.length > 0 ? (
                              <ul className="requirements-list">
                                {block.items.map((item, itemIndex) => (
                                  <li key={itemIndex}>{item}</li>
                                ))}
                              </ul>
                            ) : (
                              <p className="no-data">No specific documents required.</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Warnings */}
                {complianceData?.meta?.warnings?.length > 0 && (
                  <div className="compliance-warnings">
                    <h4><AlertCircle size={16} /> Warnings</h4>
                    <ul>
                      {complianceData.meta.warnings.map((warning, index) => (
                        <li key={index}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Disclaimer */}
                {complianceData?.disclaimer && (
                  <p className="note" style={{marginTop: '15px', fontStyle: 'italic'}}>
                    {complianceData.disclaimer}
                  </p>
                )}

                {/* Fallback to legacy display if no v2 data */}
                {!complianceLoading && !complianceData && aiProductionInfo && (
                  <div className="expandable-section">
                    <button 
                      className="section-header"
                      onClick={() => setExpandedSections({...expandedSections, production: !expandedSections.production})}
                    >
                      <Package size={20} />
                      <span>1. PRODUCTION STAGE – What You Must Ensure (AI Filtered)</span>
                      <ChevronDown size={20} className={expandedSections.production ? 'rotated' : ''} />
                    </button>
                    {expandedSections.production && (
                      <div className="section-content">
                        <div className="ai-content">
                          <div className="ai-response" dangerouslySetInnerHTML={{ __html: aiProductionInfo.replace(/\n/g, '<br/>') }} />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'packaging' && (
              <div className="packaging-content">
                {/* V2 Info Bar */}
                {complianceData?.sections?.packaging && (
                  <p className="filtered-docs-note">
                    ✓ AI filtered packaging and labeling requirements
                  </p>
                )}

                {complianceLoading ? (
                  <div className="loading-message">
                    <Loader size={24} className="spinner" />
                    <p>AI is analyzing packaging requirements...</p>
                  </div>
                ) : complianceData?.sections?.packaging ? (
                  <div className="packaging-blocks">
                    {complianceData.sections.packaging.blocks.map((block, blockIndex) => (
                      <div key={blockIndex} className="compliance-block">
                        <h4>{block.heading}</h4>
                        {block.items.length > 0 ? (
                          <ul className="requirements-list">
                            {block.items.map((item, itemIndex) => (
                              <li key={itemIndex}>{item}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="no-data">No specific requirements.</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : aiPackagingInfo ? (
                  <div className="ai-content">
                    <div className="ai-response" dangerouslySetInnerHTML={{ __html: aiPackagingInfo.replace(/\n/g, '<br/>') }} />
                  </div>
                ) : (
                  <p className="no-data">No packaging requirements available.</p>
                )}
              </div>
            )}

            {activeTab === 'regulatory' && (
              <div className="regulatory-content">
                <h3>Regulatory Requirements from Macmap</h3>
                <p className="data-source-info">
                  Data Source: macmap_regulatory collection | 
                  Destination Country (ImportingCountry): <strong>{formData.destinationCountry || 'All'}</strong> | 
                  Records Found: <strong>{macmapResults?.count || 0}</strong>
                </p>

                {/* AI-Processed Regulatory Summary */}
                {aiRegulatoryInfo && (
                  <div className="ai-regulatory-summary">
                    <h4>🤖 AI Analysis of Regulatory Requirements</h4>
                    <div className="ai-content">
                      <div className="ai-response" dangerouslySetInnerHTML={{ __html: aiRegulatoryInfo.replace(/\n/g, '<br/>') }} />
                    </div>
                  </div>
                )}
                
                {macmapResults && macmapResults.data && macmapResults.data.length > 0 ? (
                  <div className="regulatory-list">
                    <h4>📋 Raw Regulatory Data ({macmapResults.count} records)</h4>
                    {macmapResults.data.map((record, index) => (
                      <div key={index} className="regulatory-item">
                        <div className="regulatory-header">
                          <h4>HS Code: {record.HsCode}</h4>
                          <span className="country-badge">
                            {record.ExportingCountry} → {record.ImportingCountry}
                          </span>
                        </div>
                        <p className="product-name">{record.ProductName}</p>
                        
                        {/* Measures Summary */}
                        {record.Data && record.Data.length > 0 && (
                          <div className="measures-section">
                            <h5>Measures:</h5>
                            {record.Data.map((dataItem, dataIndex) => (
                              <div key={dataIndex} className="measure-item">
                                <p><strong>Section:</strong> {dataItem.MeasureSection}</p>
                                <p><strong>Direction:</strong> {dataItem.MeasureDirection}</p>
                                <p><strong>Total Count:</strong> {dataItem.MeasureTotalCount}</p>
                                <p><strong>HS Revision:</strong> {dataItem.HsRevision}</p>
                                <p><strong>Data Source:</strong> {dataItem.DataSource}</p>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {/* All Measures Details */}
                        {record.AllMeasures && record.AllMeasures.length > 0 && (
                          <div className="all-measures-section">
                            <h5>All Measures Details ({record.AllMeasures.length}):</h5>
                            <div className="measures-grid">
                              {record.AllMeasures.slice(0, 5).map((measure, mIndex) => (
                                <div key={mIndex} className="measure-card">
                                  <p className="measure-code">{measure.Code}</p>
                                  <p className="measure-title">{measure.Title}</p>
                                  {measure.Summary && <p className="measure-summary">{measure.Summary}</p>}
                                  {measure.LegislationTitle && (
                                    <p className="measure-legislation"><strong>Legislation:</strong> {measure.LegislationTitle}</p>
                                  )}
                                  {measure.ImplementationAuthority && (
                                    <p className="measure-authority"><strong>Authority:</strong> {measure.ImplementationAuthority}</p>
                                  )}
                                </div>
                              ))}
                              {record.AllMeasures.length > 5 && (
                                <p className="more-measures">... and {record.AllMeasures.length - 5} more measures</p>
                              )}
                            </div>
                          </div>
                        )}
                        
                        <div className="regulatory-meta">
                          <span>Source: {record.Source}</span>
                          <span>Year: {record.Year}</span>
                          <span>Mode: {record.Mode}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="no-data">
                    No regulatory data found for HS Code {formData.hsCode} 
                    {formData.destinationCountry && ` and destination country ${formData.destinationCountry}`}.
                    <br/><br/>
                    <strong>Tip:</strong> The macmap_regulatory collection uses "ImportingCountry" field to match your selected Destination Country.
                  </p>
                )}
              </div>
            )}
          </div>

          <button className="conjumer-button">
            <FileText size={18} />
            Conjumer Requirement
            <ChevronDown size={18} />
          </button>
        </div>
      )}
    </div>
  );
};

export default ModernHSCodeSearch;
