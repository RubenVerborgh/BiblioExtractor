#!/usr/bin/env node
/* Download all publication metadata from UGent Biblio.
   ©2014 Ruben Verborgh */

var https = require('https'),
    spawn = require('child_process').spawn;

var sitemaps = ['https://biblio.ugent.be/siteindex.xml'], publications = [];

console.log('@base <https://biblio.ugent.be/>.');
parseNextSitemap();

// Parses the next sitemap into sitemap URLs and publication URLs
function parseNextSitemap() {
  var sitemapUrl = sitemaps.shift();
  if (!sitemapUrl) return;
  console.error('Processing', sitemapUrl);

  // Download the sitemap
  download(sitemapUrl, function (sitemap) {
    var urlMatcher = /<loc>\s*([^>]+)\s*<\/loc>/g, url;
    while ((url = urlMatcher.exec(sitemap)) && (url = url[1]))
      (/\.xml$/.test(url) ? sitemaps : publications).push(url);
    extractNextPublication();
  });
}

// Outputs the next publication in Turtle format
function extractNextPublication() {
  // Parse another sitemap if no publications are left
  if (!publications.length)
    return parseNextSitemap();

  // Download an RDF/XML representation of the publication metadata
  https.get(publications.shift() + '.rdf', function (response) {
    if (response.statusCode !== 200) {
      console.error('Could not download', url, response.statusCode);
      return extractNextPublication();
    }

    // Convert RDF/XML into Turtle with cwm
    var cwm = spawn('cwm', ['--rdf', '--n3=pq'], { stdio: ['pipe', process.stdout, process.stderr] });
    response.pipe(cwm.stdin);
    cwm.on('exit', extractNextPublication);
    cwm.on('error', function () { console.error('cwm execution failed; is cwm installed?'); });
  });
}

// Downloads a representation of the given resource, sending its body through the callback
function download(url, callback) {
  https.get(url, function (response) {
    var body = '';
    response.setEncoding('utf8');
    response.on('data', function (chunk) { body += chunk; });
    response.on('end', function () { callback(body); });
  });
}
