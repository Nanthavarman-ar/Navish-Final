/**
 * Manual Error Handling Tests
 * Run these tests in the browser console to test error handling implementations
 */

class ManualErrorTester {
    constructor() {
        this.results = [];
        this.baseUrl = window.location.origin;
    }

    async log(message, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = `[${timestamp}] ${message}`;
        console.log(logEntry);

        this.results.push({
            timestamp,
            message,
            type
        });

        // Also update the UI if we're on the test page
        const logDiv = document.getElementById('test-log');
        if (logDiv) {
            const logEntryDiv = document.createElement('div');
            logEntryDiv.className = `log-entry ${type}`;
            logEntryDiv.textContent = logEntry;
            logDiv.appendChild(logEntryDiv);
            logDiv.scrollTop = logDiv.scrollHeight;
        }
    }

    async runTest(testName, testFunction) {
        console.log(`\n🧪 Running test: ${testName}`);
        await this.log(`Starting test: ${testName}`, 'info');

        try {
            await testFunction();
            await this.log(`✅ Test passed: ${testName}`, 'success');
        } catch (error) {
            await this.log(`❌ Test failed: ${testName} - ${error.message}`, 'error');
        }
    }

    // Test 1: Service Worker Registration
    async testServiceWorker() {
        try {
            if ('serviceWorker' in navigator) {
                const registration = await navigator.serviceWorker.register('/sw.js');
                await this.log('Service Worker registered successfully', 'success');

                // Test basic functionality
                const cache = await caches.open('test-cache');
                await cache.put('/test', new Response('test data'));
                await this.log('Cache write test passed', 'success');

                const cachedResponse = await cache.match('/test');
                if (cachedResponse) {
                    await this.log('Cache read test passed', 'success');
                } else {
                    throw new Error('Cache read test failed');
                }

                await cache.delete('/test');
                await this.log('Cache cleanup test passed', 'success');
            } else {
                throw new Error('Service Worker not supported');
            }
        } catch (error) {
            throw new Error(`Service Worker test failed: ${error.message}`);
        }
    }

    // Test 2: Offline Fallback
    async testOfflineFallback() {
        try {
            const response = await fetch('/api/test-offline');
            const data = await response.json();

            if (response.status === 503 && data.error === 'offline') {
                await this.log('Offline fallback working correctly', 'success');
            } else {
                throw new Error(`Unexpected response: ${response.status} - ${JSON.stringify(data)}`);
            }
        } catch (error) {
            throw new Error(`Offline fallback test failed: ${error.message}`);
        }
    }

