/*
  HydroSense - Frontend Logic
  Updates:
  1. INSTANT Location: Loads from localStorage immediately, then updates with GPS.
  2. Blank Route Fix: Prevents routing if location isn't ready.
  3. Auto-Safest: Automatically switches to safe route on flood detection.
*/
import React, { useState, useEffect, useRef, useCallback } from "react";
import { GoogleMap, LoadScript, DirectionsRenderer, Marker, OverlayView } from "@react-google-maps/api";
import { collection, getDocs } from "firebase/firestore";
import { db } from "./firebase";
import { FaCamera, FaArrowLeft, FaCheckCircle, FaShieldAlt, FaLocationArrow } from "react-icons/fa";
import { getGeocode } from "use-places-autocomplete"; 
import "./App.css";

// Components
import VehicleSelector from "./components/VehicleSelector";
import FloodMarker from "./components/FloodMarker";
import { AutocompleteInput } from "./components/AutocompleteInput";
import { EmergencyPanel } from "./components/EmergencyPanel";

// --- CONFIGURATION ---
const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_KEY;
const BACKEND_URL = "https://hydrosense-project.onrender.com";

const mapContainerStyle = { width: "100%", height: "100%" };
// Default to Hyderabad if absolutely nothing is known
const defaultCenter = { lat: 17.4065, lng: 78.4772 }; 
const libraries = ["places"]; 
const VEHICLE_LIMITS = { walk: 48, bike: 6, car: 12, suv: 18 };

