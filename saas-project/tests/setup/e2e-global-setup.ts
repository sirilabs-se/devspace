import { prepareTestDatabase } from './prepare-test-database';
import { testDatabaseUrl } from './test-env.js';

export default async function setup() {
	await prepareTestDatabase(testDatabaseUrl(process.env));
}
