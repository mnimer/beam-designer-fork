import { runJdbcToJdbcTest } from './jdbc-to-jdbc.test';
import { runKafkaIoToKafkaIoTest } from './kafkaio-to-kafkaio.test';

export async function runAllIntegrationTests(): Promise<void> {
    console.log('======================================================');
    console.log('🚀 Starting All Apache Beam Pipeline Integration Tests');
    console.log('======================================================');

    try {
        await runJdbcToJdbcTest();
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
