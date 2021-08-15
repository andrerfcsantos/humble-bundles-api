# Humble Bundles API

API the provides information about the bundles available at [humblebundle.com](https://www.humblebundle.com/bundles).

The information in the API is collected periodically using [Playwright](https://playwright.dev/).

## Features

* `/bundles` - JSON endpoint that provides information about the currently available bundles.

## Usage

Right now the API has just one endpoint, which can be visited here:

* [https://humble.asantosdev.com/bundles](https://humble.asantosdev.com/bundles)

## Installation

Use these steps if you want to run this API on your own server/machine.

### Requirements

* Node 14+

### Buld & Run

* Clone the repo
* Change directory into the repo folder
* Install the dependencies:
  * `npm install`
  * On Ubuntu systems: `npx playwright install-deps chromium`
  * `npx playwright install chromium`
* Serve the API:
  * `node api.js`
  
By default, this runs the API on port `3200`.


## LICENSE

MIT License