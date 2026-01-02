import React, { useEffect } from "react";
import usePlacesAutocomplete, { getGeocode, getLatLng } from "use-places-autocomplete";
import { FaMapMarkerAlt, FaTimes } from "react-icons/fa";

export const AutocompleteInput = ({ 
  placeholder, 
  value, 
  setValue, 
  onSelect, 
  isMyLocation, 
  onUseMyLocation 
}) => {
  const {
    ready,
    value: inputValue,
    suggestions: { status, data },
    setValue: setInputValue,
    clearSuggestions,
  } = usePlacesAutocomplete({
    requestOptions: { location: { lat: () => 17.5449, lng: () => 78.3912 }, radius: 20000 },
    debounce: 300,
  });

  // Sync internal state with parent state
  useEffect(() => {
    if (value !== inputValue) {
      setInputValue(value, false);
    }
  }, [value]);

  const handleSelect = async (address) => {
    setInputValue(address, false);
    clearSuggestions();
    
    try {
      const results = await getGeocode({ address });
      const { lat, lng } = await getLatLng(results[0]);
      onSelect({ lat, lng }, address);
    } catch (error) {
      console.error("Geocoding Error:", error);
    }
  };

  return (
    <div className="autocomplete-container" style={{position: 'relative', width: '100%'}}>
      <input
        className="search-box-input"
        value={inputValue}
        onChange={(e) => {
          setInputValue(e.target.value);
          setValue(e.target.value); // Update parent text
        }}
        disabled={!ready && !isMyLocation}
        placeholder={placeholder}
        style={{
          width: '100%', padding: '10px 35px 10px 10px', 
          border: '1px solid #ddd', borderRadius: '8px',
          fontSize: '14px', outline: 'none'
        }}
      />
      
      {/* Clear Button or My Location Icon */}
      {inputValue ? (
        <FaTimes 
          onClick={() => { setInputValue(""); setValue(""); }}
          style={{position:'absolute', right:'10px', top:'50%', transform:'translateY(-50%)', color:'#999', cursor:'pointer'}}
        />
      ) : (
        onUseMyLocation && (
          <FaMapMarkerAlt 
            onClick={onUseMyLocation}
            title="Use My Location"
            style={{position:'absolute', right:'10px', top:'50%', transform:'translateY(-50%)', color:'#4285F4', cursor:'pointer'}}
          />
        )
      )}

      {/* Suggestions Dropdown */}
      {status === "OK" && (
        <ul style={{
          position: 'absolute', top: '100%', left: 0, right: 0, 
          background: 'white', border: '1px solid #ddd', borderRadius: '0 0 8px 8px',
          listStyle: 'none', padding: 0, margin: 0, zIndex: 1000, boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
        }}>
          {data.map(({ place_id, description }) => (
            <li
              key={place_id}
              onClick={() => handleSelect(description)}
              style={{padding: '10px', cursor: 'pointer', borderBottom: '1px solid #eee', fontSize: '13px'}}
              onMouseEnter={(e) => e.target.style.background = "#f0f0f0"}
              onMouseLeave={(e) => e.target.style.background = "white"}
            >
              📍 {description}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};