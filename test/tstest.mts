import { Database } from "duckdb-async";

async function simpleTest() {
    const db = await Database.create(":memory:");
    const rows = await db.all("select * from range(1,10)");
    console.log(rows);
}

simpleTest();