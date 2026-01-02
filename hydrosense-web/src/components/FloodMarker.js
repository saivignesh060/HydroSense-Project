// src/components/FloodMarker.js
import React, { useState } from 'react';
import { Marker, InfoWindow } from '@react-google-maps/api';

const FloodMarker = ({ flood, vehicleType }) => {
  const [isOpen, setIsOpen] = useState(false);

  // --- SAFETY LOGIC (Per Marker) ---
  const getStatus = () => {
    const limits = { walk: 2, bike: 6, car: 12, suv: 18 };
    const limit = limits[vehicleType] || 12;

    if (flood.depth_inches > limit) return { color: "red", url: "http://maps.google.com/mapfiles/ms/icons/red-dot.png" };
    if (flood.depth_inches > 0) return { color: "orange", url: "http://maps.google.com/mapfiles/ms/icons/orange-dot.png" };
    return { color: "blue", url: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png" }; // Should not happen for flood, but fallback
  };

  const status = getStatus();

  return (
    <Marker
      position={{ lat: flood.lat, lng: flood.lng }}
      icon={status.url}
      onClick={() => setIsOpen(true)}
    >
      {isOpen && (
        <InfoWindow onCloseClick={() => setIsOpen(false)}>
          <div style={{ padding: "5px", minWidth: "150px" }}>
            <h3 style={{ margin: "0 0 5px 0", color: "#333" }}>Flood Alert</h3>
            <p><strong>Depth:</strong> {flood.depth_inches} inches</p>
            <p><strong>Verified:</strong> {flood.is_verified ? "✅ Yes" : "⚠️ Pending"}</p>
            {status.color === "red" && (
              <div style={{ background: "#ffebee", padding: "5px", borderRadius: "4px", marginTop: "5px", fontSize: "12px", color: "#c62828", fontWeight: "bold" }}>
                ⛔ IMPASSABLE for {vehicleType}
              </div>
            )}
          </div>
        </InfoWindow>
      )}
    </Marker>
  );
};

export default FloodMarker;