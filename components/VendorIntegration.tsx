import React, { useState, useEffect } from 'react';

interface Supplier {
  id: string;
  name: string;
  logo: string;
  website: string;
  rating: number;
  deliveryTime: string;
  priceRange: string;
  specialties: string[];
  ecoCertified: boolean;
  location: string;
}

interface Product {
  id: string;
  name: string;
  supplierId: string;
  price: number;
  unit: string;
  availability: 'in-stock' | 'limited' | 'out-of-stock';
  description: string;
  specifications: Record<string, any>;
  ecoRating: number;
  certifications: string[];
}

interface VendorIntegrationProps {
  materialType: string;
  quantity?: number;
  budget?: number;
  preferredLocation?: string;
  onSupplierSelect?: (supplier: Supplier, product: Product) => void;
}

const VendorIntegration: React.FC<VendorIntegrationProps> = ({
  materialType,
  quantity = 1,
  budget,
  preferredLocation,
  onSupplierSelect
}) => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [searchFilters, setSearchFilters] = useState({
    ecoOnly: false,
    localOnly: false,
    inStockOnly: true,
    maxDeliveryDays: 14
  });

  // Mock supplier database - in real implementation, this would come from APIs
  const mockSuppliers: Supplier[] = [
    {
      id: 'home_depot',
      name: 'Home Depot',
      logo: '🏠',
      website: 'https://homedepot.com',
      rating: 4.2,
      deliveryTime: '1-3 days',
      priceRange: '$$',
      specialties: ['paint', 'wood', 'tile', 'hardware'],
      ecoCertified: false,
      location: 'Multiple Locations'
    },
    {
      id: 'lowes',
      name: 'Lowe\'s',
      logo: '🔨',
      website: 'https://lowes.com',
      rating: 4.1,
      deliveryTime: '2-5 days',
      priceRange: '$$',
      specialties: ['lumber', 'paint', 'plumbing', 'electrical'],
      ecoCertified: false,
      location: 'Multiple Locations'
    },
    {
      id: 'sherwin_williams',
      name: 'Sherwin Williams',
      logo: '🎨',
      website: 'https://sherwin-williams.com',
      rating: 4.5,
      deliveryTime: '3-7 days',
      priceRange: '$$$',
      specialties: ['paint', 'coatings', 'stains'],
      ecoCertified: true,
      location: 'Showrooms Nationwide'
    },
    {
      id: 'benjamin_moore',
      name: 'Benjamin Moore',
      logo: '🖌️',
      website: 'https://benjaminmoore.com',
      rating: 4.4,
      deliveryTime: '2-5 days',
      priceRange: '$$$',
      specialties: ['paint', 'primers', 'specialty coatings'],
      ecoCertified: true,
      location: 'Authorized Dealers'
    },
    {
      id: 'lumber_liquidators',
      name: 'Lumber Liquidators',
      logo: '🌲',
      website: 'https://lumberliquidators.com',
      rating: 4.0,
      deliveryTime: '5-10 days',
      priceRange: '$$',
      specialties: ['hardwood', 'laminate', 'tile', 'bamboo'],
      ecoCertified: true,
      location: 'Multiple Locations'
    },
    {
      id: 'flooring_direct',
      name: 'Flooring Direct',
      logo: '⬜',
      website: 'https://flooringdirect.com',
      rating: 4.3,
      deliveryTime: '7-14 days',
      priceRange: '$$',
      specialties: ['tile', 'hardwood', 'carpet', 'vinyl'],
      ecoCertified: false,
      location: 'Regional Distribution'
    }
  ];

  const mockProducts: Product[] = [
    {
      id: 'paint_eco_white',
      name: 'Eco-Friendly Interior Paint - White',
      supplierId: 'benjamin_moore',
      price: 45.99,
      unit: 'gallon',
      availability: 'in-stock',
      description: 'Low-VOC, eco-friendly interior paint with excellent coverage',
      specifications: { coverage: '350 sq ft', voc: '< 50 g/L', sheen: 'eggshell' },
      ecoRating: 5,
      certifications: ['GREENGUARD', 'LEED']
    },
    {
      id: 'wood_oak_natural',
      name: 'Red Oak Hardwood Flooring',
      supplierId: 'lumber_liquidators',
      price: 4.99,
      unit: 'sq ft',
      availability: 'in-stock',
      description: 'Premium red oak hardwood with natural finish',
      specifications: { thickness: '3/4"', width: '3.25"', grade: 'Select' },
      ecoRating: 3,
      certifications: ['FSC Certified']
    },
    {
      id: 'tile_porcelain_white',
      name: 'Porcelain Subway Tile - White',
      supplierId: 'flooring_direct',
      price: 1.25,
      unit: 'sq ft',
      availability: 'limited',
      description: 'Durable porcelain subway tile, perfect for bathrooms and kitchens',
      specifications: { size: '3x6"', finish: 'glossy', water_absorption: '< 0.5%' },
      ecoRating: 4,
      certifications: ['ANSI Certified']
    }
  ];

  useEffect(() => {
    loadSuppliersAndProducts();
  }, [materialType, searchFilters]);

  const loadSuppliersAndProducts = async () => {
    setLoading(true);

    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Filter suppliers based on material type and preferences
    let filteredSuppliers = mockSuppliers.filter(supplier =>
      supplier.specialties.includes(materialType.toLowerCase())
    );

    if (searchFilters.ecoOnly) {
      filteredSuppliers = filteredSuppliers.filter(s => s.ecoCertified);
    }

    if (searchFilters.localOnly && preferredLocation) {
      // In real implementation, filter by distance from preferredLocation
      filteredSuppliers = filteredSuppliers.filter(s =>
        s.location !== 'Multiple Locations' || s.location.includes('Nationwide')
      );
    }

    // Filter products
    let filteredProducts = mockProducts.filter(product => {
      const supplier = mockSuppliers.find(s => s.id === product.supplierId);
      return supplier && filteredSuppliers.includes(supplier);
    });

    if (searchFilters.inStockOnly) {
      filteredProducts = filteredProducts.filter(p => p.availability === 'in-stock');
    }

    if (budget) {
      filteredProducts = filteredProducts.filter(p => p.price <= budget);
    }

    setSuppliers(filteredSuppliers);
    setProducts(filteredProducts);
    setLoading(false);
  };

  const handleSupplierSelect = (supplierId: string) => {
    setSelectedSupplier(supplierId);
  };

  const handleProductSelect = (product: Product) => {
    const supplier = suppliers.find(s => s.id === product.supplierId);
    if (supplier && onSupplierSelect) {
      onSupplierSelect(supplier, product);
    }
  };

  const getAvailabilityColor = (availability: string) => {
    switch (availability) {
      case 'in-stock': return '#4CAF50';
      case 'limited': return '#FF9800';
      case 'out-of-stock': return '#F44336';
      default: return '#9E9E9E';
    }
  };

  const getEcoRatingColor = (rating: number) => {
    if (rating >= 4) return '#4CAF50';
    if (rating >= 3) return '#FF9800';
    return '#F44336';
  };

  return (
    <div className="vendor-integration-container">
      <h3 className="vendor-integration-title">🏪 Vendor Integration</h3>

      {/* Search Filters */}
      <div className="search-filters-section">
        <h4 className="section-title">Filters</h4>
        <div className="filters-list">
          <label className="filter-option">
            <input
              type="checkbox"
              checked={searchFilters.ecoOnly}
              onChange={(e) => setSearchFilters(prev => ({ ...prev, ecoOnly: e.target.checked }))}
            />
            🌱 Eco-certified only
          </label>
          <label className="filter-option">
            <input
              type="checkbox"
              checked={searchFilters.localOnly}
              onChange={(e) => setSearchFilters(prev => ({ ...prev, localOnly: e.target.checked }))}
            />
            📍 Local suppliers only
          </label>
          <label className="filter-option">
            <input
              type="checkbox"
              checked={searchFilters.inStockOnly}
              onChange={(e) => setSearchFilters(prev => ({ ...prev, inStockOnly: e.target.checked }))}
            />
            📦 In-stock only
          </label>
        </div>
      </div>

      {/* Suppliers List */}
      <div className="suppliers-section">
        <h4 className="section-title">Available Suppliers</h4>
        {loading ? (
          <div className="loading-message">🔄 Loading suppliers...</div>
        ) : (
          <div className="suppliers-list">
            {suppliers.map(supplier => (
              <div
                key={supplier.id}
                onClick={() => handleSupplierSelect(supplier.id)}
                className={`supplier-card ${selectedSupplier === supplier.id ? 'selected' : ''}`}
              >
                <div className="supplier-content">
                  <span className="supplier-logo">{supplier.logo}</span>
                  <div className="supplier-info">
                    <div className="supplier-name">{supplier.name}</div>
                    <div className="supplier-details">
                      ⭐ {supplier.rating} • {supplier.deliveryTime} • {supplier.priceRange}
                    </div>
                    <div className={`supplier-certification ${supplier.ecoCertified ? 'eco-certified' : 'standard'}`}>
                      {supplier.ecoCertified ? '🌱 Eco-Certified' : 'Standard Supplier'}
                    </div>
                  </div>
                  <a
                    href={supplier.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="supplier-link"
                  >
                    Visit →
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Products List */}
      {selectedSupplier && (
        <div className="products-section">
          <h4 className="section-title">Available Products</h4>
          <div className="products-list">
            {products
              .filter(product => product.supplierId === selectedSupplier)
              .map(product => (
                <div
                  key={product.id}
                  onClick={() => handleProductSelect(product)}
                  className="product-card"
                >
                  <div className="product-name">{product.name}</div>
                  <div className="product-description">
                    {product.description}
                  </div>
                  <div className="product-details">
                    <div className="product-price-info">
                      <div className="product-price">
                        ${product.price}/{product.unit}
                      </div>
                      <div className={`product-availability ${product.availability}`}>
                        {product.availability.replace('-', ' ').toUpperCase()}
                      </div>
                    </div>
                    <div className="product-rating">
                      <div className={`product-eco-rating eco-rating-${product.ecoRating >= 4 ? 'high' : product.ecoRating >= 3 ? 'medium' : 'low'}`}>
                        🌱 Eco: {product.ecoRating}/5
                      </div>
                      {product.certifications.length > 0 && (
                        <div className="product-certifications">
                          {product.certifications.join(', ')}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {suppliers.length === 0 && !loading && (
        <div className="no-suppliers-message">
          No suppliers found for {materialType}. Try adjusting your filters.
        </div>
      )}
    </div>
  );
};

export default VendorIntegration;
