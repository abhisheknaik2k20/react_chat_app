import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import LandingPage from './components/LandingPage';
import AuthScreen from './components/AuthScreen';
import HomeScreen from './components/HomeScreen';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/auth" element={<AuthScreen />} />
            <Route path="/home" element={<HomeScreen />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
