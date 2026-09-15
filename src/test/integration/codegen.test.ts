/**
 * Master Integration Test Suite for Apache Beam Codegen
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Sequentially executes all end-to-end integration test suites:
 * - JdbcIO to JdbcIO (Java & Python)
 * - KafkaIO to KafkaIO (Java & Python)
 */

import { runJdbcIoToJdbcIoTest } from './jdbcio-to-jdbcio.test';
import { runKafkaIoToKafkaIoTest } from './kafkaio-to-kafkaio.test';

/**
 * Runs all integration test suites sequentially and reports summary status.
 */
export async function runAllIntegrationTests(): Promise<void> {
    console.log('======================================================');
    console.log('🚀 Starting All Apache Beam Pipeline Integration Tests');
    console.log('======================================================');

    try {
        await runJdbcIoToJdbcIoTest();
        await runKafkaIoToKafkaIoTest();
        console.log('\n🎉 ALL INTEGRATION SUITES PASSED SUCCESSFULLY!');
    } catch (err: any) {
        console.error('\n❌ INTEGRATION SUITE FAILURE:', err.message || err);
        process.exit(1);
    }
}

if (require.main === module) {
    runAllIntegrationTests().catch((err) => {
        console.error('Fatal test error:', err);
        process.exit(1);
    });
}
