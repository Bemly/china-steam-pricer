const fs = require('fs');

// 同步读取
try {
    const data = fs.readFileSync('api.steamchina.com.json', 'utf8');
    const obj = JSON.parse(data);
    let MAX = 0, COUNT = 0;
    for (const a of obj.applist.apps) {
        if (a.appid > MAX) MAX = a.appid;
        COUNT++;
    }
    console.log(MAX);
    console.log(COUNT);
    console.log(obj.applist.apps.length);
    console.log()
} catch (err) {
    console.error(err);
}
