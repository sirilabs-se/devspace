// Makes an existing account an admin. The first admin can't be made from
// inside the app, because only an admin may do that.
//
// Usage: npm run admin:grant -- person@example.com
import pg from 'pg';

const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
	console.error('Usage: npm run admin:grant -- person@example.com');
	process.exit(1);
}
if (!process.env.DATABASE_URL) {
	console.error('DATABASE_URL is not set. Run this from the project folder, where .env is.');
	process.exit(1);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
	const updated = await client.query(
		"update users set role = 'admin', updated_at = now() where email = $1 returning id, name",
		[email]
	);
	if (updated.rowCount === 0) {
		console.error(`No account has the email ${email}. Sign up with it first.`);
		process.exitCode = 1;
	} else {
		const [user] = updated.rows;
		await client.query(
			"insert into audit_events (subject_user_id, action, details) values ($1, 'admin_role_granted', $2)",
			[user.id, JSON.stringify({ by: 'command line' })]
		);
		console.log(`${user.name} <${email}> is now an admin. They may need to log in again.`);
	}
} finally {
	await client.end();
}
