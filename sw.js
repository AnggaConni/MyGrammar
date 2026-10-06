const CACHE='mygrammar-v6';
const ASSETS=[
  './','./index.html','./Toefl.html','./Document.html',
  './style.css','./grammar-engine.js','./app.js','./toefl.js','./document.js',
  './manifest.json','./vendor/harper.bundle.js',
  './data/grammar_rules.json','./data/tenses.json','./data/common_errors.json',
  './data/contractions.json','./data/verbs.json','./data/verb_patterns.json','./data/learner_errors_id.json','./data/samples.json',
  './data/external/languagetool_runtime.json'
];
self.addEventListener('install',function(event){
  event.waitUntil(caches.open(CACHE).then(function(cache){return cache.addAll(ASSETS);}));
});
self.addEventListener('fetch',function(event){
  event.respondWith(caches.match(event.request).then(function(cached){
    return cached||fetch(event.request).then(function(response){
      var copy=response.clone();caches.open(CACHE).then(function(cache){cache.put(event.request,copy);});
      return response;
    });
  }));
});
self.addEventListener('activate',function(event){
  event.waitUntil(caches.keys().then(function(keys){
    return Promise.all(keys.filter(function(key){return key!==CACHE;}).map(function(key){return caches.delete(key);}));
  }));
});