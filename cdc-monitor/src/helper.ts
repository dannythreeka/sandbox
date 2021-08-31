import dayjs, { OpUnitType } from "dayjs";
import * as rp from "request-promise";
import parser from "fast-xml-parser";
import { CdcRssFeed, CdcRssObject } from "./type";

export async function getCdcData(): Promise<CdcRssObject | undefined> {
  const options = {
    url: "https://www.cdc.gov.tw/RSS/RssXml/Hh094B49-DRwe2RR4eFfrQ?type=1",
    method: "GET",
  };

  try {
    const apiResult = await rp.get(options);
    const result: CdcRssObject = parser.parse(apiResult, {
      parseAttributeValue: true,
      ignoreAttributes: false,
      allowBooleanAttributes: true,
      attributeNamePrefix: "",
    });
    // console.log(JSON.stringify(result, null, 2));
    return result;
  } catch (err) {
    console.error(`ERROR: ${err}`);
    return undefined;
  }
}

export function isToday(date: Date): boolean {
  const timeZone = "Asia/Taipei";
  return dayjs(new Date()).isSame(dayjs(date), "day");
}

export async function postMessageSlack(news: CdcRssFeed) {
  const message = `<${news.link}|詳細內容>`;
  const payload = {
    text: news.title,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: news.title,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: message,
        },
      },
    ],
    icon_emoji: ":ghost:",
    username: "Mr. Nice Guy",
  };
  const options = {
    url: process.env.SLACK_URL!,
    method: "POST",
    form: JSON.stringify(payload),
    json: true,
  };
  try {
    await rp.post(options);
  } catch (error) {
    console.error(`ERROR: ${error}`);
  }
}
