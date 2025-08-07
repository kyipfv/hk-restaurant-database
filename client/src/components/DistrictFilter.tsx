import React from 'react';

interface DistrictFilterProps {
  districts: string[];
  selectedDistrict: string;
  onChange: (district: string) => void;
}

export function DistrictFilter({ districts, selectedDistrict, onChange }: DistrictFilterProps) {
  return (
    <select
      value={selectedDistrict}
      onChange={(e) => onChange(e.target.value)}
      className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
    >
      <option value="">All Districts</option>
      {districts.map((district) => (
        <option key={district} value={district}>
          {district}
        </option>
      ))}
    </select>
  );
}