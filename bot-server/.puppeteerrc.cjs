const { join } = require('path');

module.exports = {
  cacheDirectory: join(process.env.HOME || '/opt/render', '.cache', 'puppeteer'),
  skipDownload: false,
};