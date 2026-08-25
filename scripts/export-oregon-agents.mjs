import mysql from "mysql2/promise";

const connection = await mysql.createConnection(process.env.DATABASE_URL);
const [rows] = await connection.execute(
  "SELECT id, fullName, brokerage, cityArea, phone, email, websiteBioUrl, zillowUrl, principalBrokerName, principalBrokerPhone, principalBrokerEmail, principalBrokerHeadshotUrl, realtrendsRank, realtrendsTotalSides, realtrendsVolume FROM agents WHERE state='Oregon' ORDER BY id",
);
process.stdout.write(JSON.stringify(rows));
await connection.end();
