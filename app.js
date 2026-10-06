let KB=MyGrammarGrammarEngine.defaultKnowledge();
let issues=[]; let activeVerbFilter='all';

const input=document.getElementById('inputText');
const results=document.getElementById('results');
const statusEl=document.getElementById('liveStatus');
const countEl=document.getElementById('issueCount');
const summaryEl=document.getElementById('issueSummary');
const kbStatus=document.getElementById('kbStatus');

function escapeHtml(v){return String(v).replace(/[&<>"']/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'})[c];});}

async function loadKnowledge(){
  KB=await MyGrammarGrammarEngine.loadKnowledge();
  const ltCount=MyGrammarGrammarEngine.trustedLanguageToolCount(KB);
  var verbCount=KB.verbs.length; var patternCount=KB.verbPatterns.length; var learnerCount=KB.learnerErrors.length;
  kbStatus.textContent='✓ Local knowledge loaded • '+verbCount+' verbs • '+patternCount+' verb patterns • '+learnerCount+' ID learner patterns • '+ltCount+' vetted LT';
  renderVerbs();
  renderSamples();
  renderGuide();
}

function analyze(text){
  return MyGrammarGrammarEngine.analyze(text,KB);
}

function suggestionHtml(issue,index){
  var reasoning=(issue.reasoning||MyGrammarGrammarEngine.buildReasoning(issue)).map(function(step,n){
    return '<li><span class="reasoning-number">'+(n+1)+'</span><span>'+escapeHtml(step)+'</span></li>';
  }).join('');
  return '<article class="suggestion"><div class="suggestion-head"><span class="severity '+(issue.severity==='warn'?'warn':'error')+'">'+escapeHtml(issue.category)+'</span><h3>'+escapeHtml(issue.title)+'</h3></div><div class="comparison"><span class="wrong">'+escapeHtml(issue.wrong)+'</span> → <span class="correct">'+escapeHtml(issue.correct)+'</span></div><div class="explanation">'+escapeHtml(issue.explanation)+'</div>'+(issue.formula?'<div class="formula-box"><div class="formula-label">Grammar formula</div><div class="formula">'+escapeHtml(issue.formula)+'</div></div>':'')+'<details class="reasoning-panel"><summary>💡 Why is this wrong?</summary><ol class="reasoning-steps">'+reasoning+'</ol></details><div class="suggestion-actions"><button class="apply" data-apply="'+index+'">✓ Apply</button><button data-ignore="'+index+'">Ignore</button></div></article>';
}
function renderIssues(){
  countEl.textContent=issues.length;summaryEl.textContent=issues.length?(issues.length+' suggestion'+(issues.length===1?'':'s')):'No suggestions';
  results.innerHTML=issues.length?issues.map(suggestionHtml).join(''):'<div class="empty-state">'+(input.value.trim()?'✅ No obvious rule-based problems found.':'Start typing. MyGrammar will explain what can be improved.')+'</div>';
}
function runCheck(){
  issues=analyze(input.value);statusEl.textContent=input.value.trim()?'Checked automatically':'Ready';renderIssues();
}
function schedule(){clearTimeout(window.__mt);statusEl.textContent='Checking…';window.__mt=setTimeout(runCheck,120);}
input.addEventListener('input',schedule);
document.getElementById('clearBtn').addEventListener('click',function(){input.value='';runCheck();input.focus();});
document.getElementById('exampleBtn').addEventListener('click',function(){input.value='I wouldnt mind marrying you. She go to the office every day.';runCheck();input.focus();});
results.addEventListener('click',function(e){
  var apply=e.target.closest('[data-apply]'),ignore=e.target.closest('[data-ignore]');
  if(apply){var i=Number(apply.dataset.apply),x=issues[i];if(!x)return;input.value=input.value.slice(0,x.start)+x.correct+input.value.slice(x.end);runCheck();input.focus();}
  if(ignore){issues.splice(Number(ignore.dataset.ignore),1);renderIssues();}
});
function activateTab(name){document.querySelectorAll('.nav-item').forEach(function(b){b.classList.toggle('active',b.dataset.tab===name)});document.querySelectorAll('.tab-panel').forEach(function(p){p.classList.remove('active')});var panel=document.getElementById('tab-'+name);if(panel)panel.classList.add('active');window.scrollTo({top:0,behavior:'smooth'});}
document.querySelectorAll('[data-tab]').forEach(function(btn){btn.addEventListener('click',function(){activateTab(btn.dataset.tab);});});
function renderSamples(){
  var root=document.getElementById('sampleList');
  root.innerHTML=KB.samples.length?KB.samples.map(function(s,i){return '<article class="sample"><div><h3>'+escapeHtml(s.title||('Sample '+(i+1)))+'</h3><p class="sample-bad">❌ '+escapeHtml(s.wrong)+'</p><p class="sample-good">✅ '+escapeHtml(s.correct)+'</p><p>'+escapeHtml(s.explanation||'')+'</p></div><button data-sample="'+i+'">Load & Check</button></article>';}).join(''):'<div class="card" style="padding:18px">No samples loaded.</div>';
}
document.getElementById('sampleList').addEventListener('click',function(e){var b=e.target.closest('[data-sample]');if(!b)return;input.value=KB.samples[Number(b.dataset.sample)].wrong;document.querySelector('[data-tab="corrector"]').click();runCheck();input.focus();});
function renderVerbs(){
  var q=(document.getElementById('verbSearch').value||'').toLowerCase().trim();
  var filtered=KB.verbs.filter(function(v){
    var hit=activeVerbFilter==='all'||v.type===activeVerbFilter;
    var patterns=KB.verbPatterns.filter(function(p){return Array.isArray(p.verbs)&&p.verbs.indexOf(v.v1)>=0;});
    var patternText=patterns.map(function(p){return p.title+' '+p.formula;}).join(' ');
    var text=(v.v1+' '+v.v2+' '+v.v3+' '+(v.example||'')+' '+patternText).toLowerCase();
    return hit&&(!q||text.indexOf(q)>=0);
  }).slice(0,200);
  document.getElementById('verbTable').innerHTML=filtered.map(function(v){
    var patterns=KB.verbPatterns.filter(function(p){return Array.isArray(p.verbs)&&p.verbs.indexOf(v.v1)>=0;});
    var badges=patterns.map(function(p){return '<span class="verb-pattern-chip">'+escapeHtml(p.kind==='gerund_after'?'V-ing':p.kind==='infinitive_after'?'to + V1':p.formula)+'</span>';}).join('');
    return '<tr><td><strong>'+escapeHtml(v.v1)+'</strong></td><td>'+escapeHtml(v.v2)+'</td><td>'+escapeHtml(v.v3)+'</td><td class="type '+escapeHtml(v.type)+'">'+escapeHtml(v.type)+'</td><td>'+escapeHtml(v.example||'')+'</td><td class="verb-patterns">'+(badges||'—')+'</td></tr>';
  }).join('')||'<tr><td colspan="6">No verb found.</td></tr>';
}
document.getElementById('verbSearch').addEventListener('input',renderVerbs);
document.querySelectorAll('.verb-filter').forEach(function(btn){btn.addEventListener('click',function(){document.querySelectorAll('.verb-filter').forEach(function(b){b.classList.remove('active')});btn.classList.add('active');activeVerbFilter=btn.dataset.filter;renderVerbs();});});
function renderGuide(){
  var root=document.getElementById('grammarGrid');
  root.innerHTML=KB.tenses.map(function(t){
    var ex=t.examples||{};
    return '<article class="grammar-card"><span class="eyebrow">TENSE</span><h3>'+escapeHtml(t.name)+'</h3><div class="grammar-formula">'+escapeHtml(t.formula)+'</div><p>'+escapeHtml(t.description||'')+'</p>'+
      '<div class="example-box">'+
        '<div class="formula-label">Examples</div>'+
        '<div class="example-line positive"><span class="example-label">Positive</span><span>✅ '+escapeHtml(ex.positive||'')+'</span></div>'+
        '<div class="example-line negative"><span class="example-label">Negative</span><span>❌ '+escapeHtml(ex.negative||'')+'</span></div>'+
        '<div class="example-line question"><span class="example-label">Question</span><span>❓ '+escapeHtml(ex.question||'')+'</span></div>'+
      '</div>'+
      '<div class="signal-list">'+(t.signals||[]).map(function(s){return '<span>'+escapeHtml(s)+'</span>';}).join('')+'</div>'+
    '</article>';
  }).join('');
}
var howToModal=document.getElementById('howToModal');
var howToBtn=document.getElementById('howToBtn');
var closeHowTo=document.getElementById('closeHowTo');
var closeHowToSecondary=document.getElementById('closeHowToSecondary');
var startCorrectorBtn=document.getElementById('startCorrectorBtn');
function openHowTo(){if(!howToModal)return;howToModal.hidden=false;document.body.style.overflow='hidden';}
function closeHowToModal(){if(!howToModal)return;howToModal.hidden=true;document.body.style.overflow='';}
if(howToBtn)howToBtn.addEventListener('click',openHowTo);
if(closeHowTo)closeHowTo.addEventListener('click',closeHowToModal);
if(closeHowToSecondary)closeHowToSecondary.addEventListener('click',closeHowToModal);
if(startCorrectorBtn)startCorrectorBtn.addEventListener('click',function(){closeHowToModal();activateTab('corrector');input.focus();});
if(howToModal)howToModal.addEventListener('click',function(e){if(e.target===howToModal)closeHowToModal();});
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&howToModal&&!howToModal.hidden)closeHowToModal();});

loadKnowledge().then(runCheck);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('./sw.js').catch(function (error) {
      console.warn('Offline cache registration failed:', error);
    });
  });
}
