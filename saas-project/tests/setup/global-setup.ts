import type { TestProject } from 'vitest/node';
import { prepareTestDatabase } from './prepare-test-database';

export default async function setup(project: TestProject) {
	const testUrl = project.config.env.DATABASE_URL;
	if (!testUrl) throw new Error('The test DATABASE_URL is not set');

	await prepareTestDatabase(testUrl);
}
