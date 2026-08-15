// Weather System for Babylon.js workspace
class WeatherSystem {
  constructor(scene) {
    this.scene = scene;
    this.particleSystem = null;
    this.emitter = null;
    this.currentWeather = 'sunny';
    this.intensity = 1.0;

    this.weatherConditions = [
      {
        id: 'sunny',
        name: 'Sunny',
        icon: '☀️',
        description: 'Clear blue sky with bright sunlight',
        skyColor: new BABYLON.Color3(0.5, 0.7, 1.0),
        fogColor: new BABYLON.Color3(0.9, 0.9, 0.95),
        fogDensity: 0.0
      },
      {
        id: 'cloudy',
        name: 'Cloudy',
        icon: '☁️',
        description: 'Overcast with diffused lighting',
        skyColor: new BABYLON.Color3(0.7, 0.8, 0.9),
        fogColor: new BABYLON.Color3(0.8, 0.8, 0.85),
        fogDensity: 0.001
      },
      {
        id: 'rainy',
        name: 'Rainy',
        icon: '🌧️',
        description: 'Heavy rain with water droplets',
        skyColor: new BABYLON.Color3(0.4, 0.5, 0.6),
        fogColor: new BABYLON.Color3(0.6, 0.7, 0.8),
        fogDensity: 0.005,
        particleSystem: 'rain'
      },
      {
        id: 'foggy',
        name: 'Foggy',
        icon: '🌫️',
        description: 'Dense fog reducing visibility',
        skyColor: new BABYLON.Color3(0.8, 0.8, 0.85),
        fogColor: new BABYLON.Color3(0.9, 0.9, 0.95),
        fogDensity: 0.02
      },
      {
        id: 'snowy',
        name: 'Snowy',
        icon: '❄️',
        description: 'Falling snow with winter atmosphere',
        skyColor: new BABYLON.Color3(0.9, 0.9, 0.95),
        fogColor: new BABYLON.Color3(0.95, 0.95, 0.98),
        fogDensity: 0.008,
        particleSystem: 'snow'
      },
      {
        id: 'stormy',
        name: 'Stormy',
        icon: '⛈️',
        description: 'Thunderstorm with heavy rain',
        skyColor: new BABYLON.Color3(0.3, 0.4, 0.5),
        fogColor: new BABYLON.Color3(0.5, 0.6, 0.7),
        fogDensity: 0.01,
        particleSystem: 'rain'
      }
    ];
  }

  createRainSystem() {
    // Create emitter for rain
    this.emitter = BABYLON.MeshBuilder.CreateBox("rainEmitter", { size: 100 }, this.scene);
    this.emitter.position.y = 50;
    this.emitter.isVisible = false;

    // Create particle system for rain
    this.particleSystem = new BABYLON.ParticleSystem("rain", 5000, this.scene);
    this.particleSystem.particleTexture = new BABYLON.Texture("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", this.scene);
    this.particleSystem.emitter = this.emitter;
    this.particleSystem.minEmitBox = new BABYLON.Vector3(-50, 0, -50);
    this.particleSystem.maxEmitBox = new BABYLON.Vector3(50, 0, 50);
    this.particleSystem.color1 = new BABYLON.Color4(0.7, 0.8, 1, 1);
    this.particleSystem.color2 = new BABYLON.Color4(0.5, 0.6, 0.9, 1);
    this.particleSystem.colorDead = new BABYLON.Color4(0, 0, 0.2, 0);
    this.particleSystem.minSize = 0.1;
    this.particleSystem.maxSize = 0.3;
    this.particleSystem.minLifeTime = 0.5;
    this.particleSystem.maxLifeTime = 1.5;
    this.particleSystem.emitRate = 500;
    this.particleSystem.blendMode = BABYLON.ParticleSystem.BLENDMODE_ONEONE;
    this.particleSystem.gravity = new BABYLON.Vector3(0, -9.81, 0);
    this.particleSystem.direction1 = new BABYLON.Vector3(-0.2, -1, -0.2);
    this.particleSystem.direction2 = new BABYLON.Vector3(0.2, -1, 0.2);
    this.particleSystem.minAngularSpeed = 0;
    this.particleSystem.maxAngularSpeed = Math.PI;
    this.particleSystem.minEmitPower = 10;
    this.particleSystem.maxEmitPower = 20;
    this.particleSystem.updateSpeed = 0.01;

    return this.particleSystem;
  }

