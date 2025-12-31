import React, { useState } from 'react';
import ModernHSCodeSearch from './components/ModernHSCodeSearch';
// import AITrainingPanel from './components/AITrainingPanel';
import './App.css';

function App() {
  // const [showTraining, setShowTraining] = useState(false);

  return (
    <div className="App">
      {/* <div className="app-header">
        <button 
          className="training-toggle"
          onClick={() => setShowTraining(!showTraining)}
        >
          {showTraining ? '🔍 Search' : '⚙️ AI Training'}
        </button>
      </div> */}
      
      <ModernHSCodeSearch />
    </div>
  );
}

export default App;
