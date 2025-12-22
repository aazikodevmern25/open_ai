import React, { useState } from 'react';
import './AITrainingPanel.css';
import { Save, Settings, Play } from 'lucide-react';
import api from '../config/api';

const AITrainingPanel = () => {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [testResults, setTestResults] = useState(null);
  const [testing, setTesting] = useState(false);
  const [instructions, setInstructions] = useState('You are an international trade documentation expert.');

  const handleSaveInstructions = async () => {
    setSaving(true);
    setMessage('');
    try {
      const response = await api.post('/api/hscode/update-ai-config', { instructions: instructions });
      if (response.data.success) {
        setMessage('✓ Saved successfully!');
      }
    } catch (error) {
      setMessage('✗ Error: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleTestInstructions = async () => {
    setTesting(true);
    setTestResults(null);
    setMessage('');
    try {
      const response = await api.post('/api/hscode/test-ai-instructions', {
        instructions: instructions,
        hsCode: '482290',
        country: 'Belgium',
        mode: 'Export'
      });
      if (response.data.success) {
        setTestResults(response.data.results);
        setShowPreview(true);
        setMessage('✓ Test completed!');
      }
    } catch (error) {
      setMessage('✗ Error: ' + error.message);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="ai-training-panel">
      <div className="training-header">
        <Settings size={24} />
        <h2>🔧 Admin: AI Training</h2>
        <p className="admin-notice">⚠️ These instructions apply to ALL searches for ALL users</p>
      </div>
      <div className="simple-instructions-container">
        <h3>📝 AI Instructions (One Simple Box)</h3>
        <textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          rows={20}
          className="simple-textarea"
        />
        <div className="action-buttons">
          <button className="test-button" onClick={handleTestInstructions} disabled={testing}>
            <Play size={18} />
            {testing ? 'Testing...' : 'Test'}
          </button>
          <button className="save-button" onClick={handleSaveInstructions} disabled={saving}>
            <Save size={18} />
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
        {message && <div className={message.startsWith('✓') ? 'success-message' : 'error-message'}>{message}</div>}
        {showPreview && testResults && (
          <div className="preview-section">
            <h3>Test Results</h3>
            <pre>{JSON.stringify(testResults, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  );
};

export default AITrainingPanel;
