module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/tests', '<rootDir>/src'],
  testMatch: [
    '**/__tests__/**/*.+(ts|tsx|js)',
    '**/?(*.)+(test).+(ts|tsx|js)'
  ],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
    '^.+\\.(js|jsx)$': 'babel-jest'
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    'components/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!components/**/*.d.ts'
  ],
  setupFiles: ['<rootDir>/tests/jest.env.js'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$': '<rootDir>/tests/__mocks__/fileMock.js',
    '^@babylonjs/core$': '<rootDir>/tests/__mocks__/@babylonjs/core.ts',
    '^@babylonjs/gui$': '<rootDir>/tests/__mocks__/@babylonjs/gui.ts',
    '^@babylonjs/loaders$': '<rootDir>/tests/__mocks__/@babylonjs/loaders.ts',
    '^@babylonjs/core/Layers/highlightLayer$': '<rootDir>/tests/__mocks__/@babylonjs/core/Layers/highlightLayer.ts',
    '^@babylonjs/core/Maths/math.plane$': '<rootDir>/tests/__mocks__/@babylonjs/core/Maths/math.plane.ts',
    '^@babylonjs/core/Actions/actionManager$': '<rootDir>/tests/__mocks__/@babylonjs/core/Actions/actionManager.ts',
    '^@babylonjs/core/Loading/sceneLoader$': '<rootDir>/tests/__mocks__/@babylonjs/core/Loading/sceneLoader.ts',
    '^@babylonjs/core/XR/webXRTypes$': '<rootDir>/tests/__mocks__/@babylonjs/core/XR/webXRTypes.ts',
    '^@babylonjs/core/XR/webXRDefaultExperience$': '<rootDir>/tests/__mocks__/@babylonjs/core/XR/webXRDefaultExperience.ts'
  },
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/tests/e2e/'],
  transformIgnorePatterns: [
    'node_modules/(?!(@radix-ui|@supabase|@babylonjs)/)'
  ]
};
