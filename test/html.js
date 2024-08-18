"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var duckdb_async_1 = require("duckdb-async");
var DOM = require("cheerio");
var fs_1 = require("fs");
///////////// CONFIGURATION
var URL = "https://store.steamchina.com/search/results/?infinite=1";
var DB_PATH = "steam.ddb";
var ISONLINE = false;
///////////// CONNECT DATABASE
var db = await duckdb_async_1.Database.create(DB_PATH);
///////////// INIT TABLES
// 查看是否有表 没表创表 has table? create table when not exist table.
while ((await db.all("SELECT table_name FROM information_schema.tables WHERE table_name = 'games';")).length == 0) {
    // https://duckdb.org/docs/sql/data_types/list#updating-lists
    // Updates on lists are internally represented as an insert and a delete operation.
    // Therefore, updating list values may lead to a duplicate key error on primary/unique keys.
    // 目前duckdb不支持对嵌套类型的更新操作,与主键约束冲突,故不声明主键和非空
    await db.run("\n         CREATE TABLE main.games (\n              uuid    SIGNED not null\n                   constraint games_pk\n                        primary key,\n              name    STRING,\n              img     STRING,\n              imgsrc     STRING,\n              platform_win BOOLEAN,\n              platform_music BOOLEAN,\n              release_date DATE,\n              original_price USMALLINT,\n              final_price USMALLINT,\n              pct_price INT1,\n              bundled_is_count INT1,\n              price_label TEXT,\n              review TINYINT, -- -1 negative, 0 mixed, 1 positive\n              review_label TEXT,\n              steam_deck_support BOOLEAN\n         );\n    ").catch(function (err) { return console.error(err); });
}
while ((await db.all("SELECT * FROM information_schema.schemata WHERE schema_name = 'apps';")).length == 0)
    await db.run("CREATE SCHEMA apps;").catch(function (err) { return console.error(err); });
///////////// UPDATE DATA
function operate_app_list(uuid, name, img, platform_win, platform_music, release_date, original_price, final_price, pct_price, bundled_is_count, price_label, review, review_label, steam_deck_support) {
    db.prepareSync("\n          INSERT INTO main.games (uuid, name, img, imgsrc, platform_win, platform_music, release_date, original_price, final_price, pct_price,\n                                  bundled_is_count, price_label, review, review_label, steam_deck_support)\n          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)\n          ON CONFLICT (uuid) DO UPDATE SET\n               name = EXCLUDED.name,\n               img = EXCLUDED.img,\n               imgsrc = EXCLUDED.imgsrc,\n               platform_win = EXCLUDED.platform_win,\n               platform_music = EXCLUDED.platform_music,\n               release_date = EXCLUDED.release_date,\n               original_price = EXCLUDED.original_price,\n               final_price = EXCLUDED.final_price,\n               pct_price = EXCLUDED.pct_price,\n               bundled_is_count = EXCLUDED.bundled_is_count,\n               price_label = EXCLUDED.price_label,\n               review = EXCLUDED.review,\n               review_label = EXCLUDED.review_label;\n               steam_deck_support = EXCLUDED.steam_deck_support;\n     ").runSync(uuid, name, img[0], img[1], platform_win, platform_music, release_date, original_price, final_price, pct_price, bundled_is_count, price_label, review, review_label, steam_deck_support)
        .finalize().catch(function (err) { return console.error(err); });
}
// operate_app_list(535930, '双点医asfeawdwadf院',['234234','324234234'],true, true, new Date(),0, 3960, 80,0, 'asdd',1, 'asdsad');
///////////// GET STEAM WBESITE API
var $ = DOM.load(ISONLINE ? (await fetch(URL).then(function (res) { return res.json(); }).catch(function (err) { return console.error(err); })).results_html
    : fs_1.default.readFileSync("results.html", "utf8"));
// 新鲜的依托答辩 纪念一下这个垃圾代码
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
for (var _i = 0, _a = $("a.search_result_row"); _i < _a.length; _i++) {
    var el = _a[_i];
    var $el = $(el);
    // 绑定新元素，不出for作用域
    $ = DOM.load(el);
    var uuid = parseInt($el.attr("data-ds-appid"));
    var steamdeck = $el.attr("data-ds-steam-deck-compat-handled") === "true";
    var $img = $("div.search_capsule > img");
    var img = [$img.attr("src"), $img.attr("srcset")];
    var name_1 = $("div.search_name > span.title").text();
    for (var _b = 0, _c = $("div.search_name > div > span.platform_img"); _b < _c.length; _b++) {
        var el_1 = _c[_b];
        var a = $(el_1).attr("class").split(' ');
        console.log(a);
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
//          - span search_review_summary.(positive|mixed|negative) data-tooltip-html=text(&lt;br&gt;)text
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
// console.log(await db.all("SELECT * FROM games"));
///////////// CLOSE DATABASE
db.close();
