// src/components/VehicleSelector.js
import React from 'react';
import { FaWalking, FaMotorcycle, FaCar, FaTruckPickup } from 'react-icons/fa';

const VehicleSelector = ({ currentVehicle, setVehicle }) => {
  const vehicles = [
    { id: 'walk', icon: <FaWalking />, label: 'Walk', limit: 2 },
    { id: 'bike', icon: <FaMotorcycle />, label: 'Bike', limit: 6 },
    { id: 'car', icon: <FaCar />, label: 'Car', limit: 12 },
    { id: 'suv', icon: <FaTruckPickup />, label: 'SUV', limit: 18 },
  ];

  return (
    <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
      {vehicles.map((v) => (
        <button
          key={v.id}
          onClick={() => setVehicle(v.id)}
          style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
            padding: '10px 5px', border: currentVehicle === v.id ? '2px solid #4285F4' : '1px solid #ddd',
            background: currentVehicle === v.id ? '#e8f0fe' : 'white',
            borderRadius: '8px', cursor: 'pointer', transition: '0.2s'
          }}
        >
          <div style={{ fontSize: '18px', color: currentVehicle === v.id ? '#1967d2' : '#555' }}>{v.icon}</div>
          <div style={{ fontSize: '11px', marginTop: '4px', fontWeight: 'bold', color: '#333' }}>{v.label}</div>
          <div style={{ fontSize: '9px', color: '#777' }}>Max {v.limit}"</div>
        </button>
      ))}
    </div>
  );
};

export default VehicleSelector;