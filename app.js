let KB={rules:{},tenses:[],commonErrors:[],contractions:[],verbs:[],samples:[],loaded:false};
let issues=[]; let activeVerbFilter='all';

const input=document.getElementById('inputText');
const results=document.getElementById('results');
const statusEl=document.getElementById('liveStatus');
const countEl=document.getElementById('issueCount');
const summaryEl=document.getElementById('issueSummary');
const kbStatus=document.getElementById('kbStatus');

const FALLBACK={
  tenses:[{id:'present_simple',name:'Present Simple',formula:'Subject + V1 (He/She/It → V1+s/es)',signals:['every','usually','always','often','sometimes','never'],description:'Habits, routines, facts and repeated actions.'}],
  commonErrors:[],
  contractions:[{wrong:'wouldnt',correct:"wouldn't",category:'Spelling',formula:"wouldn't + V1",explanation:"The negative form of 'would' is written with an apostrophe: wouldn't."}],
  verbs:[
    {v1:'work',v2:'worked',v3:'worked',type:'regular',example:'I worked yesterday.'},
    {v1:'go',v2:'went',v3:'gone',type:'irregular',example:'I went to work.'},
    {v1:'write',v2:'wrote',v3:'written',type:'irregular',example:'She has written a report.'}
  ],
  samples:[]
};

