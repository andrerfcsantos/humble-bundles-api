import { chromium } from "playwright";
import _ from "lodash";
import dayjs from "dayjs";

const BASE_URL = "https://www.humblebundle.com";
const BUNDLES_URL = `${BASE_URL}/bundles`;

function toTitleCase(str) {
  return str.replace(/\w\S*/g, function (txt) {
    return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
  });
}

async function get_bundle_metadata(page) {
  let humble_logo = await page.$("img.bundle-logo");

  let logo_url = await humble_logo.getAttribute("src");
  let logo_alt = await humble_logo.getAttribute("alt");

  let headline_elem = await page.$(".heading-medium");
  let headline = (await headline_elem.innerText()).trim();

  let description_elem = await page.$(".marketing-blurb");
  let description = (await description_elem.innerText()).trim();

  let fact_elems = await page.$$(".fact .fine-print");

  let facts = await Promise.all(fact_elems.map((f) => f.innerText()));

  let raised_elem = await page.$(".charity-amount-raised");
  let raised_text = (await raised_elem.innerText()).trim();

  const raised_regex = /This bundle has raised ([\d\.€$, ]*) for charity!/gm;
  let raised_match = raised_regex.exec(raised_text);
  let raised = raised_match ? raised_match[1] : NaN;

  let value_elem = await page.$(".pwyw-view .heading-medium");
  let value_text = (await value_elem.innerText()).trim();
  const value_regex = /^([\d\.€$, ]*) Value.*/gm;
  let value_match = value_regex.exec(value_text);
  let value = value_match ? value_match[1] : NaN;

  let json_elem = await page.$("script[type='application/ld+json']");
  let json_txt = (await json_elem.innerText()).trim();
  let cleanJSON = json_txt.replace(/,\s+\"url\": \"\/\" \+ basic_data\.page_url/gm,"");
  let info = JSON.parse(cleanJSON);
  let ends_at = info.offers.availabilityEnds + "Z";

  return {
    logo_url,
    logo_alt,
    headline,
    description,
    raised,
    value,
    facts,
    ends_at,
  };
}

async function get_page_items(page) {
  let title_elems = await page.$$(".js-tier-collection .item-title");
  let items = [];
  for (let title_elem of title_elems) {
    let title = await title_elem.innerText();
    items.push(title);
  }
  return items;
}

async function multi_tier_info(page, filters) {
  let tiers = [];

  for (let filter of filters) {
    let tier = {};

    await filter.click();
    await page.waitForLoadState();

    const tier_title_regex = /(\d+) Item Bundle/gm;
    let tier_title = await filter.innerText();
    tier_title = tier_title.trim().replace("Entire ", "");
    let title_match = tier_title_regex.exec(tier_title);
    if (title_match == undefined) continue;
    tier_title_regex.lastIndex = 0;
    tier.n_items = Number.parseInt(title_match[1]);

    const bundle_regex =
      /Pay (at least|more than the average of) ([\d\.€$ ]*)/gm;
    let tier_header = await page.waitForSelector(".tier-header");
    let header = await tier_header.innerText();
    let header_match = bundle_regex.exec(header);
    if (header_match == undefined) continue;
    bundle_regex.lastIndex = 0;
    tier.price = header_match[2].trim();

    let items = await get_page_items(page);
    while (items.length != tier.n_items) {
      await page.waitForTimeout(50);
      items = await get_page_items(page);
    }

    tier.items = items;
    tiers.push(tier);
  }

  return tiers;
}

async function single_tier_info(page) {
  const bundle_regex =
    /Pay (at least|more than the average of) ([\d\.€$ ]*) for these (\d+) items/gm;

  let info = {};

  let tier_header = await page.waitForSelector(".tier-header");
  let header = await tier_header.innerText();
  let header_match = bundle_regex.exec(header);
  if (header_match == undefined) return [];
  bundle_regex.lastIndex = 0;
  info.n_items = Number.parseInt(header_match[3]);
  info.price = header_match[2].trim();
  info.items = await get_page_items(page);

  return [info];
}

async function process_bundle(context, bundle) {
  let page = await context.newPage();
  await page.goto(bundle.url);
  await page.waitForLoadState();

  let filters = await page.$$(".tier-filters a");

  let tiers =
    filters.length > 0
      ? await multi_tier_info(page, filters)
      : await single_tier_info(page);

  let metadata = await get_bundle_metadata(page);

  await page.close();
  return { ...bundle, ...metadata, tiers };
}

async function process_bundles(context, bundles) {
  return Promise.all(bundles.map((bundle) => process_bundle(context, bundle)));
}

export async function fetch_bundles() {

  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext();
    const bundles_page = await context.newPage();
    await bundles_page.goto(BUNDLES_URL, { waitUntil: "load" });

    let category_elems = await bundles_page.$$(".landing-mosaic-section > h3");
    let categories = [];

    for (let elem of category_elems) {
      categories.push((await elem.innerText()).toLowerCase());
    }

    let category_bundles = {};
    for (let category of categories) {
      let info_sections = await bundles_page.$$(
        `h3:has-text('${category}') + section .info-section`
      );
      category_bundles[category] = [];
      for (let info_section of info_sections) {
        let url = await info_section.getAttribute("href");
        url = `${"https://www.humblebundle.com"}${url.split("?")[0]}`;

        let name_elem = await info_section.$(".name");
        let name = toTitleCase(await name_elem.innerText());
        category_bundles[category].push({ url, name });
      }
    }

    let cat_promises = Object.keys(category_bundles).map((cat) => process_bundles(context, category_bundles[cat]));
    let infos = await Promise.all(cat_promises);

    let bundle_infos = {};
    _.zip(Object.keys(category_bundles), infos).forEach(([cat_name, bundles]) => {
      bundle_infos[cat_name] = bundles;
    });
    await browser.close();
    return { lastUpdated: dayjs.utc().format(), bundles: bundle_infos };
  } catch (e) {
    await browser.close();
    throw e
  }

}

export default {
  fetch_bundles,
};
