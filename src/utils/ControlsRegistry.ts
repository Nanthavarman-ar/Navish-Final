export interface FeatureAdapter {
  enable(): void;
  disable(): void;
  execute(payload?: any): void;
  getState(): any;
}

class ControlsRegistry {
  private adapters: Map<string, FeatureAdapter> = new Map();

  register(featureId: string, adapter: FeatureAdapter): void {
    this.adapters.set(featureId, adapter);
  }

  getAdapter(featureId: string): FeatureAdapter | undefined {
    return this.adapters.get(featureId);
  }

  enable(featureId: string): void {
    const adapter = this.getAdapter(featureId);
    if (adapter) {
      adapter.enable();
    } else {
      console.warn(`No adapter registered for feature: ${featureId}`);
    }
  }

  disable(featureId: string): void {
    const adapter = this.getAdapter(featureId);
    if (adapter) {
      adapter.disable();
    } else {
      console.warn(`No adapter registered for feature: ${featureId}`);
    }
  }

  execute(featureId: string, payload?: any): void {
    const adapter = this.getAdapter(featureId);
    if (adapter) {
      adapter.execute(payload);
    } else {
      console.warn(`No adapter registered for feature: ${featureId}`);
    }
  }

  getState(featureId: string): any {
    const adapter = this.getAdapter(featureId);
    return adapter ? adapter.getState() : false;
  }

  getAllFeatures(): string[] {
    return Array.from(this.adapters.keys());
  }
}

// Singleton instance
const controlsRegistry = new ControlsRegistry();

export { ControlsRegistry, controlsRegistry };

// React hook for easy access
import { useMemo } from 'react';

export const useControlsRegistry = () => {
  return useMemo(() => controlsRegistry, []);
};