function escapeHtml(v){return String(v).replace(/[&<>"']/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'})[c];});}
function timeout(ms){return new Promise(function(resolve){setTimeout(resolve,ms);});}
async function loadJSON(path,fallback){
  try{
    const response=await Promise.race([fetch(path,{cache:'no-store'}),timeout(3500).then(function(){throw new Error('timeout');})]);
    if(!response.ok)throw new Error(response.status);
    return await response.json();
  }catch(e){return fallback;}
}
async function loadKnowledge(){
  const data=await Promise.all([
    loadJSON('data/grammar_rules.json',{}),
    loadJSON('data/tenses.json',FALLBACK.tenses),
    loadJSON('data/common_errors.json',FALLBACK.commonErrors),
    loadJSON('data/contractions.json',FALLBACK.contractions),
    loadJSON('data/verbs.json',FALLBACK.verbs),
    loadJSON('data/samples.json',FALLBACK.samples)
  ]);
  KB.rules=data[0];KB.tenses=data[1];KB.commonErrors=data[2];KB.contractions=data[3];KB.verbs=data[4];KB.samples=data[5];KB.loaded=true;
  kbStatus.textContent='✓ Local knowledge loaded';
  renderVerbs();renderSamples();renderGuide();
}
function findExactRanges(text,needle){
  var out=[],start=0,source=text.toLowerCase(),target=needle.toLowerCase();
  while(true){
    var i=source.indexOf(target,start);if(i<0)break;
    out.push([i,i+needle.length]);start=i+needle.length;
  }return out;
}
function contractionIssues(text){
  var out=[];
  KB.contractions.forEach(function(rule){
    var re=new RegExp('\\b'+rule.wrong+'\\b','gi'),m;
    while((m=re.exec(text))){
      out.push({start:m.index,end:m.index+m[0].length,wrong:m[0],correct:rule.correct,title:rule.category||'Spelling',category:'Spelling',severity:'error',explanation:rule.explanation,formula:rule.formula||''});
    }
  });return out;
}
function commonErrorIssues(text){
  var out=[];
  KB.commonErrors.forEach(function(rule){
    findExactRanges(text,rule.wrong).forEach(function(r){
      out.push({start:r[0],end:r[1],wrong:text.slice(r[0],r[1]),correct:rule.correct,title:rule.category||'Common learner error',category:'Suggestion',severity:'error',explanation:rule.explanation,formula:rule.formula||''});
    });
  });return out;
}
function thirdPersonIssues(text){
  var out=[],re=/\b(he|she|it)\s+(go|do|have|watch|wash|fix|study|try|play|work|live|like|want|need|use|make|take|read|write)\b/gi,m;
  while((m=re.exec(text))){
    var b=m[2].toLowerCase(),f=b+'s';
    if(b==='go'||b==='do'||/(watch|wash|fix)$/.test(b))f=b+'es';
    else if(/[^aeiou]y$/.test(b))f=b.slice(0,-1)+'ies';
    out.push({start:m.index,end:m.index+m[0].length,wrong:m[0],correct:m[1]+' '+f,title:'Subject–verb agreement',category:'Grammar',severity:'error',explanation:'He/She/It normally takes the third-person singular form in the Present Simple.',formula:'He / She / It + V1 + s/es'});
  }return out;
}
function auxiliaryIssues(text){
  var out=[],rules=[{re:/\b(he|she|it)\s+don't\b/gi,r:"doesn't"},{re:/\b(i|you|we|they)\s+doesn't\b/gi,r:"don't"}];
  rules.forEach(function(rule){var m;while((m=rule.re.exec(text)))out.push({start:m.index,end:m.index+m[0].length,wrong:m[0],correct:m[1]+' '+rule.r,title:'Subject–auxiliary agreement',category:'Grammar',severity:'error',explanation:'The auxiliary must agree with the subject.',formula:'He/She/It + doesn\'t + V1 | I/You/We/They + don\'t + V1'});});
  return out;
}
function tenseIssues(text){
  var out=[],lower=text.toLowerCase();
  if(/\b(yesterday|last\s+\w+|\d+\s+days?\s+ago)\b/.test(lower)){
    var bad=text.match(/\b(he|she|it|i|we|they|you)\s+(go|come|see|eat|write|take|work|play|walk)\b/i);
    if(bad){
      var map={go:'went',come:'came',see:'saw',eat:'ate',write:'wrote',take:'took',work:'worked',play:'played',walk:'walked'};
      out.push({start:bad.index,end:bad.index+bad[0].length,wrong:bad[0],correct:bad[1]+' '+map[bad[2].toLowerCase()],title:'Past Simple',category:'Tense',severity:'error',explanation:'A completed past-time marker such as “yesterday” normally calls for the Past Simple.',formula:'Subject + V2'});
    }
  }return out;
}
function analyze(text){
  var list=commonErrorIssues(text).concat(contractionIssues(text),thirdPersonIssues(text),auxiliaryIssues(text),tenseIssues(text)),seen={};
  list=list.filter(function(i){var k=i.start+'|'+i.end+'|'+i.correct;if(seen[k])return false;seen[k]=true;return true;});
  list.sort(function(a,b){return a.start-b.start;});return list;
}
function suggestionHtml(issue,index){
  return '<article class="suggestion"><div class="suggestion-head"><span class="severity '+(issue.severity==='warn'?'warn':'error')+'">'+escapeHtml(issue.category)+'</span><h3>'+escapeHtml(issue.title)+'</h3></div><div class="comparison"><span class="wrong">'+escapeHtml(issue.wrong)+'</span> → <span class="correct">'+escapeHtml(issue.correct)+'</span></div><div class="explanation">'+escapeHtml(issue.explanation)+'</div>'+(issue.formula?'<div class="formula-box"><div class="formula-label">Grammar formula</div><div class="formula">'+escapeHtml(issue.formula)+'</div></div>':'')+'<div class="suggestion-actions"><button class="apply" data-apply="'+index+'">✓ Apply</button><button data-ignore="'+index+'">Ignore</button></div></article>';
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
document.querySelectorAll('.tab').forEach(function(btn){btn.addEventListener('click',function(){document.querySelectorAll('.tab').forEach(function(b){b.classList.remove('active')});document.querySelectorAll('.tab-panel').forEach(function(p){p.classList.remove('active')});btn.classList.add('active');document.getElementById('tab-'+btn.dataset.tab).classList.add('active');});});
function renderSamples(){
  var root=document.getElementById('sampleList');
  root.innerHTML=KB.samples.length?KB.samples.map(function(s,i){return '<article class="sample"><div><h3>'+escapeHtml(s.title||('Sample '+(i+1)))+'</h3><p class="sample-bad">❌ '+escapeHtml(s.wrong)+'</p><p class="sample-good">✅ '+escapeHtml(s.correct)+'</p><p>'+escapeHtml(s.explanation||'')+'</p></div><button data-sample="'+i+'">Load & Check</button></article>';}).join(''):'<div class="card" style="padding:18px">No samples loaded.</div>';
}
document.getElementById('sampleList').addEventListener('click',function(e){var b=e.target.closest('[data-sample]');if(!b)return;input.value=KB.samples[Number(b.dataset.sample)].wrong;document.querySelector('[data-tab="corrector"]').click();runCheck();input.focus();});
function renderVerbs(){
  var q=(document.getElementById('verbSearch').value||'').toLowerCase().trim();
  var filtered=KB.verbs.filter(function(v){var hit=activeVerbFilter==='all'||v.type===activeVerbFilter;var text=(v.v1+' '+v.v2+' '+v.v3+' '+(v.example||'')).toLowerCase();return hit&&(!q||text.indexOf(q)>=0);}).slice(0,200);
  document.getElementById('verbTable').innerHTML=filtered.map(function(v){return '<tr><td><strong>'+escapeHtml(v.v1)+'</strong></td><td>'+escapeHtml(v.v2)+'</td><td>'+escapeHtml(v.v3)+'</td><td class="type '+escapeHtml(v.type)+'">'+escapeHtml(v.type)+'</td><td>'+escapeHtml(v.example||'')+'</td></tr>';}).join('')||'<tr><td colspan="5">No verb found.</td></tr>';
}
document.getElementById('verbSearch').addEventListener('input',renderVerbs);
document.querySelectorAll('.verb-filter').forEach(function(btn){btn.addEventListener('click',function(){document.querySelectorAll('.verb-filter').forEach(function(b){b.classList.remove('active')});btn.classList.add('active');activeVerbFilter=btn.dataset.filter;renderVerbs();});});
function renderGuide(){
  var root=document.getElementById('grammarGrid');
  root.innerHTML=KB.tenses.map(function(t){return '<article class="grammar-card"><span class="eyebrow">TENSE</span><h3>'+escapeHtml(t.name)+'</h3><div class="grammar-formula">'+escapeHtml(t.formula)+'</div><p>'+escapeHtml(t.description||'')+'</p><div class="signal-list">'+(t.signals||[]).map(function(s){return '<span>'+escapeHtml(s)+'</span>';}).join('')+'</div></article>';}).join('');
}
loadKnowledge().then(runCheck);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('./sw.js').catch(function (error) {
      console.warn('Offline cache registration failed:', error);
    });
  });
}
