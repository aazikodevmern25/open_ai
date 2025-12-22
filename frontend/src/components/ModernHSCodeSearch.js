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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('documents');
  const [expandedSections, setExpandedSections] = useState({
    production: true,
    labeling: false,
    documents: false
  });
  const [aiPackagingInfo, setAiPackagingInfo] = useState(null);
  const [packagingLoading, setPackagingLoading] = useState(false);
  const [aiProductionInfo, setAiProductionInfo] = useState(null);
  const [productionLoading, setProductionLoading] = useState(false);
  const [aiCache, setAiCache] = useState({});
  const [filteredDocuments, setFilteredDocuments] = useState([]);
  const [aiDocumentsInfo, setAiDocumentsInfo] = useState(null);
  const [aiFilteredDocs, setAiFilteredDocs] = useState([]);

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
      setSearchResults(response.data);
      
      // Reset AI info for new search
      setAiPackagingInfo(null);
      setAiProductionInfo(null);
      
      // Auto-generate production info - pass the actual data array
      generateProductionInfo(response.data.data, formData.hsCode, formData.destinationCountry, formData.importExport);
    } catch (err) {
      setError(err.response?.data?.message || 'Error searching HS Code');
    } finally {
      setLoading(false);
    }
  };

  const generateProductionInfo = async (dataArray, hsCode, country, mode) => {
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
        setAiCache(prev => ({ ...prev, [cacheKey]: checkResponse.data.cachedResult.productionInfo }));
        setProductionLoading(false);
        return;
      }
    } catch (err) {
      console.log('No cached result in database, will generate new');
    }
    
    try {
      // Generate new AI result
      const response = await api.post('/api/hscode/process-ai', {
        hsCode: hsCode,
        country: country,
        mode: mode,
        data: dataArray
      });
      
      if (response.data.success) {
        setAiProductionInfo(response.data.productionInfo);
        setAiPackagingInfo(response.data.packagingInfo);
        setAiDocumentsInfo(response.data.productionInfo);
        setAiFilteredDocs(response.data.importantDocuments || []);
        setAiCache(prev => ({ ...prev, [cacheKey]: response.data.productionInfo }));
        console.log('AI processed and saved to database with', response.data.importantDocuments?.length || 0, 'important docs');
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
          </div>

          <div className="tab-content">
            {activeTab === 'documents' && (
              <div className="documents-content">
                {productionLoading ? (
                  <div className="loading-message">
                    <Loader size={24} className="spinner" />
                    <p>AI is filtering important documents...</p>
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
                {/* AI-Processed Production Information */}
                {productionLoading ? (
                  <div className="loading-message">
                    <Loader size={24} className="spinner" />
                    <p>AI is analyzing your data and filtering important information...</p>
                  </div>
                ) : aiProductionInfo ? (
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
                        <p className="note" style={{marginTop: '15px'}}>
                          {aiCache[`production_${formData.hsCode}_${formData.destinationCountry}_${formData.importExport}`] ? 
                            '✓ Using cached AI analysis (search again to see instant results)' : 
                            '✓ AI filtered and processed - showing only important information'}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="no-data">AI is processing your data...</p>
                )}

                {/* Expandable Section 2: Labeling & Packaging */}
                <div className="expandable-section">
                  <button 
                    className="section-header collapsed"
                    onClick={() => setExpandedSections({...expandedSections, labeling: !expandedSections.labeling})}
                  >
                    <Package size={20} />
                    <span>2. LABELING & PACKAGING – What to Follow During Packing</span>
                    <ChevronDown size={20} className={expandedSections.labeling ? 'rotated' : ''} />
                  </button>
                  {expandedSections.labeling && (
                    <div className="section-content">
                      <h4>Essential Requirements:</h4>
                      <ul className="requirements-list">
                        <li><strong>Label Information:</strong> Must include product name, origin country "{formData.exportingCountry || 'India'}", and HS code {formData.hsCode}</li>
                        <li><strong>Destination Compliance:</strong> Follow {formData.destinationCountry || 'destination country'} regulations for labeling and packaging</li>
                        <li><strong>Product Type:</strong> {searchResults?.data?.[0]?.ProductName || 'Use appropriate materials for this product'}</li>
                        <li><strong>Certification Marks:</strong> Include all required marks and symbols as per destination requirements</li>
                      </ul>
                      <p className="note">Click "Packaging Type" tab for detailed AI-generated requirements</p>
                    </div>
                  )}
                </div>

                {/* Expandable Section 3: Documents Required */}
                <div className="expandable-section">
                  <button 
                    className="section-header collapsed"
                    onClick={() => setExpandedSections({...expandedSections, documents: !expandedSections.documents})}
                  >
                    <Package size={20} />
                    <span>3. DOCUMENTS REQUIRED – For Smooth U.S. Customs Clearance</span>
                    <ChevronDown size={20} className={expandedSections.documents ? 'rotated' : ''} />
                  </button>
                  {expandedSections.documents && (
                    <div className="section-content">
                      <p>Total Documents Required: <strong>{documents.length}</strong></p>
                      <ul className="requirements-list">
                        {documents.slice(0, 5).map((doc, index) => (
                          <li key={index}>{doc.Document}</li>
                        ))}
                        {documents.length > 5 && <li><em>... and {documents.length - 5} more documents</em></li>}
                      </ul>
                      <p className="note">Click "Document Requirement" tab to see all documents</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'packaging' && (
              <div className="packaging-content">
                <h3>Packaging Requirements</h3>
                {packagingLoading ? (
                  <div className="loading-message">
                    <Loader size={24} className="spinner" />
                    <p>AI is analyzing your data to generate important packaging requirements...</p>
                  </div>
                ) : aiPackagingInfo ? (
                  <div className="ai-content">
                    <div className="ai-response" dangerouslySetInnerHTML={{ __html: aiPackagingInfo.replace(/\n/g, '<br/>') }} />
                  </div>
                ) : (
                  <p className="no-data">Click this tab to generate packaging requirements</p>
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
