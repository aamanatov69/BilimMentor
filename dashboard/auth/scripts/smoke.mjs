const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

async function check(url, expectedStatuses = [200]) {
  const response = await fetch(url, { redirect: "manual" });
  if (!expectedStatuses.includes(response.status)) {
    throw new Error(
      `Smoke check failed for ${url}: expected ${expectedStatuses.join(",")}, got ${response.status}`,
    );
  }
  console.log(`OK ${response.status} ${url}`);
}

async function run() {
  await check(`${appUrl}/`, [200]);
  await check(`${appUrl}/login`, [200]);
  await check(`${appUrl}/register`, [200]);
  await check(`${apiUrl}/health`, [200]);
}

run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
