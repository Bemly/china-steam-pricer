// import { Database } from "duckdb-async";
// const db = await Database.create("test.ddd");
// // console.log(await db.all("SELECT * FROM date"));
// await db.prepareSync(`
//     INSERT INTO date (date)
//     VALUES (?)
// `).runSync(new Date()).finalize();

function selectTopNumber(...numbers: number[]): number {
    // 创建Map 记录数字对应频率
    const frequencyMap = numbers.reduce((acc, i) => {
        if (acc[i] === undefined) acc[i] = 0;
        acc[i]++;
        return acc;
    }, {} as {[ i: number]: number});
    // 转换为数组找出最大频率
    const maxFrequency = Math.max(...Object.keys(frequencyMap).map((i: string) => frequencyMap[parseInt(i)]));
    // 返回该频率对应数字
    const mostFrequentNumbers = Object.keys(frequencyMap).map(Number).filter(number => frequencyMap[number] === maxFrequency);
    return mostFrequentNumbers[0];
}
const a = selectTopNumber(1,2,2,3,4,5,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,1,3,2);
console.log(a.toString());