function App() {
  // --- STATE ---
  const [map, setMap] = useState(null);
  const [floods, setFloods] = useState([]); 
  const [uiMode, setUiMode] = useState("search"); 
  const [showEmergency, setShowEmergency] = useState(false);

  // Locations
  const [myLocation, setMyLocation] = useState(null); 
  const [origin, setOrigin] = useState(null); 
  const [originText, setOriginText] = useState("");
  const [destination, setDestination] = useState(null); 
  const [destinationText, setDestinationText] = useState("");
  
  // TRACKING MANUAL OVERRIDE
  const isManualOrigin = useRef(false);

  // Routing
  const [directionsResponse, setDirectionsResponse] = useState(null);
  const [routeIndex, setRouteIndex] = useState(0); 
  
  // Safety
  const [vehicle, setVehicle] = useState("car"); 
  const [routeStatus, setRouteStatus] = useState({ color: "#4285F4", badge: null, maxDepth: 0 });

  const [activeInput, setActiveInput] = useState("destination"); 
  const [isReporting, setIsReporting] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  //Helper to update location state and storage
  const updateLocationState = (lat, lng) => {
    const pos = { lat, lng };
    setMyLocation(pos);
    localStorage.setItem("lastKnownLocation", JSON.stringify(pos)); // SAVE TO STORAGE
    
    // Only update origin if user hasn't manually picked somewhere else
    if (!isManualOrigin.current) {
        setOrigin(pos);
        setOriginText("My Location");
    }
  };

  // --- 1. OPTIMIZED LOCATION TRACKING ---
  useEffect(() => {
    // A. INSTANT LOAD from LocalStorage
    const savedLoc = localStorage.getItem("lastKnownLocation");
    if (savedLoc) {
        try {
            const parsed = JSON.parse(savedLoc);
            setMyLocation(parsed);
            if (!isManualOrigin.current) {
                setOrigin(parsed);
                setOriginText("My Location");
            }
        } catch (e) { console.error("Error parsing saved location", e); }
    }

    // B. FRESH GPS FETCH
    if (navigator.geolocation) {
      // 1. Fast "One-off" fetch for immediate correction
      navigator.geolocation.getCurrentPosition(
        (position) => updateLocationState(position.coords.latitude, position.coords.longitude),
        (err) => console.warn("Quick GPS failed, waiting for watcher...", err),
        { enableHighAccuracy: false, timeout: 5000 }
      );

      // 2. High-precision Watcher
      const watchId = navigator.geolocation.watchPosition(
        (position) => updateLocationState(position.coords.latitude, position.coords.longitude),
        (err) => console.error("GPS Watch Error:", err),
        { enableHighAccuracy: true, maximumAge: 0 }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, []);

  const handleMapLoad = useCallback((mapInstance) => { 
      setMap(mapInstance);
      // Pan to saved location if available immediately
      const savedLoc = localStorage.getItem("lastKnownLocation");
      if (savedLoc) {
          mapInstance.panTo(JSON.parse(savedLoc));
      }
  }, []);

  // --- 2. MAP CLICK HANDLER ---
  const handleMapClick = async (e) => {
    if (!e.latLng) return;
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();
    const location = { lat, lng };

    isManualOrigin.current = true; // Lock manual selection

    try {
      const results = await getGeocode({ location });
      const address = results[0]?.formatted_address || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;

      if (activeInput === "origin") {
        setOrigin(location);
        setOriginText(address);
      } else {
        setDestination(location);
        setDestinationText(address);
        if (uiMode === "search") setUiMode("directions");
      }
    } catch (error) {
      console.error("Geocoding failed", error);
    }
  };

  // --- 3. ROBUST ROUTING ---
  const calculateRoute = async () => {
    // Prevent "Blank Route": Ensure both points exist before calling API
    if (!origin || !destination) {
        console.warn("Cannot calculate route: Origin or Destination missing.");
        return; 
    }
    
    const directionsService = new window.google.maps.DirectionsService();

    const standardRequest = {
      origin: origin,
      destination: destination,
      travelMode: window.google.maps.TravelMode.DRIVING,
      provideRouteAlternatives: true
    };

    const advancedRequest = {
      ...standardRequest,
      drivingOptions: {
        departureTime: new Date(),
        trafficModel: 'best_guess'
      }
    };

    try {
      const results = await directionsService.route(advancedRequest);
      setDirectionsResponse(results);
      // Route selection is handled by the Auto-Switch effect
    } catch (advancedError) {
      try {
        const fallbackResults = await directionsService.route(standardRequest);
        setDirectionsResponse(fallbackResults);
      } catch (finalError) {
        console.error("Routing Failed:", finalError);
        alert("No route found. Please check your locations.");
      }
    }
  };

  useEffect(() => {
    if (uiMode === "directions" && origin && destination) {
      calculateRoute();
    }
  }, [origin, destination, uiMode]);

  // --- 4. SAFETY ALGORITHM & AUTO-SWITCH ---
  
  const getRouteMaxDepth = (route) => {
    if (!route || !route.overview_path) return 0;
    let maxDepth = 0;
    const path = route.overview_path;

    for (const point of path) {
      for (const flood of floods) {
        const floodLoc = new window.google.maps.LatLng(flood.lat, flood.lng);
        if (window.google.maps.geometry.spherical.computeDistanceBetween(point, floodLoc) < 100) {
          maxDepth = Math.max(maxDepth, flood.depth_inches);
        }
      }
    }
    return maxDepth;
  };

  // EFFECT: AUTO-SWITCH TO SAFEST ROUTE
  useEffect(() => {
    if (directionsResponse && directionsResponse.routes.length > 0) {
      let safestIndex = 0;
      let minDepth = Infinity;

      directionsResponse.routes.forEach((route, index) => {
        const depth = getRouteMaxDepth(route);
        // Find route with lowest water depth
        if (depth < minDepth) {
          minDepth = depth;
          safestIndex = index;
        }
      });

      // Only switch if the current route is dangerous and a safer one exists
      const currentDepth = getRouteMaxDepth(directionsResponse.routes[routeIndex]);
      if (currentDepth > minDepth) {
          console.log(`Auto-switching to safer route ${safestIndex} (Depth: ${minDepth}")`);
          setRouteIndex(safestIndex);
      }
    }
  }, [floods, directionsResponse]); 

  // EFFECT: UPDATE STATUS BADGE
  useEffect(() => {
    if (directionsResponse && directionsResponse.routes[routeIndex]) {
      const maxDepth = getRouteMaxDepth(directionsResponse.routes[routeIndex]);
      const limit = VEHICLE_LIMITS[vehicle];
      
      let status = { color: "#1E8E3E", badge: "✅ Safest Path", maxDepth };

      if (maxDepth > limit) {
        status = { color: "#EA4335", badge: `⛔ ${vehicle === 'walk' ? 'Deep Water' : 'Engine Risk'}`, maxDepth };
      } else if (maxDepth > 0) {
        status = { color: "#FBBC04", badge: "⚠️ Caution", maxDepth };
      }
      setRouteStatus(status);
    }
  }, [vehicle, routeIndex, directionsResponse, floods]);


  // --- DEMO SIMULATION ---
  const fetchFloods = async () => {
    const s = await getDocs(collection(db, "active_floods"));
    setFloods(s.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  const simulateSmartRain = () => {
    if (!directionsResponse) return alert("Get directions first to demo the rerouting!");
    
    // 1. Target the MAIN route (Route 0) with a DISASTER
    const mainPath = directionsResponse.routes[0].overview_path;
    const midIndex = Math.floor(mainPath.length / 2);
    
    const disasterFlood = { 
        id: "sim-disaster", 
        lat: mainPath[midIndex].lat(), 
        lng: mainPath[midIndex].lng(), 
        depth_inches: 30, // Guaranteed RED ALERT
        is_verified: true 
    };
    
    let newFloods = [disasterFlood];

    // 2. If an ALT route exists, put a safe puddle there
    if (directionsResponse.routes.length > 1) {
        const altPath = directionsResponse.routes[1].overview_path;
        const altMid = Math.floor(altPath.length / 2);
        
        newFloods.push({
            id: "sim-safe", 
            lat: altPath[altMid].lat(), 
            lng: altPath[altMid].lng(), 
            depth_inches: 4, // Guaranteed GREEN
            is_verified: true 
        });
    }
    
    setFloods([...floods, ...newFloods]);
    alert("⚠️ DEMO: Major flooding on Route 0! Auto-switching to safest path...");
  };

  // --- REPORT SUBMISSION ---
  const submitReport = async () => {
    if (!selectedFile) return alert("Photo required.");
    setIsUploading(true);
    const formData = new FormData();
    formData.append('image', selectedFile);
    formData.append('lat', map.getCenter().lat());
    formData.append('lng', map.getCenter().lng());

    try {
      const res = await fetch(`${BACKEND_URL}/api/report-flood`, { method: 'POST', body: formData });
      const data = await res.json();
      
      console.log("Gemini Backend Response:", data);

      setIsUploading(false); setIsReporting(false); setSelectedFile(null);
      
      if (data.status === "VERIFIED") {
        alert(`✅ REPORT VERIFIED!\nTrust Score: ${data.score}/100\n+30 HydroPoints added!`);
        setFloods(prev => [...prev, {
            id: "new-report",
            lat: map.getCenter().lat(),
            lng: map.getCenter().lng(),
            depth_inches: data.ai_data?.estimated_depth_inches || 6
        }]);
      } else {
        alert(`❌ REJECTED\nReason: ${data.logs.join("\n")}`);
      }
    } catch (e) {
      console.error(e);
      setIsUploading(false); alert("Backend error. Check Console.");
    }
  };

  // Function to handle "Use My Location" click safely
  const handleUseMyLocation = () => {
      if (myLocation) {
          setOrigin(myLocation);
          setOriginText("My Location");
          isManualOrigin.current = false;
      } else {
          // If location isn't ready, try to fetch it again forcibly
          alert("📍 Locating you... please wait a moment.");
          navigator.geolocation.getCurrentPosition((pos) => {
              updateLocationState(pos.coords.latitude, pos.coords.longitude);
          });
      }
  };

  return (
    <LoadScript googleMapsApiKey={GOOGLE_MAPS_API_KEY} libraries={libraries}>
      <div className="app-container">
        
        {/* --- SIDEBAR --- */}
        <div className={`sidebar ${uiMode === 'directions' ? 'expanded' : ''}`}>
          
          <div className="search-card">
            {uiMode === "directions" && (
              <button className="back-btn-icon" onClick={() => setUiMode("search")}>
                <FaArrowLeft />
              </button>
            )}

            <div className="inputs-container">
              <div 
                className={`input-wrapper ${activeInput === 'origin' ? 'focused' : ''}`}
                onClick={() => setActiveInput('origin')}
                style={{display: uiMode === 'search' ? 'none' : 'block'}}
              >
                <AutocompleteInput 
                  placeholder="Choose starting point..."
                  value={originText}
                  setValue={setOriginText}
                  onSelect={(loc, addr) => { 
                    setOrigin(loc); 
                    setOriginText(addr); 
                    isManualOrigin.current = true; 
                  }}
                  isMyLocation={originText === "My Location"}
                  onUseMyLocation={handleUseMyLocation} // Updated handler
                />
              </div>

              <div 
                className={`input-wrapper ${activeInput === 'destination' ? 'focused' : ''}`}
                onClick={() => setActiveInput('destination')}
              >
                <AutocompleteInput 
                  placeholder="Search Google Maps"
                  value={destinationText}
                  setValue={setDestinationText}
                  onSelect={(loc, addr) => { 
                    setDestination(loc); 
                    setDestinationText(addr); 
                    isManualOrigin.current = true;
                    if (uiMode === 'search') setUiMode("directions"); 
                  }}
                />
              </div>
            </div>

            {uiMode === "search" && <div className="emergency-divider"></div>}
            {uiMode === "search" && (
              <button className="emergency-icon-btn" onClick={() => setShowEmergency(true)} title="Emergency Services">
                <FaShieldAlt />
              </button>
            )}
          </div>

          {showEmergency && <EmergencyPanel onClose={() => setShowEmergency(false)} />}

          {uiMode === "directions" && directionsResponse && (
            <div className="directions-results">
              <VehicleSelector currentVehicle={vehicle} setVehicle={setVehicle} />
              
              <div className="route-card" style={{borderLeft: `5px solid ${routeStatus.color}`}}>
                <div className="route-time" style={{color: routeStatus.color}}>
                  {directionsResponse.routes[routeIndex].legs[0].duration.text}
                </div>
                <div className="route-meta">
                  via {directionsResponse.routes[routeIndex].summary}
                  {routeIndex > 0 && " (Alt)"}
                </div>
                
                <div className={`badge ${routeStatus.color === '#EA4335' ? 'badge-danger' : 'badge-safe'}`}>
                  {routeStatus.badge} ({routeStatus.maxDepth}")
                </div>
              </div>
            </div>
          )}
        </div>

        {/* --- MAP --- */}
        <div className="map-wrapper">
          <GoogleMap 
            mapContainerStyle={mapContainerStyle} 
            center={myLocation || defaultCenter} 
            zoom={14} 
            onLoad={handleMapLoad}
            onClick={handleMapClick}
            options={{ disableDefaultUI: true, zoomControl: true }}
          >
            {myLocation && (
              <OverlayView position={myLocation} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                <div className="blue-dot-container">
                  <div className="blue-dot"></div>
                  <div className="blue-dot-pulse"></div>
                </div>
              </OverlayView>
            )}

            {origin && originText !== "My Location" && <Marker position={origin} label="A" />}
            {destination && <Marker position={destination} label="B" />}
            {floods.map(f => <FloodMarker key={f.id} flood={f} vehicleType={vehicle} />)}

            {directionsResponse && (
              <DirectionsRenderer 
                directions={directionsResponse} 
                routeIndex={routeIndex}
                options={{ 
                  polylineOptions: { strokeColor: routeStatus.color, strokeWeight: 6 },
                  suppressMarkers: true 
                }}
              />
            )}
          </GoogleMap>
          
          {/* ALT ROUTE CHIPS */}
          {uiMode === "directions" && directionsResponse && (
             <div className="alt-route-chips">
               {directionsResponse.routes.map((route, i) => (
                 <button key={i} onClick={() => setRouteIndex(i)} className={routeIndex === i ? 'chip active' : 'chip'}>
                   <span>{i===0 ? "Fastest" : `Alt ${i}`}</span>
                   <small>{route.legs[0].duration.text}</small>
                 </button>
               ))}
             </div>
          )}

          <div className="debug-menu">
            <button className="debug-btn" onClick={simulateSmartRain}>🎯 Demo Flood</button>
            <button className="debug-btn" onClick={() => setFloods([])}>✨ Clear Map</button>
          </div>
        </div>
        
        {/* REPORTING MODAL */}
        {isReporting && (
          <div className="modal-overlay">
            <div className="modal-content">
              <h2>Report Flood</h2>
              <input type="file" accept="image/*" ref={fileInputRef} style={{display:'none'}} onChange={e => setSelectedFile(e.target.files[0])} />
              <div onClick={() => fileInputRef.current.click()} className="upload-box">
                 {selectedFile ? <><FaCheckCircle size={30} color="#4285F4"/><p>{selectedFile.name}</p></> : <><FaCamera size={30} color="#ccc"/><p>Tap to take photo</p></>}
              </div>
              <button onClick={submitReport} disabled={isUploading} className="submit-btn">
                {isUploading ? 'Analyzing...' : 'Submit to Gemini'}
              </button>
              <button onClick={() => setIsReporting(false)} className="cancel-btn">Cancel</button>
            </div>
          </div>
        )}

        <button className="fab-report" onClick={() => setIsReporting(true)}><FaCamera /></button>

      </div>
    </LoadScript>
  );
}

export default App;