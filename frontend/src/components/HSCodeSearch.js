import React, { useState } from 'react';
import api from '../config/api';
import { Search, Send, Loader, AlertCircle, Database } from 'lucide-react';
import './HSCodeSearch.css';

const HSCodeSearch = () => {
  const [hsCode, setHsCode] = useState('');
  const [country, setCountry] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [messages, setMessages] = useState([]);
  const [currentPrompt, setCurrentPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  // Search HS Code
  const handleSearch = async (e) => {
    e.preventDefault();
    if (!hsCode.trim()) {
      setError('Please enter an HS Code');
      return;
    }

    setLoading(true);
    setError('');
    setSearchResults(null);
    setMessages([]);

    try {
      const url = country.trim() 
        ? `/api/hscode/search/${hsCode}?country=${encodeURIComponent(country.trim())}`
        : `/api/hscode/search/${hsCode}`;
      
      const response = await api.get(url);
      setSearchResults(response.data);
      
      const countryMsg = country.trim() ? ` for ${country}` : '';
      setMessages([{
        role: 'system',
        content: `Found ${response.data.count} export record(s) for HS Code: ${hsCode}${countryMsg}. You can now ask questions about this data.`
      }]);
    } catch (err) {
      setError(err.response?.data?.message || 'Error searching HS Code');
    } finally {
      setLoading(false);
    }
  };

  // Ask AI about the data
  const handleAskAI = async (e) => {
    e.preventDefault();
    if (!currentPrompt.trim() || !searchResults) {
      return;
    }

    const userMessage = { role: 'user', content: currentPrompt };
    setMessages(prev => [...prev, userMessage]);
    setCurrentPrompt('');
    setAiLoading(true);

    try {
      console.log('Sending AI request with prompt:', currentPrompt);
      console.log('Data being sent:', searchResults.data);
      
      const response = await api.post('/api/hscode/ask', {
        prompt: currentPrompt,
        data: searchResults.data
      });

      console.log('AI Response:', response.data);
      const aiMessage = { role: 'assistant', content: response.data.answer };
      setMessages(prev => [...prev, aiMessage]);
    } catch (err) {
      console.error('AI Error:', err);
      console.error('Error response:', err.response);
      
      const errorMessage = { 
        role: 'error', 
        content: err.response?.data?.message || err.message || 'Error processing your question' 
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="container">
      <div className="header">
        <Database size={40} className="header-icon" />
        <h1>HS Code AI Search</h1>
        <p>Search export records and ask AI questions about trade data</p>
      </div>

      {/* Search Form */}
      <form onSubmit={handleSearch} className="search-form">
        <div className="search-input-wrapper">
          <Search className="search-icon" size={20} />
          <input
            type="text"
            value={hsCode}
            onChange={(e) => setHsCode(e.target.value)}
            placeholder="Enter HS Code (e.g., 482290)"
            className="search-input"
            disabled={loading}
          />
        </div>
        <div className="search-input-wrapper">
          <input
            type="text"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            placeholder="Country (optional, e.g., Bangladesh)"
            className="search-input country-input"
            disabled={loading}
          />
        </div>
        <button type="submit" className="search-button" disabled={loading}>
          {loading ? <Loader className="spinner" size={20} /> : 'Search'}
        </button>
      </form>

      {/* Error Message */}
      {error && (
        <div className="error-message">
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {/* Search Results Summary */}
      {searchResults && (
        <div className="results-summary">
          <h3>Search Results</h3>
          <p>Found <strong>{searchResults.count}</strong> export record(s)
            {searchResults.country && searchResults.country !== 'All' && (
              <span> for <strong>{searchResults.country}</strong></span>
            )}
          </p>
          <div className="data-preview">
            <details>
              <summary>View Raw Data</summary>
              <pre>{JSON.stringify(searchResults.data, null, 2)}</pre>
            </details>
          </div>
        </div>
      )}

      {/* Chat Interface */}
      {searchResults && (
        <div className="chat-container">
          <div className="chat-messages">
            {messages.map((msg, index) => (
              <div key={index} className={`message ${msg.role}`}>
                <div className="message-content">
                  {msg.role === 'user' && <strong>You:</strong>}
                  {msg.role === 'assistant' && <strong>AI:</strong>}
                  {msg.role === 'system' && <strong>System:</strong>}
                  {msg.role === 'error' && <strong>Error:</strong>}
                  <p>{msg.content}</p>
                </div>
              </div>
            ))}
            {aiLoading && (
              <div className="message assistant">
                <div className="message-content">
                  <Loader className="spinner" size={16} />
                  <span>AI is thinking...</span>
                </div>
              </div>
            )}
          </div>

          {/* Chat Input */}
          <form onSubmit={handleAskAI} className="chat-input-form">
            <input
              type="text"
              value={currentPrompt}
              onChange={(e) => setCurrentPrompt(e.target.value)}
              placeholder="Ask a question about the data..."
              className="chat-input"
              disabled={aiLoading}
            />
            <button type="submit" className="send-button" disabled={aiLoading || !currentPrompt.trim()}>
              <Send size={20} />
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default HSCodeSearch;
