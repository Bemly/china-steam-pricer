const duckdb = require('duckdb');
const db = new duckdb.Database('test.ddb');
const con = db.connect();
con.run('CREATE TABLE a (i INTEGER)');
const stmt = con.prepare('INSERT INTO a VALUES (?)');
for (let i = 0; i < 10; i++) {
    stmt.run(i);
}
stmt.finalize();
con.all('SELECT * FROM a', function(err, res) {
    if (err) {
        console.warn(err);
    } else {
        console.log(res)
    }
});
db.close();