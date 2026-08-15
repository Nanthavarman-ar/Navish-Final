# 🍎 Enhanced Food Expiry Tracker

A comprehensive food management system with advanced features including AR/VR integration, real-time collaboration, barcode scanning, and analytics dashboard.

## ✨ Features

### Core Features
- **Smart Food Tracking**: Track food items with categories, expiry dates, storage locations
- **Real-time Status Updates**: Automatic status calculation (fresh, expiring soon, expired, consumed)
- **Advanced Filtering**: Filter by category, status, search terms, and custom date ranges
- **Local Storage**: Persistent data storage with automatic backup

### 🚀 Advanced Features

#### 📱 AR/VR Integration
- **Augmented Reality**: Overlay expiry information on real food items
- **Virtual Reality**: Explore your kitchen inventory in 3D space
- **Interactive Visualization**: Touch and manipulate virtual food items
- **Real-time Updates**: See live status changes in AR/VR environments

#### 📷 Barcode Scanner
- **Quick Item Addition**: Scan barcodes to instantly add items
- **Auto-population**: Automatically fill product details from barcode data
- **Smart Predictions**: AI-powered expiry date predictions based on product type
- **Batch Scanning**: Scan multiple items quickly

#### 👥 Real-time Collaboration
- **Multi-user Support**: Share inventory with family members
- **Live Updates**: Real-time synchronization across all devices
- **User Management**: Role-based access control (admin, editor, viewer)
- **Activity Tracking**: Monitor who added/modified items and when

#### 📊 Analytics Dashboard
- **Consumption Patterns**: Track eating habits and preferences
- **Waste Analysis**: Identify items most prone to waste
- **Shopping Recommendations**: Smart suggestions based on consumption
- **Trend Analysis**: Historical data and predictive insights

#### 🔄 Smart Features
- **Expiry Predictions**: AI-powered predictions based on item type and storage
- **Smart Notifications**: Customizable alerts for expiring items
- **Waste Reduction**: Analytics to minimize food waste
- **Recipe Suggestions**: Recommendations based on available ingredients

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd enhanced-food-tracker
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm run dev
   ```

4. **Open in browser**
   Navigate to `http://localhost:3000`

## 📁 Project Structure

```
enhanced-food-tracker/
├── components/
│   ├── FoodExpiryTracker_Enhanced.tsx    # Main tracker component
│   ├── ARVRFoundation.tsx               # AR/VR functionality
│   ├── BarcodeScanner.tsx               # Barcode scanning
│   ├── CollaborationPanel.tsx           # Real-time collaboration
│   ├── AnalyticsDashboard.tsx           # Analytics and insights
│   └── ui/                              # UI components
├── demo-enhanced-tracker.html           # Demo page
└── README-Enhanced-Tracker.md           # This file
```

## 🎯 Usage

### Basic Usage

```tsx
import FoodExpiryTracker from './components/FoodExpiryTracker_Enhanced';

// In your React component
<FoodExpiryTracker
  isActive={true}
  onClose={() => setShowTracker(false)}
/>
```

### Adding Food Items

1. **Manual Entry**: Click "Add Item" button and fill in details
2. **Barcode Scanning**: Click "Scan" button to use camera
3. **Smart Fill**: System auto-suggests common items and expiry dates

### Advanced Features Access

- **AR/VR Mode**: Click "AR/VR" button for immersive experience
- **Collaboration**: Click "Collaborate" to share with others
- **Analytics**: Click "Analytics" for detailed insights

## 🔧 Configuration

### Custom Settings

```tsx
const [expiringSoonDays, setExpiringSoonDays] = useState(3); // Days before expiry to warn
const [arvrMode, setArvrMode] = useState<'ar' | 'vr'>('ar'); // AR or VR mode
```

### Storage Locations
- `fridge`: Refrigerator items
- `freezer`: Frozen items
- `pantry`: Dry goods storage
- `counter`: Room temperature items

### Categories
- `dairy`: Milk, cheese, yogurt
- `meat`: Chicken, beef, fish
- `vegetables`: Fresh produce
- `fruits`: Fresh fruits
- `grains`: Bread, rice, pasta
- `beverages`: Drinks and liquids
- `other`: Miscellaneous items

## 📊 Data Structure

```tsx
interface FoodItem {
  id: string;
  name: string;
  category: 'dairy' | 'meat' | 'vegetables' | 'fruits' | 'grains' | 'beverages' | 'other';
  quantity: number;
  unit: 'pieces' | 'kg' | 'grams' | 'liters' | 'ml';
  purchaseDate: string;
  expiryDate: string;
  storageLocation: 'fridge' | 'freezer' | 'pantry' | 'counter';
  notes?: string;
  status: 'fresh' | 'expiring_soon' | 'expired' | 'consumed';
  createdAt: string;
  updatedAt: string;
}
```

## 🎨 UI Components

### Status Indicators
- 🟢 **Fresh**: Items with plenty of time remaining
- 🟡 **Expiring Soon**: Items expiring within configured days
- 🔴 **Expired**: Items past their expiry date
- ⚪ **Consumed**: Items that have been used

### Icons
- 📦 **Package**: General items
- 🥛 **Refrigerator**: Dairy and cold items
- 🍽️ **Utensils**: Meat and prepared foods
- 🛒 **Shopping Cart**: Beverages and drinks

## 🔒 Security & Privacy

- **Local Storage**: All data stored locally by default
- **Optional Sync**: Cloud synchronization available for collaboration
- **Data Encryption**: Sensitive data encrypted at rest
- **Privacy Controls**: Granular sharing permissions

## 🌐 Browser Support

- **Chrome 90+**: Full feature support including AR
- **Firefox 88+**: All features except advanced AR effects
- **Safari 14+**: Core features with limited AR support
- **Edge 90+**: Full feature support

## 📱 Mobile Support

- **iOS Safari**: Full support with camera access
- **Android Chrome**: Complete feature set
- **Progressive Web App**: Install as standalone app

## 🔄 API Integration

### Barcode Scanning
```tsx
const handleBarcodeDetected = (barcode: string, format: string) => {
  // Auto-fill form with product data
  setFormData(prev => ({ ...prev, ...getProductData(barcode) }));
};
```

### Real-time Collaboration
```tsx
const collaborationProps = {
  currentUser: {
    id: 'user_1',
    name: 'Current User',
    role: 'admin',
    status: 'online',
    lastSeen: new Date()
  }
};
```

## 🐛 Troubleshooting

### Common Issues

1. **Camera not working**: Ensure camera permissions are granted
2. **AR not loading**: Check WebXR support in browser
3. **Sync issues**: Verify internet connection for collaboration
4. **Storage full**: Clear browser data or use external storage

### Debug Mode

Enable debug mode by setting:
```tsx
localStorage.setItem('debug', 'true');
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new features
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🙏 Acknowledgments

- **Lucide React**: Beautiful icons
- **Date-fns**: Date manipulation utilities
- **Tailwind CSS**: Utility-first CSS framework
- **React**: UI framework

## 📞 Support

For support and questions:
- Create an issue on GitHub
- Check the troubleshooting section
- Review the demo page for examples

---

**Built with ❤️ for smarter food management**
