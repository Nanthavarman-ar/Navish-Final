# NaViz Quick Start Guide

## 🚀 Getting Started

### Prerequisites
- Node.js >= 18
- npm or yarn
- Git

### Installation

1. **Navigate to the Naviz directory**:
```bash
cd d:\NaViz-main\NaViz-main\Naviz
```

2. **Install dependencies**:
```bash
npm install
```

3. **Start development server**:
```bash
npm run dev
```

4. **Open in browser**:
```
http://localhost:3000
```

---

## 🎮 Using the Application

### Main Interface

#### Left Panel - Feature Controls
- **Feature Categories**: Click to expand/collapse
- **Feature Buttons**: Toggle individual features on/off
- **Search**: Filter features by name

#### Top Bar - Performance & Camera
- **FPS Counter**: Monitor performance
- **Camera Modes**: Switch between Orbit, Fly, Walk
- **Grid/Wireframe**: Toggle visual aids
- **Stats**: Show/hide performance statistics

#### Right Panel - Inspector
- **Properties Tab**: View selected object properties
- **Materials Tab**: Edit materials
- **Features Tab**: Quick feature access

#### Bottom Panel - Status & Analytics
- **Active Features**: See which features are enabled
- **Performance Mode**: Switch between Low/Medium/High
- **Warnings**: View system warnings
- **Suggestions**: Get optimization tips

#### Floating Toolbar - Transform Tools
- **Move**: Translate objects
- **Rotate**: Rotate objects
- **Scale**: Scale objects
- **Camera**: Reset camera position
- **Perspective**: Toggle orthographic/perspective

---

## 🎯 Key Features

### 1. 3D Workspace
- **Canvas**: Main 3D rendering area
- **Mesh Selection**: Click objects to select
- **Transform Tools**: Move, rotate, scale selected objects
- **Camera Controls**: Mouse/keyboard navigation

### 2. Feature Categories

#### Core Workspace
- ✅ Move, Rotate, Scale tools
- ✅ Import/Export models
- ✅ Undo/Redo
- ✅ Settings panel

#### AI & Automation
- 🎤 Voice Assistant
- 🤖 AI Co-Designer
- 👋 Gesture Detection
- 🏠 Auto Furnish

#### Simulations
- 🌊 Flood Simulation
- 💨 Wind Tunnel
- ☀️ Sunlight Analysis
- 🔊 Noise Simulation
- ⚡ Energy Analysis
- 💰 Cost Estimation

#### AR/VR
- 🥽 VR Mode
- 📱 AR Mode
- 🔊 Spatial Audio
- 📳 Haptic Feedback

#### Collaboration
- 👥 Multi-User
- 💬 Chat
- 🔗 Sharing
- 🔄 Real-time Sync

---

## 🔧 Common Tasks

### Loading a 3D Model
1. Click **Import** button in left panel
2. Select `.gltf`, `.glb`, `.obj`, `.fbx`, or `.stl` file
3. Model appears in the scene

### Editing Materials
1. Select an object in the scene
2. Open **Right Panel** → **Materials Tab**
3. Adjust material properties
4. Changes apply in real-time

### Creating Animations
1. Enable **Animation Timeline** feature
2. Select object to animate
3. Create keyframes
4. Play animation

### Running Simulations
1. Enable desired simulation (e.g., Flood Simulation)
2. Adjust parameters in the simulation panel
3. View results in real-time

### Enabling VR/AR
1. Click **VR Mode** or **AR Mode** button
2. Put on VR headset or point AR device
3. Experience immersive 3D environment

---

## 🐛 Troubleshooting

### Application Won't Start
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
npm run dev
```

### TypeScript Errors
```bash
# Run type checking
npm run typecheck
```

### Build Errors
```bash
# Clean build and rebuild
npm run build
```

### WebGL Not Supported
- Update your graphics drivers
- Use a modern browser (Chrome, Firefox, Edge)
- Enable hardware acceleration in browser settings

### Performance Issues
1. Switch to **Low Performance Mode** in bottom panel
2. Disable unused features
3. Reduce post-processing effects
4. Close other browser tabs

---

## 📊 Performance Tips

### Optimize for Speed
- Disable post-processing (bloom, DOF, etc.)
- Reduce active features
- Use Low/Medium performance mode
- Close inspector panels when not needed

### Optimize for Quality
- Enable post-processing effects
- Use High performance mode
- Enable SSAO for better shadows
- Increase rendering quality

---

## 🎨 Customization

### Changing Layout Mode
1. Click layout mode button in top bar
2. Choose: Standard, Compact, Immersive, or Split
3. Layout updates immediately

### Customizing Features
1. Open **Settings** panel
2. Configure feature preferences
3. Save settings

### Keyboard Shortcuts
- `Ctrl+1/2/3`: Switch layout modes
- `Ctrl+H/J/K`: Toggle panels
- `W/F/T/N`: Simulation controls
- `A/U/C/V`: AI helpers
- `X/Z`: VR/AR modes
- `Esc`: Close overlays

---

## 📝 Feature Status

### ✅ Fully Functional
- 3D rendering and navigation
- Mesh selection and manipulation
- Material editing
- Feature toggle system
- Panel management
- Layout modes
- Error handling
- Loading states

### 🚧 In Development
- Some advanced simulations
- Full collaboration features
- Complete IoT integration
- Advanced AI features

---

## 🆘 Getting Help

### Resources
- **Code Issues Panel**: View detailed findings and fixes
- **Console Logs**: Check browser console for errors
- **Documentation**: See `COMPREHENSIVE_FIX_SUMMARY.md`

### Common Questions

**Q: How do I enable a feature?**
A: Click the feature button in the left panel. It will turn blue when active.

**Q: Why can't I see some features?**
A: Some features require specific conditions (e.g., selected mesh, loaded model).

**Q: How do I reset the workspace?**
A: Refresh the page or click the reset button in settings.

**Q: Can I use this offline?**
A: Yes, but some features (collaboration, cloud anchors) require internet.

---

## 🎓 Learning Path

### Beginner
1. Load a 3D model
2. Navigate the scene
3. Select and move objects
4. Change materials

### Intermediate
1. Use transform tools
2. Create animations
3. Run simulations
4. Customize layout

### Advanced
1. Enable collaboration
2. Use AI features
3. Integrate IoT devices
4. Create custom workflows

---

## 📦 Project Structure

```
Naviz/
├── components/          # React components
│   ├── BabylonWorkspace.tsx    # Main workspace
│   ├── managers/               # Feature managers
│   └── ui/                     # UI components
├── hooks/              # Custom React hooks
├── config/             # Configuration files
├── styles/             # CSS styles
└── public/             # Static assets
```

---

## 🔄 Updates & Maintenance

### Checking for Updates
```bash
npm outdated
```

### Updating Dependencies
```bash
npm update
```

### Running Tests
```bash
npm test
```

---

## 🎉 Success!

You're now ready to use NaViz! Explore the features, create amazing 3D visualizations, and enjoy the immersive experience.

**Happy Creating! 🚀**

---

**Version**: 1.0
**Last Updated**: 2025
**Status**: ✅ Ready to Use
