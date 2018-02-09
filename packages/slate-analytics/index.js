/* eslint-disable no-process-env */

const uuidGenerator = require('uuid/v4');
const {performance} = require('perf_hooks');
const clearConsole = require('react-dev-utils/clearConsole');
const rc = require('@shopify/slate-rc');
const axios = require('axios');
const prompt = require('./prompt');
const packageJson = require('./package.json');

async function init() {
  let config = rc.get() || rc.generate();

  if (process.env.NODE_ENV === 'test') {
    return config;
  }

  // Check if we need to ask for consent
  if (
    typeof config.tracking === 'undefined' ||
    config.trackingVersion < packageJson.trackingVersion
  ) {
    if (typeof config.tracking === 'undefined') {
      // If new user
      const answers = await prompt.forNewConsent();
      config = Object.assign({}, config, answers, {
        tracking: true,
        trackingVersion: packageJson.trackingVersion,
      });
      event('slate-analytics:new-user', config);
    } else {
      // If existing user an needs to update consent
      event('slate-analytics:renew-consent-prompt', config);
      const answers = await prompt.forUpdatedConsent();
      config = Object.assign({}, config, answers, {
        tracking: true,
        trackingVersion: packageJson.trackingVersion,
      });
      event('slate-analytics:renew-consent-true', config);
    }

    clearConsole();
    console.log(`Thanks for helping improve the Slate development experience!`);

    rc.update(config);
  }

  return config;
}

function event(name, payload = {}) {
  const config = rc.get();

  if (!config.tracking) {
    return Promise.resolve();
  }

  performance.mark(name);
  const mark = performance.getEntriesByName(name).pop();

  process.env.SLATE_PROCESS_ID =
    process.env.SLATE_PROCESS_ID || uuidGenerator();

  const axiosConfig = {
    params: Object.assign({}, payload, {
      event: name,
      id: process.env.SLATE_PROCESS_ID,
      uuid: config.uuid,
      performance: mark,
    }),
  };

  // eslint-disable-next-line no-process-env
  if (process.env.NODE_ENV === 'test') {
    axiosConfig.adaptor = settings => {
      return new Promise(resolve => {
        return resolve({
          data: {},
          status: 200,
          statusText: 'Sucess',
          headers: {},
          settings,
        });
      });
    };
  }

  return axios('https://v.shopify.com/slate/track', axiosConfig);
}

module.exports = {
  init,
  event,
};