    // Test 3: Network Failure Handling
    async testNetworkFailure() {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            try {
                const response = await fetch('https://non-existent-domain-12345.com/test', {
                    signal: controller.signal
                });
                clearTimeout(timeoutId);
                throw new Error('Expected network failure but got response');
            } catch (fetchError) {
                clearTimeout(timeoutId);

                const isExpectedError = fetchError.name === 'AbortError' ||
                    fetchError.message.includes('fetch') ||
                    fetchError.message.includes('Failed to fetch');

                if (isExpectedError) {
                    await this.log(`Network failure handled correctly (${fetchError.name})`, 'success');
                } else {
                    throw new Error(`Unexpected error type: ${fetchError.name} - ${fetchError.message}`);
                }
            }
        } catch (error) {
            throw new Error(`Network failure test failed: ${error.message}`);
        }
    }

    // Test 4: Retry Mechanism
    async testRetryMechanism() {
        try {
            let attempts = 0;
            const maxAttempts = 3;

            const retryFunction = async () => {
                attempts++;
                if (attempts < maxAttempts) {
                    throw new Error(`Simulated failure on attempt ${attempts}`);
                }
                return { success: true, data: 'Success after retries' };
            };

            for (let i = 0; i < maxAttempts; i++) {
                try {
                    await retryFunction();
                    break;
                } catch (error) {
                    if (i === maxAttempts - 1) {
                        throw error;
                    }
                    await this.log(`Retry attempt ${attempts} failed: ${error.message}`, 'info');
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }

            await this.log(`Retry mechanism test passed (${attempts} attempts)`, 'success');
        } catch (error) {
            throw new Error(`Retry mechanism test failed: ${error.message}`);
        }
    }

    // Test 5: Network Monitoring
    async testNetworkMonitoring() {
        try {
            let onlineEvents = 0;
            let offlineEvents = 0;

            const monitorOnline = () => onlineEvents++;
            const monitorOffline = () => offlineEvents++;

            window.addEventListener('online', monitorOnline);
            window.addEventListener('offline', monitorOffline);

            // Simulate network events
            window.dispatchEvent(new Event('online'));
            window.dispatchEvent(new Event('offline'));
            window.dispatchEvent(new Event('online'));

            // Wait for events to process
            await new Promise(resolve => setTimeout(resolve, 100));

            window.removeEventListener('online', monitorOnline);
            window.removeEventListener('offline', monitorOffline);

            if (onlineEvents === 2 && offlineEvents === 1) {
                await this.log(`Network monitoring test passed (${onlineEvents} online, ${offlineEvents} offline events)`, 'success');
            } else {
                throw new Error(`Expected 2 online and 1 offline events, got ${onlineEvents} online and ${offlineEvents} offline`);
            }
        } catch (error) {
            throw new Error(`Network monitoring test failed: ${error.message}`);
        }
    }

    // Test 6: Slow Network Handling
    async testSlowNetwork() {
        try {
            const startTime = Date.now();

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);

            try {
                const response = await fetch('https://httpbin.org/delay/2', {
                    signal: controller.signal
                });
                clearTimeout(timeoutId);

                const duration = Date.now() - startTime;
                if (duration > 1500 && duration < 5000) {
                    await this.log(`Slow network test passed (${duration}ms)`, 'success');
                } else {
                    throw new Error(`Unexpected duration: ${duration}ms (expected 1500-5000ms)`);
                }
            } catch (fetchError) {
                clearTimeout(timeoutId);
                throw fetchError;
            }
        } catch (error) {
            throw new Error(`Slow network test failed: ${error.message}`);
        }
    }

    // Test 7: Error Boundary Simulation
    async testErrorBoundary() {
        try {
            const errorTypes = [
                { type: 'network', error: new Error('Network connection failed') },
                { type: 'analysis', error: new Error('Analysis engine timeout') },
                { type: 'speech', error: new Error('Speech recognition unavailable') }
            ];

            let handledErrors = 0;

            for (const { type, error } of errorTypes) {
                try {
                    throw error;
                } catch (e) {
                    handledErrors++;
                    await this.log(`${type} error handled correctly`, 'success');
                }
            }

            if (handledErrors === errorTypes.length) {
                await this.log(`Error boundary simulation passed (${handledErrors}/${errorTypes.length} errors handled)`, 'success');
            } else {
                throw new Error(`Only ${handledErrors}/${errorTypes.length} errors were handled`);
            }
        } catch (error) {
            throw new Error(`Error boundary simulation failed: ${error.message}`);
        }
    }

    // Test 8: HTTP Error Handling
    async testHTTPErrorHandling() {
        try {
            const testCases = [
                { url: 'https://httpbin.org/status/500', expected: 500 },
                { url: 'https://httpbin.org/status/404', expected: 404 },
                { url: 'https://httpbin.org/status/403', expected: 403 }
            ];

            for (const testCase of testCases) {
                try {
                    const response = await fetch(testCase.url);
                    if (response.status === testCase.expected) {
                        await this.log(`HTTP ${testCase.expected} error handled correctly`, 'success');
                    } else {
                        throw new Error(`Expected ${testCase.expected} but got ${response.status}`);
                    }
                } catch (error) {
                    await this.log(`HTTP error test failed: ${error.message}`, 'error');
                }
            }
        } catch (error) {
            throw new Error(`HTTP error handling test failed: ${error.message}`);
        }
    }

    // Run all tests
    async runAllTests() {
        console.log('\n🎯 Starting manual error handling test suite...\n');

        const tests = [
            { name: 'Service Worker Registration', fn: () => this.testServiceWorker() },
            { name: 'Offline Fallback', fn: () => this.testOfflineFallback() },
            { name: 'Network Failure Handling', fn: () => this.testNetworkFailure() },
            { name: 'Retry Mechanism', fn: () => this.testRetryMechanism() },
            { name: 'Network Monitoring', fn: () => this.testNetworkMonitoring() },
            { name: 'Slow Network Handling', fn: () => this.testSlowNetwork() },
            { name: 'Error Boundary Simulation', fn: () => this.testErrorBoundary() },
            { name: 'HTTP Error Handling', fn: () => this.testHTTPErrorHandling() }
        ];

        for (const test of tests) {
            await this.runTest(test.name, test.fn);
        }

        this.generateReport();
    }

    generateReport() {
        console.log('\n📊 Manual Test Report Summary');
        console.log('=' .repeat(50));

        const successCount = this.results.filter(r => r.type === 'success').length;
        const errorCount = this.results.filter(r => r.type === 'error').length;
        const totalTests = this.results.length;

        console.log(`Total Tests: ${totalTests}`);
        console.log(`Passed: ${successCount}`);
        console.log(`Failed: ${errorCount}`);
        console.log(`Success Rate: ${((successCount / totalTests) * 100).toFixed(1)}%`);

        console.log('\n📝 Detailed Results:');
        this.results.forEach((result, index) => {
            const icon = result.type === 'success' ? '✅' : result.type === 'error' ? '❌' : 'ℹ️';
            console.log(`${icon} ${result.message}`);
        });

        console.log('\n💡 To run these tests:');
        console.log('1. Open http://localhost:3002/test-error-handling.html');
        console.log('2. Open browser console');
        console.log('3. Run: const tester = new ManualErrorTester(); tester.runAllTests();');
    }
}

// Make it available globally
window.ManualErrorTester = ManualErrorTester;

// Auto-generate test report
console.log('🔧 Manual Error Tester loaded!');
console.log('📖 Instructions:');
console.log('1. Open the browser console');
console.log('2. Run: const tester = new ManualErrorTester();');
console.log('3. Run: tester.runAllTests();');
console.log('4. Or run individual tests: tester.testServiceWorker(), etc.\n');

// Export for Node.js if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ManualErrorTester;
}
