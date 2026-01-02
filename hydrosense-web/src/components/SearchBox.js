// src/components/SearchBox.js
import React from "react";
import usePlacesAutocomplete, { getGeocode, getLatLng } from "use-places-autocomplete";
import { FaSearch } from "react-icons/fa";

export const SearchBox = ({ onSelectAddress }) => {
  const {
    ready,
    value,
    setValue,
    suggestions: { status, data },
    clearSuggestions,
  } = usePlacesAutocomplete({
    requestOptions: {
      location: { lat: () => 17.5449, lng: () => 78.3912 }, // Bias to Hyderabad
      radius: 20000,
    },
    debounce: 300,
  });

  const handleSelect = async (address) => {
    setValue(address, false);
    clearSuggestions();
    try {
      const results = await getGeocode({ address });
      const { lat, lng } = await getLatLng(results[0]);
      onSelectAddress({ lat, lng }, address);
    } catch (error) {
      console.error("Geocoding Error: ", error);
    }
  };

  return (
    <div className="search-container">
      <FaSearch className="search-icon" style={{position: 'absolute', top: '12px', left: '15px', color: '#777', zIndex: 10}} />
      <input
        className="search-box"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={!ready}
        placeholder="Search destination..."
        style={{paddingLeft: '40px'}} 
      />
      {status === "OK" && (
        <ul className="suggestions-list">
          {data.map(({ place_id, description }) => (
            <li
              key={place_id}
              className="suggestion-item"
              onClick={() => handleSelect(description)}
            >
              {description}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};