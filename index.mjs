import { Database } from "duckdb-async";
import * as DOM from "cheerio";
import fs from 'fs';
///////////// CONFIGURATION
const URL_CHINA = "https://store.steamchina.com/search/results/?infinite=1";
const URL_GLOBAL = "https://api.steamchina.com/ISteamApps/GetAppList/v2/";
const PARAMETER_STEP = 100;
const DB_PATH = "steam.ddb";
const ISONLINE = true;
const OFFLINE_HTML = "results.html";
const WARN_FINAL_PRICE = "[WARN] 数据提供不一致。final_price isnt equal";
const WARN_DISCOUNT_PCT = "[WARN] 数据提供不一致。discount_pct isnt equal";
// PCT: 0 不打折, 127 免费, -XX 正常折扣, XX 逆折扣, 126 没价格
// 100-124 数额加算(MAX价格655.35) => final_price = price % 65535 , pct = price // 65535 + 99, MAX价格15728.40
// 125 数额超标 > 15728.40(没打折) || > 655.35(打折)
// review: -1 差 0 半 1 好 -2 没评价
// 并发中心，所有执行完了才关闭连接
let async_queue = [];
///////////// FUNCTIONS
function selectTopNumber(...numbers) {
    // 创建Map 记录数字对应频率
    const frequencyMap = numbers.reduce((acc, i) => {
        if (acc[i] === undefined)
            acc[i] = 0;
        acc[i]++;
        return acc;
    }, {});
    // 转换为数组找出最大频率
    const maxFrequency = Math.max(...Object.keys(frequencyMap).map((i) => frequencyMap[parseInt(i)]));
    // 返回该频率对应数字
    const mostFrequentNumbers = Object.keys(frequencyMap).map(Number).filter(number => frequencyMap[number] === maxFrequency);
    return mostFrequentNumbers[0];
}
///////////// CONNECT DATABASE
let db = await Database.create(DB_PATH);
///////////// INIT TABLES
// 查看是否有表 没表创表 has table? create table when not exist table.
while ((await db.all("SELECT table_name FROM information_schema.tables WHERE table_name = 'apps';")).length == 0) {
    // https://duckdb.org/docs/sql/data_types/list#updating-lists
    // Updates on lists are internally represented as an insert and a delete operation.
    // Therefore, updating list values may lead to a duplicate key error on primary/unique keys.
    // 目前duckdb不支持对嵌套类型的更新操作,与主键约束冲突,故不声明主键和非空
    await db.run(`
         CREATE TABLE main.apps (
              uuid    SIGNED not null
                   constraint apps_pk
                        primary key,
              name    STRING,
              img     STRING,
              imgsrc     STRING,
              platform UTINYINT, -- 0b_0000_000:win_0:music
              release_date TEXT,
              original_price USMALLINT,
              final_price USMALLINT,
              pct_price INT1,
              bundled_is_count INT1,
              price_label TEXT,
              review TINYINT, -- -1 negative, 0 mixed, 1 positive
              review_label TEXT,
              steam_deck_support BOOLEAN,
              china BOOLEAN,
              update_date DATETIME
         );
    `).catch(err => console.error(err));
}
while ((await db.all("SELECT * FROM information_schema.schemata WHERE schema_name = 'apps';")).length == 0)
    await db.run("CREATE SCHEMA apps;").catch(err => console.error(err));
///////////// UPDATE DATA
let operate_app_list = (uuid, name, img, platform, release_date, original_price, final_price, pct_price, bundled_is_count, price_label, review, review_label, steam_deck_support, china, operate_date = new Date() // 异步访问，并发写入
) => db.prepareSync(`
    INSERT INTO main.apps (uuid, name, img, imgsrc, platform, release_date, original_price, final_price, pct_price,
                          bundled_is_count, price_label, review, review_label, steam_deck_support, china, update_date)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) -- UPSERT => POSTGRESQL
        ON CONFLICT (uuid) DO UPDATE SET
        name = EXCLUDED.name,
        img = EXCLUDED.img,
        imgsrc = EXCLUDED.imgsrc,
        platform = EXCLUDED.platform,
        release_date = EXCLUDED.release_date,
        original_price = EXCLUDED.original_price,
        final_price = EXCLUDED.final_price,
        pct_price = EXCLUDED.pct_price,
        bundled_is_count = EXCLUDED.bundled_is_count,
        price_label = EXCLUDED.price_label,
        review = EXCLUDED.review,
        review_label = EXCLUDED.review_label,
        steam_deck_support = EXCLUDED.steam_deck_support,
        china = EXCLUDED.china,
        update_date = EXCLUDED.update_date;
    `).runSync(uuid, name, img[0], img[1], platform, release_date, original_price, final_price, pct_price, bundled_is_count, price_label, review, review_label, steam_deck_support, china, operate_date)
    .finalize().catch(err => console.error(err));
///////////// GET STEAM WBESITE API
if (!ISONLINE)
    analyze_dom(DOM.load(fs.readFileSync(OFFLINE_HTML, "utf8")));
