import { getCdcData, isToday, postMessageSlack } from "./helper";
import { CdcRssObject } from "./type";

async function run() {
  const result = await getCdcData();
  if (result) {
    const allNews = result.rss.channel.item;
    const todayNews = allNews.filter((item) =>
      isToday(new Date(item["a10:updated"]))
    );

    if (todayNews) {
      Promise.all(todayNews.map(async (news) => await postMessageSlack(news)));
    }
  }
}

run();
