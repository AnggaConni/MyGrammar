const CACHE='mygrammar-runtime';
const CORE_ASSETS=[
  './','./index.html','./Toefl.html','./Document.html',
  './style.css','./grammar-engine.js','./app.js','./toefl.js','./document.js',
  './manifest.json','./vendor/harper.bundle.js','./vendor/mammoth.bundle.js',
  './data/grammar_rules.json','./data/tenses.json','./data/common_errors.json',
  './data/contractions.json','./data/verbs.json','./data/verb_patterns.json','./data/learner_errors_id.json','./data/samples.json',
  './data/external/languagetool_runtime.json'
];

self.addEventListener('install',function(event){
  event.waitUntil(
    caches.open(CACHE).then(function(cache){
      return Promise.all(
        CORE_ASSETS.map(function(asset){
          return cache.add(asset).catch(function(error){
            console.warn('Precache skipped:',asset,error);
          });
        })
      );
    }).then(function(){
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate',function(event){
  event.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(
        keys.filter(function(key){return key!==CACHE;}).map(function(key){
          return caches.delete(key);
        })
      );
    }).then(function(){
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch',function(event){
  if(event.request.method!=='GET')return;

  event.respondWith(
    fetch(event.request).then(function(response){
      if(response && response.ok){
        const copy=response.clone();
        caches.open(CACHE).then(function(cache){
          cache.put(event.request,copy);
        });
      }
      return response;
    }).catch(function(){
      return caches.match(event.request).then(function(cached){
        if(cached)return cached;
        if(event.request.mode==='navigate'){
          return caches.match('./index.html');
        }
        return Response.error();
      });
    })
  );
});