else {
    let step = 0, page = 1;
    let data = await fetch(`${URL_CHINA}&count=${PARAMETER_STEP}`).then(res => res.json()).catch(err => console.error(err));
    analyze_dom(DOM.load(data.results_html));
    while (page++ * 100 < data.total_count)
        // step += PARAMETER_STEP;
        // await fetch(`${URL_CHINA}&count=${PARAMETER_STEP}&start=${step}`).then(res => res.json()).catch(err => console.error(err));
        analyze_dom(DOM.load((await fetch(`${URL_CHINA}&count=${PARAMETER_STEP}&page=${page}`).then(res => res.json()).catch(err => console.error(err))).results_html));
}
// v1.0
// let $ = DOM.load(await (async c => {
//     if (c) {
//         return (await fetch(URL)
//             .then(res => res.json())
//             .catch(err => console.error(err))).results_html;
//     } else {
//         return fs.readFileSync("results.html", "utf8");
//     }
// })(ISONLINE));
///////////// ANALYZE DOM ELEMENTS
function analyze_dom($) {
    for (let el of $("a.search_result_row")) {
        let $el = $(el);
        // 绑定新元素，不出for作用域
        $ = DOM.load(el);
        let appid = $el.attr("data-ds-appid");
        if (!appid) {
            console.log(el);
            continue;
        }
        ;
        const uuid = parseInt(appid);
        const steamdeck = $el.attr("data-ds-steam-deck-compat-handled") === "true";
        const name = $(".search_name > .title").text().trim();
        const release_date = $(".search_released").text().trim();
        const china = true;
        let $img = $(".search_capsule > img");
        const img = [$img.attr("src").trim(), $img.attr("srcset").trim()];
        let platform = 0b0;
        for (let el of $(".search_name > div > .platform_img")) {
            switch ($(el).attr("class").split(' ')[1]) { // not undefined
                case "win":
                    platform |= 0b10;
                    break;
                case "music":
                    platform |= 0b01;
                    break;
            }
        }
        // 评价
        let review_label = "", review = 0;
        let $review = $(".search_reviewscore > .search_review_summary");
        if ($review.length > 0) { // 没有错误处理！注意！容易恐慌 please be panic!
            review_label = $review.attr("data-tooltip-html").trim();
            switch ($review.attr("class").split(' ')[1]) {
                case "positive":
                    review = 1;
                    break;
                case "mixed":
                    review = 0;
                    break;
                case "negative":
                    review = -1;
                    break;
                default: review = -2;
            }
        }
        // 价格
        let final_price = parseInt($(".search_price_discount_combined").attr("data-price-final").trim());
        let pct = parseInt($(".discount_pct").text().replaceAll('%', '').trim()), origin_price = 0, price_label = "", bundle = 0;
        if (isNaN(pct))
            pct = 0; // no discount
        else { // discount
            let n = parseInt($(".discount_original_price").text().replaceAll(/￥|¥|\./g, '').trim());
            if (!isNaN(n))
                origin_price = n;
            const $block = $(".search_discount_and_price > .discount_block");
            price_label = $block.attr("aria-label"); // 此处已对未定义行为作出处理，请**放心
            price_label === undefined ? "" : price_label.trim();
            bundle = parseInt($block.attr("data-bundlediscount").trim()); // 不可能有未定义行为
            // 发现错误
            let pct2 = -parseInt($block.attr("data-discount").trim());
            if (pct !== pct2)
                console.warn(WARN_DISCOUNT_PCT, pct, pct2);
            let final1 = parseInt($(".discount_final_price").text().replaceAll(/￥|¥|\./g, '').trim());
            let final2 = parseInt($block.attr("data-price-final").trim());
            if (final_price !== final1 || final_price !== final2) {
                console.warn(WARN_FINAL_PRICE, final_price, final1, final2);
                // 选择错误 选择最大值
                final_price = selectTopNumber(final1, final2, final_price);
                console.warn(WARN_FINAL_PRICE, "已选择", final_price);
            }
        }
        for (let el of $(".search_price_discount_combined > .search_discount_and_price"))
            if ($(el).children().length === 0)
                pct = 126; // no price
        if ($(".free").text().trim() !== "")
            final_price = 0, pct = 127; // free
        // price overflow
        if (final_price > 65535 || origin_price > 65535) {
            if (pct >= 0) {
                let sum_price = final_price;
                final_price = sum_price % 65535;
                sum_price = sum_price / 65535 + 99;
                pct = sum_price < 125 ? sum_price : 125; // [100,125)
            }
            else
                pct = 125;
            if (final_price > 65535)
                final_price = 65535;
            if (origin_price > 65535)
                origin_price = 65535;
        }
        // 异步写入数据库
        async_queue.push(operate_app_list(uuid, name, img, platform, release_date, origin_price, final_price, pct, bundle, price_label, review, review_label, steamdeck, china));
    }
}
// DOM :
// a.search_result_row data-ds-appid 游戏id data-ds-steam-deck-compat-handled steamos支持度>
//  div.search_capsule>img src srcset 封面适配
//  div.responsive_search_name_combined>
//      div.search_name>
//          span.title>text 名字
//          div>
//              span.platform_img.win
//              span.platform_img.music
//      div.search_released>
//          - text 日期
//          - NULL
//          - 即将推出
//      div.search_reviewscore>
//          - span.search_review_summary.(positive|mixed|negative) data-tooltip-html=text(&lt;br&gt;)text
//          - NULL
//      div.search_price_discount_combined data-price-final=xx.xx>
//          || div.discount_block no_discount search_discount_block
//          div.search_discount_and_price>
//              - NULL
//              - div.discount_block.search_discount_block data-price-final=xx.xx价格 data-bundlediscount=xx捆绑折扣 data-discount=xx%折扣 aria-label=立省...>
//                  div.discount_pct>text -80%
//                  div.discount_prices>
//                      [div.discount_original_price>text 原价]
//                      - div.discount_final_price>
//                          - text 现价
//                          - div+div> text 您的现价
//                      - div.discount_final_price.free> text 免费
//              - div.no_discount.discount_block.search_discount_block 同上>
// console.log(await db.all("SELECT * FROM apps"));
///////////// WAIT ASYNC CLOSE DATABASE
await Promise.all(async_queue);
db.close();