  createSnowSystem() {
    // Create emitter for snow
    this.emitter = BABYLON.MeshBuilder.CreateBox("snowEmitter", { size: 100 }, this.scene);
    this.emitter.position.y = 50;
    this.emitter.isVisible = false;

    // Create particle system for snow
    this.particleSystem = new BABYLON.ParticleSystem("snow", 3000, this.scene);
    this.particleSystem.particleTexture = new BABYLON.Texture("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", this.scene);
    this.particleSystem.emitter = this.emitter;
    this.particleSystem.minEmitBox = new BABYLON.Vector3(-50, 0, -50);
    this.particleSystem.maxEmitBox = new BABYLON.Vector3(50, 0, 50);
    this.particleSystem.color1 = new BABYLON.Color4(1, 1, 1, 1);
    this.particleSystem.color2 = new BABYLON.Color4(0.9, 0.9, 1, 1);
    this.particleSystem.colorDead = new BABYLON.Color4(0.8, 0.8, 0.9, 0);
    this.particleSystem.minSize = 0.05;
    this.particleSystem.maxSize = 0.15;
    this.particleSystem.minLifeTime = 2;
    this.particleSystem.maxLifeTime = 4;
    this.particleSystem.emitRate = 300;
    this.particleSystem.blendMode = BABYLON.ParticleSystem.BLENDMODE_ONEONE;
    this.particleSystem.gravity = new BABYLON.Vector3(0, -1, 0);
    this.particleSystem.direction1 = new BABYLON.Vector3(-0.1, -0.5, -0.1);
    this.particleSystem.direction2 = new BABYLON.Vector3(0.1, -0.5, 0.1);
    this.particleSystem.minAngularSpeed = 0;
    this.particleSystem.maxAngularSpeed = Math.PI / 2;
    this.particleSystem.minEmitPower = 1;
    this.particleSystem.maxEmitPower = 3;
    this.particleSystem.updateSpeed = 0.01;

    return this.particleSystem;
  }

  applyWeather(weatherId) {
    const weather = this.weatherConditions.find(w => w.id === weatherId);
    if (!weather) return;

    this.currentWeather = weatherId;

    // Apply sky color
    if (this.scene.clearColor) {
      this.scene.clearColor = weather.skyColor;
    }

    // Apply fog
    this.scene.fogMode = BABYLON.Scene.FOGMODE_EXP;
    this.scene.fogColor = weather.fogColor;
    this.scene.fogDensity = weather.fogDensity * this.intensity;

    // Dispose existing particle system
    if (this.particleSystem) {
      this.particleSystem.dispose();
      this.particleSystem = null;
    }
    if (this.emitter) {
      this.emitter.dispose();
      this.emitter = null;
    }

    // Create new particle system if needed
    if (weather.particleSystem === 'rain') {
      this.particleSystem = this.createRainSystem();
      this.particleSystem.emitRate *= this.intensity;
      this.particleSystem.start();
    } else if (weather.particleSystem === 'snow') {
      this.particleSystem = this.createSnowSystem();
      this.particleSystem.emitRate *= this.intensity;
      this.particleSystem.start();
    }

    console.log(`Weather changed to: ${weather.name}`);
  }

  adjustIntensity(newIntensity) {
    this.intensity = newIntensity;

    // Update fog density
    const weather = this.weatherConditions.find(w => w.id === this.currentWeather);
    if (weather) {
      this.scene.fogDensity = weather.fogDensity * this.intensity;
    }

    // Update particle system
    if (this.particleSystem) {
      const baseRate = this.particleSystem.name === 'rain' ? 500 : 300;
      this.particleSystem.emitRate = baseRate * this.intensity;
    }
  }

  dispose() {
    if (this.particleSystem) {
      this.particleSystem.dispose();
      this.particleSystem = null;
    }
    if (this.emitter) {
      this.emitter.dispose();
      this.emitter = null;
    }
  }
}

// Global weather system instance
let weatherSystem = null;

// Exported functions for use in workspace.html
function initWeatherSystem(scene) {
  weatherSystem = new WeatherSystem(scene);
  weatherSystem.applyWeather('sunny'); // Default weather
}

function applyWeather(weatherId) {
  if (weatherSystem) {
    weatherSystem.applyWeather(weatherId);
  }
}

function adjustWeatherIntensity(intensity) {
  if (weatherSystem) {
    weatherSystem.adjustIntensity(intensity);
  }
}

function disposeWeatherSystem() {
  if (weatherSystem) {
    weatherSystem.dispose();
    weatherSystem = null;
  }
}

// Make functions globally available
window.initWeatherSystem = initWeatherSystem;
window.applyWeather = applyWeather;
window.adjustWeatherIntensity = adjustWeatherIntensity;
window.disposeWeatherSystem = disposeWeatherSystem;
