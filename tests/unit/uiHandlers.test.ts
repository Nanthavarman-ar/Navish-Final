import { renderHook, act } from '@testing-library/react';
import { useUIHandlers, UIHandlersProps } from '../../components/BabylonWorkspace/uiHandlers';

// Mock React hooks
jest.mock('react', () => ({
  ...jest.requireActual('react'),
  useCallback: jest.fn((fn) => fn),
}));

describe('useUIHandlers', () => {
  const mockSetters = {
    setSelectedWorkspaceId: jest.fn(),
    setRealTimeEnabled: jest.fn(),
    setCameraMode: jest.fn(),
    setGridVisible: jest.fn(),
    setWireframeEnabled: jest.fn(),
    setStatsVisible: jest.fn(),
    setCategoryPanelVisible: jest.fn(),
  };

  const mockGetters = {
    getRealTimeEnabled: jest.fn(),
    getGridVisible: jest.fn(),
    getWireframeEnabled: jest.fn(),
    getStatsVisible: jest.fn(),
    getCategoryPanelVisible: jest.fn(),
  };

  const defaultProps: UIHandlersProps = {
    ...mockSetters,
    ...mockGetters,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('handleWorkspaceSelect', () => {
    it('should call setSelectedWorkspaceId with the provided workspace ID', () => {
      const { result } = renderHook(() => useUIHandlers(defaultProps));
      const workspaceId = 'test-workspace-123';

      act(() => {
        result.current.handleWorkspaceSelect(workspaceId);
      });

      expect(mockSetters.setSelectedWorkspaceId).toHaveBeenCalledWith(workspaceId);
      expect(mockSetters.setSelectedWorkspaceId).toHaveBeenCalledTimes(1);
    });

    it('should handle empty string workspace ID', () => {
      const { result } = renderHook(() => useUIHandlers(defaultProps));

      act(() => {
        result.current.handleWorkspaceSelect('');
      });

      expect(mockSetters.setSelectedWorkspaceId).toHaveBeenCalledWith('');
    });

    it('should handle special characters in workspace ID', () => {
      const { result } = renderHook(() => useUIHandlers(defaultProps));
      const specialWorkspaceId = 'workspace@#$%';

      act(() => {
        result.current.handleWorkspaceSelect(specialWorkspaceId);
      });

      expect(mockSetters.setSelectedWorkspaceId).toHaveBeenCalledWith(specialWorkspaceId);
    });
  });

  describe('handleToggleRealTime', () => {
    it('should toggle real-time enabled state correctly', () => {
      mockGetters.getRealTimeEnabled.mockReturnValue(false);

      const { result } = renderHook(() => useUIHandlers(defaultProps));

      act(() => {
        result.current.handleToggleRealTime();
      });

      expect(mockGetters.getRealTimeEnabled).toHaveBeenCalled();
      expect(mockSetters.setRealTimeEnabled).toHaveBeenCalledWith(true);
    });

    it('should toggle from enabled to disabled', () => {
      mockGetters.getRealTimeEnabled.mockReturnValue(true);

      const { result } = renderHook(() => useUIHandlers(defaultProps));

      act(() => {
        result.current.handleToggleRealTime();
      });

      expect(mockSetters.setRealTimeEnabled).toHaveBeenCalledWith(false);
    });

    it('should handle getter returning undefined (default to false)', () => {
      mockGetters.getRealTimeEnabled.mockReturnValue(undefined);

      const { result } = renderHook(() => useUIHandlers(defaultProps));

      act(() => {
        result.current.handleToggleRealTime();
      });

      expect(mockSetters.setRealTimeEnabled).toHaveBeenCalledWith(true);
    });

    it('should handle getter returning null (default to false)', () => {
      mockGetters.getRealTimeEnabled.mockReturnValue(null);

      const { result } = renderHook(() => useUIHandlers(defaultProps));

      act(() => {
        result.current.handleToggleRealTime();
      });

      expect(mockSetters.setRealTimeEnabled).toHaveBeenCalledWith(true);
    });
  });

  describe('handleCameraModeChange', () => {
    const validModes = ['orbit', 'free', 'first-person'] as const;

    validModes.forEach(mode => {
      it(`should set camera mode to ${mode}`, () => {
        const { result } = renderHook(() => useUIHandlers(defaultProps));

        act(() => {
          result.current.handleCameraModeChange(mode);
        });

        expect(mockSetters.setCameraMode).toHaveBeenCalledWith(mode);
      });
    });

    it('should handle multiple mode changes', () => {
      const { result } = renderHook(() => useUIHandlers(defaultProps));

      act(() => {
        result.current.handleCameraModeChange('orbit');
      });
      expect(mockSetters.setCameraMode).toHaveBeenCalledWith('orbit');

      act(() => {
        result.current.handleCameraModeChange('free');
      });
      expect(mockSetters.setCameraMode).toHaveBeenCalledWith('free');

      expect(mockSetters.setCameraMode).toHaveBeenCalledTimes(2);
    });
  });

  describe('handleToggleGrid', () => {
    it('should toggle grid visibility from false to true', () => {
      mockGetters.getGridVisible.mockReturnValue(false);

      const { result } = renderHook(() => useUIHandlers(defaultProps));

      act(() => {
        result.current.handleToggleGrid();
      });

      expect(mockGetters.getGridVisible).toHaveBeenCalled();
      expect(mockSetters.setGridVisible).toHaveBeenCalledWith(true);
    });

    it('should toggle grid visibility from true to false', () => {
      mockGetters.getGridVisible.mockReturnValue(true);

      const { result } = renderHook(() => useUIHandlers(defaultProps));

      act(() => {
        result.current.handleToggleGrid();
      });

      expect(mockSetters.setGridVisible).toHaveBeenCalledWith(false);
    });

    it('should handle getter returning undefined (default to false)', () => {
      mockGetters.getGridVisible.mockReturnValue(undefined);

      const { result } = renderHook(() => useUIHandlers(defaultProps));

      act(() => {
        result.current.handleToggleGrid();
      });

      expect(mockSetters.setGridVisible).toHaveBeenCalledWith(true);
    });
  });

  describe('handleToggleWireframe', () => {
    it('should toggle wireframe from false to true', () => {
      mockGetters.getWireframeEnabled.mockReturnValue(false);

      const { result } = renderHook(() => useUIHandlers(defaultProps));

      act(() => {
        result.current.handleToggleWireframe();
      });

      expect(mockGetters.getWireframeEnabled).toHaveBeenCalled();
      expect(mockSetters.setWireframeEnabled).toHaveBeenCalledWith(true);
    });

    it('should toggle wireframe from true to false', () => {
      mockGetters.getWireframeEnabled.mockReturnValue(true);

      const { result } = renderHook(() => useUIHandlers(defaultProps));

      act(() => {
        result.current.handleToggleWireframe();
      });

      expect(mockSetters.setWireframeEnabled).toHaveBeenCalledWith(false);
    });

    it('should handle getter returning undefined (default to false)', () => {
      mockGetters.getWireframeEnabled.mockReturnValue(undefined);

      const { result } = renderHook(() => useUIHandlers(defaultProps));

      act(() => {
        result.current.handleToggleWireframe();
      });

      expect(mockSetters.setWireframeEnabled).toHaveBeenCalledWith(true);
    });
  });

  describe('handleToggleStats', () => {
    it('should toggle stats visibility from false to true', () => {
      mockGetters.getStatsVisible.mockReturnValue(false);

      const { result } = renderHook(() => useUIHandlers(defaultProps));

      act(() => {
        result.current.handleToggleStats();
      });

      expect(mockGetters.getStatsVisible).toHaveBeenCalled();
      expect(mockSetters.setStatsVisible).toHaveBeenCalledWith(true);
    });

    it('should toggle stats visibility from true to false', () => {
      mockGetters.getStatsVisible.mockReturnValue(true);

      const { result } = renderHook(() => useUIHandlers(defaultProps));

      act(() => {
        result.current.handleToggleStats();
      });

      expect(mockSetters.setStatsVisible).toHaveBeenCalledWith(false);
    });

    it('should handle getter returning undefined (default to false)', () => {
      mockGetters.getStatsVisible.mockReturnValue(undefined);

      const { result } = renderHook(() => useUIHandlers(defaultProps));

      act(() => {
        result.current.handleToggleStats();
      });

      expect(mockSetters.setStatsVisible).toHaveBeenCalledWith(true);
    });
  });

  describe('handleCategoryToggle', () => {
    const testCategory = 'test-category';

    it('should toggle category panel visibility from false to true', () => {
      const currentState = { [testCategory]: false };
      mockGetters.getCategoryPanelVisible.mockReturnValue(currentState);

      const { result } = renderHook(() => useUIHandlers(defaultProps));

      act(() => {
        result.current.handleCategoryToggle(testCategory);
      });

      expect(mockGetters.getCategoryPanelVisible).toHaveBeenCalled();
      expect(mockSetters.setCategoryPanelVisible).toHaveBeenCalledWith({
        [testCategory]: true
      });
    });

    it('should toggle category panel visibility from true to false', () => {
      const currentState = { [testCategory]: true };
      mockGetters.getCategoryPanelVisible.mockReturnValue(currentState);

      const { result } = renderHook(() => useUIHandlers(defaultProps));

      act(() => {
        result.current.handleCategoryToggle(testCategory);
      });

      expect(mockSetters.setCategoryPanelVisible).toHaveBeenCalledWith({
        [testCategory]: false
      });
    });

    it('should handle getter returning undefined (default to empty object)', () => {
      mockGetters.getCategoryPanelVisible.mockReturnValue(undefined);

      const { result } = renderHook(() => useUIHandlers(defaultProps));

      act(() => {
        result.current.handleCategoryToggle(testCategory);
      });

      expect(mockSetters.setCategoryPanelVisible).toHaveBeenCalledWith({
        [testCategory]: true
      });
    });

    it('should handle getter returning null (default to empty object)', () => {
      mockGetters.getCategoryPanelVisible.mockReturnValue(null);

      const { result } = renderHook(() => useUIHandlers(defaultProps));

      act(() => {
        result.current.handleCategoryToggle(testCategory);
      });

      expect(mockSetters.setCategoryPanelVisible).toHaveBeenCalledWith({
        [testCategory]: true
      });
    });

    it('should preserve other categories when toggling one', () => {
      const currentState = {
        'category1': true,
        [testCategory]: false,
        'category3': true
      };
      mockGetters.getCategoryPanelVisible.mockReturnValue(currentState);

      const { result } = renderHook(() => useUIHandlers(defaultProps));

      act(() => {
        result.current.handleCategoryToggle(testCategory);
      });

      expect(mockSetters.setCategoryPanelVisible).toHaveBeenCalledWith({
        'category1': true,
        [testCategory]: true,
        'category3': true
      });
    });

    it('should handle special characters in category names', () => {
      const specialCategory = 'category@#$%';
      const currentState = { [specialCategory]: false };
      mockGetters.getCategoryPanelVisible.mockReturnValue(currentState);

      const { result } = renderHook(() => useUIHandlers(defaultProps));

      act(() => {
        result.current.handleCategoryToggle(specialCategory);
      });

      expect(mockSetters.setCategoryPanelVisible).toHaveBeenCalledWith({
        [specialCategory]: true
      });
    });

    it('should handle empty category names', () => {
      const emptyCategory = '';
      const currentState = { [emptyCategory]: false };
      mockGetters.getCategoryPanelVisible.mockReturnValue(currentState);

      const { result } = renderHook(() => useUIHandlers(defaultProps));

      act(() => {
        result.current.handleCategoryToggle(emptyCategory);
      });

      expect(mockSetters.setCategoryPanelVisible).toHaveBeenCalledWith({
        [emptyCategory]: true
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle missing getters gracefully', () => {
      const propsWithoutGetters: UIHandlersProps = {
        ...mockSetters,
        // No getters provided
      };

      const { result } = renderHook(() => useUIHandlers(propsWithoutGetters));

      // Should not throw errors and use default values
      act(() => {
        result.current.handleToggleRealTime();
      });

      expect(mockSetters.setRealTimeEnabled).toHaveBeenCalledWith(true);
    });

    it('should handle setter functions that throw errors', () => {
      const errorSetter = jest.fn(() => {
        throw new Error('Setter error');
      });

      const propsWithErrorSetter: UIHandlersProps = {
        ...mockSetters,
        setRealTimeEnabled: errorSetter,
        ...mockGetters,
      };

      const { result } = renderHook(() => useUIHandlers(propsWithErrorSetter));

      // Should not throw errors in the handler
      expect(() => {
        act(() => {
          result.current.handleToggleRealTime();
        });
      }).not.toThrow();

      expect(errorSetter).toHaveBeenCalled();
    });

    it('should handle getter functions that throw errors', () => {
      const errorGetter = jest.fn(() => {
        throw new Error('Getter error');
      });

      const propsWithErrorGetter: UIHandlersProps = {
        ...mockSetters,
        getRealTimeEnabled: errorGetter,
      };

      const { result } = renderHook(() => useUIHandlers(propsWithErrorGetter));

      // Should not throw errors in the handler and use default value
      expect(() => {
        act(() => {
          result.current.handleToggleRealTime();
        });
      }).not.toThrow();

      expect(mockSetters.setRealTimeEnabled).toHaveBeenCalledWith(true);
    });

    it('should handle multiple rapid calls to the same handler', () => {
      mockGetters.getRealTimeEnabled.mockReturnValue(false);

      const { result } = renderHook(() => useUIHandlers(defaultProps));

      act(() => {
        result.current.handleToggleRealTime();
        result.current.handleToggleRealTime();
        result.current.handleToggleRealTime();
      });

      expect(mockSetters.setRealTimeEnabled).toHaveBeenCalledTimes(3);
      expect(mockSetters.setRealTimeEnabled).toHaveBeenLastCalledWith(true);
    });

    it('should handle concurrent calls to different handlers', () => {
      mockGetters.getRealTimeEnabled.mockReturnValue(false);
      mockGetters.getGridVisible.mockReturnValue(false);

      const { result } = renderHook(() => useUIHandlers(defaultProps));

      act(() => {
        result.current.handleToggleRealTime();
        result.current.handleToggleGrid();
      });

      expect(mockSetters.setRealTimeEnabled).toHaveBeenCalledWith(true);
      expect(mockSetters.setGridVisible).toHaveBeenCalledWith(true);
    });
  });

  describe('Return Object', () => {
    it('should return all required handler functions', () => {
      const { result } = renderHook(() => useUIHandlers(defaultProps));

      expect(typeof result.current.handleWorkspaceSelect).toBe('function');
      expect(typeof result.current.handleToggleRealTime).toBe('function');
      expect(typeof result.current.handleCameraModeChange).toBe('function');
      expect(typeof result.current.handleToggleGrid).toBe('function');
      expect(typeof result.current.handleToggleWireframe).toBe('function');
      expect(typeof result.current.handleToggleStats).toBe('function');
      expect(typeof result.current.handleCategoryToggle).toBe('function');
    });

    it('should return exactly 7 handler functions', () => {
      const { result } = renderHook(() => useUIHandlers(defaultProps));

      const handlerCount = Object.keys(result.current).length;
      expect(handlerCount).toBe(7);
    });
  });
});
