import React from 'react';
import { FaAmbulance, FaPhoneAlt, FaShieldAlt, FaHospital, FaTimes } from 'react-icons/fa';

export const EmergencyPanel = ({ onClose }) => {
  return (
    <div className="emergency-panel">
      <div className="emergency-header">
        <h3><FaShieldAlt /> Emergency Support</h3>
        <button className="close-btn" onClick={onClose}><FaTimes /></button>
      </div>
      
      <div className="emergency-grid">
        <button className="sos-btn" onClick={() => alert("SOS Signal Sent to nearest authorities!")}>
          <div className="icon-wrapper"><FaPhoneAlt /></div>
          <span>SOS Alert</span>
        </button>
        
        <div className="quick-actions">
          <div className="action-item">
            <FaAmbulance color="#d93025" />
            <div>
              <strong>Ambulance</strong>
              <small>Dial 108</small>
            </div>
          </div>
          <div className="action-item">
            <FaShieldAlt color="#1a73e8" />
            <div>
              <strong>Police</strong>
              <small>Dial 100</small>
            </div>
          </div>
          <div className="action-item">
            <FaHospital color="#E91E63" />
            <div>
              <strong>Safe Havens</strong>
              <small>Nearest High Ground</small>
            </div>
          </div>
        </div>
      </div>
      
      <div className="emergency-status">
        <small>Current Status:</small>
        <span className="status-badge safe">No Immediate Threat Detected</span>
      </div>
    </div>
  );
};