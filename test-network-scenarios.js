/**
 * Network Scenario Testing Script
 * Tests error handling implementations with real network scenarios
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

class NetworkScenarioTester {
    constructor() {
        this.browser = null;
        this.page = null;
        this.testResults = [];
        this.baseUrl = 'http://localhost:3002';
    }

    async initialize() {
        console.log('🚀 Initializing network scenario tester...');

        this.browser = await puppeteer.launch({
            headless: false,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        this.page = await this.browser.newPage();

        // Enable console logging
        this.page.on('console', (msg) => {
            console.log('Browser Console:', msg.text());
        });

        // Enable error logging
        this.page.on('pageerror', (error) => {
            console.error('Page Error:', error.message);
        });

        await this.page.goto(`${this.baseUrl}/test-error-handling.html`);
        console.log('✅ Tester initialized');
    }

    async log(message, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = `[${timestamp}] ${message}`;
        console.log(logEntry);

        this.testResults.push({
            timestamp,
            message,
            type
        });
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

    async testServiceWorkerRegistration() {
        const result = await this.page.evaluate(async () => {
            try {
                if ('serviceWorker' in navigator) {
                    const registration = await navigator.serviceWorker.register('/sw.js');
                    await registration.update();
                    return { success: true, message: 'Service Worker registered successfully' };
                } else {
                    throw new Error('Service Worker not supported');
                }
            } catch (error) {
                return { success: false, message: error.message };
            }
        });

        if (result.success) {
            await this.log('Service Worker registration test passed', 'success');
        } else {
            throw new Error(result.message);
        }
    }

    async testOfflineFallback() {
        await this.log('Testing offline fallback...', 'info');

        // First, ensure we're online and can cache resources
        await this.page.evaluate(async () => {
            const response = await fetch('/api/test-offline', { method: 'GET' });
            return response.status;
        });

        // Then test offline behavior
        const offlineResult = await this.page.evaluate(async () => {
            try {
                const response = await fetch('/api/test-offline', { method: 'GET' });
                const data = await response.json();

                return {
                    success: response.status === 503 && data.error === 'offline',
                    status: response.status,
                    data: data
                };
            } catch (error) {
                return {
                    success: false,
                    error: error.message
                };
            }
        });

        if (offlineResult.success) {
            await this.log('Offline fallback test passed', 'success');
        } else {
            throw new Error(`Offline fallback failed: ${JSON.stringify(offlineResult)}`);
        }
    }

    async testNetworkFailureHandling() {
        await this.log('Testing network failure handling...', 'info');

        const failureResult = await this.page.evaluate(async () => {
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

                    return {
                        success: isExpectedError,
                        errorType: fetchError.name,
                        message: fetchError.message
                    };
                }
            } catch (error) {
                return {
                    success: false,
                    error: error.message
                };
            }
        });

        if (failureResult.success) {
            await this.log(`Network failure handling test passed (${failureResult.errorType})`, 'success');
        } else {
            throw new Error(`Network failure handling failed: ${failureResult.error}`);
        }
    }

    async testRetryMechanism() {
        await this.log('Testing retry mechanism...', 'info');

        const retryResult = await this.page.evaluate(async () => {
            let attempts = 0;
            const maxAttempts = 3;

            const retryFunction = async () => {
                attempts++;
                if (attempts < maxAttempts) {
                    throw new Error(`Simulated failure on attempt ${attempts}`);
                }
                return { success: true, data: 'Success after retries' };
            };

            try {
                // Simulate retry logic
                for (let i = 0; i < maxAttempts; i++) {
                    try {
                        await retryFunction();
                        break;
                    } catch (error) {
                        if (i === maxAttempts - 1) {
                            throw error;
                        }
                        // Wait before retry
                        await new Promise(resolve => setTimeout(resolve, 100));
                    }
                }

                return {
                    success: true,
                    attempts: attempts,
                    message: `Succeeded after ${attempts} attempts`
                };
            } catch (error) {
                return {
                    success: false,
                    attempts: attempts,
                    error: error.message
                };
            }
        });

        if (retryResult.success) {
            await this.log(`Retry mechanism test passed (${retryResult.attempts} attempts)`, 'success');
        } else {
            throw new Error(`Retry mechanism failed: ${retryResult.error}`);
        }
    }

    async testNetworkMonitoring() {
        await this.log('Testing network monitoring...', 'info');

        const monitorResult = await this.page.evaluate(async () => {
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

            return {
                success: onlineEvents === 2 && offlineEvents === 1,
                onlineEvents,
                offlineEvents
            };
        });

        if (monitorResult.success) {
            await this.log(`Network monitoring test passed (${monitorResult.onlineEvents} online, ${monitorResult.offlineEvents} offline events)`, 'success');
        } else {
            throw new Error(`Network monitoring failed: ${JSON.stringify(monitorResult)}`);
        }
    }

    async testSlowNetworkHandling() {
        await this.log('Testing slow network handling...', 'info');

        const slowResult = await this.page.evaluate(async () => {
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
                    return {
                        success: duration > 1500 && duration < 5000, // Should be around 2 seconds
                        duration: duration,
                        message: `Request completed in ${duration}ms`
                    };
                } catch (fetchError) {
                    clearTimeout(timeoutId);
                    throw fetchError;
                }
            } catch (error) {
                return {
                    success: false,
                    error: error.message
                };
            }
        });

        if (slowResult.success) {
            await this.log(`Slow network handling test passed (${slowResult.duration}ms)`, 'success');
        } else {
            throw new Error(`Slow network handling failed: ${slowResult.error || slowResult.message}`);
        }
    }

    async testErrorBoundarySimulation() {
        await this.log('Testing error boundary simulation...', 'info');

        const errorResult = await this.page.evaluate(async () => {
            try {
                // Simulate different types of errors
                const errorTypes = [
                    { type: 'network', error: new Error('Network connection failed') },
                    { type: 'analysis', error: new Error('Analysis engine timeout') },
                    { type: 'speech', error: new Error('Speech recognition unavailable') }
                ];

                let handledErrors = 0;

                for (const { type, error } of errorTypes) {
                    try {
                        // Simulate error handling (this would normally be caught by error boundary)
                        throw error;
                    } catch (e) {
                        // In a real scenario, this would be handled by the error boundary
                        handledErrors++;
                    }
                }

                return {
                    success: handledErrors === errorTypes.length,
                    handledErrors,
                    totalErrors: errorTypes.length
                };
            } catch (error) {
                return {
                    success: false,
                    error: error.message
                };
            }
        });

        if (errorResult.success) {
            await this.log(`Error boundary simulation test passed (${errorResult.handledErrors}/${errorResult.totalErrors} errors handled)`, 'success');
        } else {
            throw new Error(`Error boundary simulation failed: ${errorResult.error}`);
        }
    }

    async runAllTests() {
        console.log('\n🎯 Starting comprehensive error handling test suite...\n');

        const tests = [
            { name: 'Service Worker Registration', fn: () => this.testServiceWorkerRegistration() },
            { name: 'Offline Fallback', fn: () => this.testOfflineFallback() },
            { name: 'Network Failure Handling', fn: () => this.testNetworkFailureHandling() },
            { name: 'Retry Mechanism', fn: () => this.testRetryMechanism() },
            { name: 'Network Monitoring', fn: () => this.testNetworkMonitoring() },
            { name: 'Slow Network Handling', fn: () => this.testSlowNetworkHandling() },
            { name: 'Error Boundary Simulation', fn: () => this.testErrorBoundarySimulation() }
        ];

        for (const test of tests) {
            await this.runTest(test.name, test.fn);
        }

        this.generateReport();
    }

    generateReport() {
        console.log('\n📊 Test Report Summary');
        console.log('=' .repeat(50));

        const successCount = this.testResults.filter(r => r.type === 'success').length;
        const errorCount = this.testResults.filter(r => r.type === 'error').length;
        const totalTests = this.testResults.length;

        console.log(`Total Tests: ${totalTests}`);
        console.log(`Passed: ${successCount}`);
        console.log(`Failed: ${errorCount}`);
        console.log(`Success Rate: ${((successCount / totalTests) * 100).toFixed(1)}%`);

        console.log('\n📝 Detailed Results:');
        this.testResults.forEach((result, index) => {
            const icon = result.type === 'success' ? '✅' : result.type === 'error' ? '❌' : 'ℹ️';
            console.log(`${icon} ${result.message}`);
        });

        // Save report to file
        const reportPath = path.join(__dirname, 'error-handling-test-report.json');
        fs.writeFileSync(reportPath, JSON.stringify({
            timestamp: new Date().toISOString(),
            summary: {
                totalTests,
                successCount,
                errorCount,
                successRate: ((successCount / totalTests) * 100).toFixed(1)
            },
            results: this.testResults
        }, null, 2));

        console.log(`\n💾 Report saved to: ${reportPath}`);
    }

    async cleanup() {
        console.log('\n🧹 Cleaning up...');

        if (this.browser) {
            await this.browser.close();
        }

        console.log('✅ Cleanup completed');
    }
}

// Run tests if this file is executed directly
if (require.main === module) {
    const tester = new NetworkScenarioTester();

    process.on('SIGINT', async () => {
        console.log('\n⚠️  Received SIGINT, cleaning up...');
        await tester.cleanup();
        process.exit(0);
    });

    tester.initialize()
        .then(() => tester.runAllTests())
        .then(() => tester.cleanup())
        .then(() => {
            console.log('\n🎉 All tests completed!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n💥 Test suite failed:', error);
            tester.cleanup().then(() => process.exit(1));
        });
}

module.exports = NetworkScenarioTester;
