#!/usr/bin/env node
/* Download all publication metadata from UGent Biblio.
   ©2014 Ruben Verborgh */

var https = require('https'),
    spawn = require('child_process').spawn;

var sitemaps = ['https://biblio.ugent.be/siteindex.xml'], publications = [];
var blankId = 0;

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
  download(publications.shift() + '.rdf', function (publication) {
    // Assign URLs to authors
    publication = publication.replace(/<bibo:authorList[^]+?<\/bibo:authorList>/, function (authorList) {
      var authors = [];
      return authorList.replace(/<rdf:Description>[^]+?<\/rdf:Description>/g, function (author) {
        var publicationsUrl = author.match(/\/person\/\d+/), authorId;
        if (publicationsUrl) {
          authorId = publicationsUrl + '#person';
          authors.push('rdf:resource="' + authorId + '"');
          return author.replace('>', ' rdf:about="' + authorId + '">');
        }
        else {
          authorId = 'b' + ++blankId;
          authors.push('rdf:nodeID="' + authorId + '"');
          return author.replace('>', ' rdf:nodeID="' + authorId + '">');
        }
      }) + '\n' +
      // Add dcterms:creator statement for each author
      authors.map(function (author) {
        return '        <dcterms:creator ' + author + '/>';
      }).join('\n');
    });

    // Convert RDF/XML into Turtle with cwm
    var cwm = spawn('cwm', ['--rdf', '--n3=pq'], { stdio: ['pipe', process.stdout, process.stderr] });
    cwm.on('exit', extractNextPublication);
    cwm.on('error', function () { console.error('cwm execution failed; is cwm installed?'); });
    cwm.stdin.end(publication, 'utf8');
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
