import * as kv from './kv_store.tsx'

// Server-side IoT Service for API operations
export class IoTService {
  private sensors: Map<string, any> = new Map();
  private devices: Map<string, any> = new Map();
  private energyHistory: any[] = [];
  private simulationConfig: any;
  private isSimulating: boolean = false;

  constructor() {
    this.initializeDefaultData();
  }

  private initializeDefaultData(): void {
    // Initialize with default sensors and devices
    this.sensors.set('temp_living_room', {
      id: 'temp_living_room',
      name: 'Living Room Temperature',
      type: 'temperature',
      value: 22,
      unit: '°C',
      status: 'active',
      lastUpdate: Date.now(),
      threshold: { min: 18, max: 26, warning: 28 }
    });

    this.devices.set('light_living_room', {
      id: 'light_living_room',
      name: 'Living Room Light',
      type: 'light',
      status: 'on',
      powerConsumption: 0.06,
      controllable: true
    });

    this.simulationConfig = {
      updateInterval: 5000,
      realisticValues: true,
      energyTracking: true,
      predictiveMaintenance: false
    };
  }

  // Get all sensors
  getAllSensors(): any[] {
    return Array.from(this.sensors.values());
  }

  // Get all devices
  getAllDevices(): any[] {
    return Array.from(this.devices.values());
  }

  // Get sensor value
  getSensorValue(sensorId: string): number | null {
    const sensor = this.sensors.get(sensorId);
    return sensor ? sensor.value : null;
  }

  // Control device
  async controlDevice(deviceId: string, command: 'on' | 'off' | 'toggle'): Promise<boolean> {
    const device = this.devices.get(deviceId);
    if (!device || !device.controllable) {
      return false;
    }

    switch (command) {
      case 'on':
        device.status = 'on';
        break;
      case 'off':
        device.status = 'off';
        break;
      case 'toggle':
        device.status = device.status === 'on' ? 'off' : 'on';
        break;
    }

    return true;
  }

  // Get energy history
  getEnergyHistory(hours: number = 24): any[] {
    const cutoffTime = Date.now() - (hours * 60 * 60 * 1000);
    return this.energyHistory.filter(data => data.timestamp >= cutoffTime);
  }

  // Get sensor alerts
  getSensorAlerts(): any[] {
    return Array.from(this.sensors.values()).filter(sensor => {
      if (!sensor.threshold) return false;

      return sensor.value < sensor.threshold.min ||
             sensor.value > sensor.threshold.max ||
             sensor.value > sensor.threshold.warning;
    });
  }

  // Get simulation status
  getSimulationStatus(): { isRunning: boolean; config: any } {
    return {
      isRunning: this.isSimulating,
      config: this.simulationConfig
    };
  }

  // Start simulation
  startSimulation(): void {
    this.isSimulating = true;
  }

  // Stop simulation
  stopSimulation(): void {
    this.isSimulating = false;
  }

  // Update simulation config
  updateSimulationConfig(config: Partial<any>): void {
    this.simulationConfig = { ...this.simulationConfig, ...config };
  }

  // Export IoT data
  exportIoTData(): any {
    return {
      sensors: this.getAllSensors(),
      devices: this.getAllDevices(),
      energyHistory: this.energyHistory,
      alerts: this.getSensorAlerts()
    };
  }

  // Simulate environmental conditions
  async simulateEnvironmentalConditions(): Promise<any> {
    const conditions = {
      temperature: 20 + Math.random() * 15,
      humidity: 40 + Math.random() * 40,
      airQuality: Math.random() * 100,
      noiseLevel: 30 + Math.random() * 40,
      lightLevel: 200 + Math.random() * 800,
      timestamp: Date.now()
    };

    return conditions;
  }

  // Create automation rule
  async createAutomationRule(trigger: any, action: any): Promise<string> {
    const ruleId = `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const rule = {
      id: ruleId,
      trigger,
      action,
      enabled: true,
      created: Date.now()
    };

    await kv.set(`iot_rule:${ruleId}`, rule);
    return ruleId;
  }

  // Execute automation rule
  async executeAutomationRule(ruleId: string): Promise<boolean> {
    const rule = await kv.get(`iot_rule:${ruleId}`);
    if (!rule) return false;

    console.log('Executing automation rule:', ruleId);
    return true;
  }

  // Energy optimization
  async optimizeEnergyUsage(): Promise<any> {
    const optimization = {
      recommendations: [
        'Reduce lighting in unoccupied rooms',
        'Adjust thermostat by 2°C during off-hours',
        'Schedule appliance usage for off-peak hours'
      ],
      potentialSavings: 25,
      actions: this.generateEnergyActions()
    };

    return optimization;
  }

  private generateEnergyActions(): any[] {
    const actions: any[] = [];
    this.devices.forEach(device => {
      if (device.status === 'on' && device.controllable) {
        actions.push({
          deviceId: device.id,
          action: 'schedule_off',
          time: Date.now() + 3600000,
          reason: 'energy_optimization'
        });
      }
    });
    return actions;
  }

  // Predictive maintenance
  async predictMaintenanceNeeds(): Promise<any[]> {
    const predictions: any[] = [];

    this.devices.forEach(device => {
      const prediction = {
        deviceId: device.id,
        maintenanceType: this.determineMaintenanceType(device),
        urgency: Math.random() > 0.8 ? 'high' : 'low',
        estimatedTime: Date.now() + Math.random() * 30 * 24 * 60 * 60 * 1000,
        reason: 'predictive_analysis'
      };
      predictions.push(prediction);
    });

    return predictions;
  }

  private determineMaintenanceType(device: any): string {
    const types = ['cleaning', 'calibration', 'replacement', 'inspection'];
    return types[Math.floor(Math.random() * types.length)];
  }

  // Smart scheduling
  async createSmartSchedule(deviceId: string, schedule: any): Promise<boolean> {
    const device = this.devices.get(deviceId);
    if (!device || !device.controllable) {
      return false;
    }

    console.log(`Created smart schedule for ${device.name}:`, schedule);
    return true;
  }

  // Environmental impact analysis
  async calculateEnvironmentalImpact(): Promise<any> {
    let totalConsumption = 0;
    this.devices.forEach(device => {
      if (device.status === 'on') {
        totalConsumption += device.powerConsumption;
      }
    });

    const impact = {
      dailyConsumption: totalConsumption * 24,
      monthlyConsumption: totalConsumption * 24 * 30,
      carbonFootprint: totalConsumption * 0.5,
      renewablePercentage: 75,
      recommendations: [
        'Switch to LED lighting',
        'Use energy-efficient appliances',
        'Implement smart scheduling'
      ]
    };

    return impact;
  }

  // Add custom sensor
  addSensor(sensor: any): void {
    this.sensors.set(sensor.id, sensor);
  }

  // Add custom device
  addDevice(device: any): void {
    this.devices.set(device.id, device);
  }

  // Remove sensor
  removeSensor(sensorId: string): boolean {
    return this.sensors.delete(sensorId);
  }

  // Remove device
  removeDevice(deviceId: string): boolean {
    return this.devices.delete(deviceId);
  }
}

// Singleton instance
let iotServiceInstance: IoTService | null = null;

export function getIoTService(): IoTService {
  if (!iotServiceInstance) {
    iotServiceInstance = new IoTService();
  }
  return iotServiceInstance;
}
