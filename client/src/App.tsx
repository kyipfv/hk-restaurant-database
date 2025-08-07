import React, { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RestaurantTable } from './components/RestaurantTable';
import { SearchBar } from './components/SearchBar';
import { DistrictFilter } from './components/DistrictFilter';
import { restaurantApi } from './api/restaurants';

function App() {
  const [search, setSearch] = useState('');
  const [district, setDistrict] = useState('');
  const [sort, setSort] = useState<'valid_til' | 'newest'>('newest');
  const [page, setPage] = useState(0);
  const limit = 100;

  const { data: districtsData } = useQuery({
    queryKey: ['districts'],
    queryFn: restaurantApi.getDistricts,
  });

  const { data: restaurantsData, isLoading } = useQuery({
    queryKey: ['restaurants', search, district, sort, page],
    queryFn: () =>
      restaurantApi.getRestaurants({
        search,
        district,
        sort,
        limit,
        offset: page * limit,
      }),
  });

  const handleSearch = useCallback((value: string) => {
    setSearch(value);
    setPage(0);
  }, []);

  const handleDistrictChange = useCallback((value: string) => {
    setDistrict(value);
    setPage(0);
  }, []);

  const handleSortToggle = () => {
    setSort((prev) => (prev === 'newest' ? 'valid_til' : 'newest'));
    setPage(0);
  };

  const totalPages = Math.ceil((restaurantsData?.total || 0) / limit);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-sm">
          <div className="px-6 py-4 border-b border-gray-200">
            <h1 className="text-2xl font-bold text-gray-900">
              Hong Kong Restaurant Database
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              Browse all licensed general restaurants in Hong Kong
            </p>
          </div>

          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <SearchBar onSearch={handleSearch} />
              </div>
              <div className="flex gap-4">
                <DistrictFilter
                  districts={districtsData || []}
                  selectedDistrict={district}
                  onChange={handleDistrictChange}
                />
                <button
                  onClick={handleSortToggle}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {sort === 'newest' ? 'Sort by Expiry' : 'Sort by Newest'}
                </button>
              </div>
            </div>
          </div>

          <RestaurantTable
            restaurants={restaurantsData?.restaurants || []}
            loading={isLoading}
          />

          {totalPages > 1 && (
            <div className="px-6 py-4 border-t border-gray-200 flex justify-between items-center">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Previous
              </button>
              <span className="text-sm text-gray-700">
                Page {page + 1} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;