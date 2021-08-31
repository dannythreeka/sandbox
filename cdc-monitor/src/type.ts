export type CdcRssFeed = {
  guid: { "#text": string; isPermaLink: boolean };
  link: string;
  title: string;
  description: string;
  "a10:updated": string;
};

export type CdcRssObject = {
  rss: {
    "xmlns:a10": string;
    version: number;
    channel: {
      title: string;
      link: string;
      description: string;
      item: [CdcRssFeed];
    };
  };
};
