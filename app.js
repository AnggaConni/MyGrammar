let KB={rules:{},tenses:[],commonErrors:[],contractions:[],verbs:[],samples:[],externalRules:[],commonWords:[],loaded:false};
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
  samples:[],
  externalRules:[],
  commonWords:[]
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
    loadJSON('data/samples.json',FALLBACK.samples),
    loadJSON('data/external/languagetool_runtime.json',{rules:[]}),
    loadJSON('data/external/common_words.json',{words:[]})
  ]);
  KB.rules=data[0];KB.tenses=data[1];KB.commonErrors=data[2];KB.contractions=data[3];KB.verbs=data[4];KB.samples=data[5];
  KB.externalRules=(data[6]&&Array.isArray(data[6].rules))?data[6].rules:[];
  KB.commonWords=(data[7]&&Array.isArray(data[7].words))?data[7].words:[];
  KB.loaded=true;
  const ltCount=KB.externalRules.filter(isTrustedLanguageToolRule).length;
  kbStatus.textContent='✓ Local knowledge loaded • '+ltCount+' vetted LanguageTool rules';
  renderVerbs();renderSamples();renderGuide();
}
const LANGUAGE_TOOL_TRUSTED_RULES=new Set([
  "POSSESSIVE_APOSTROPHE_2|\\beverybodies\\b|everybody's",
  "VICE_VERSA|vi[cs]e-(a-)?versa|vice versa",
  "SIGN_IN_HYPHEN|signs\\-in|signs in",
  "SIGN_IN_HYPHEN|signs\\-out|signs out",
  "SIGN_IN_HYPHEN|signed\\-in|signed in",
  "SIGN_IN_HYPHEN|signed\\-out|signed out",
  "SIGN_IN_HYPHEN|signing\\-in|signing in",
  "SIGN_IN_HYPHEN|signing\\-out|signing out",
  "YEARS_OLD|years\\-old|years old",
  "TOMFOOLERY|(tor?n|tomb?)-foolery|tomfoolery",
  "EN_QUOTES|„|“",
  "HYPOTHESIS_TYPOGRAPHY|H0|H₀",
  "HYPOTHESIS_TYPOGRAPHY|H1|H₁",
  "HYPOTHESIS_TYPOGRAPHY|H2|H₂",
  "HYPOTHESIS_TYPOGRAPHY|H3|H₃",
  "HYPOTHESIS_TYPOGRAPHY|H4|H₄",
  "HYPOTHESIS_TYPOGRAPHY|H5|H₅",
  "HYPOTHESIS_TYPOGRAPHY|H6|H₆",
  "HYPOTHESIS_TYPOGRAPHY|H7|H₇",
  "HYPOTHESIS_TYPOGRAPHY|H8|H₈",
  "HYPOTHESIS_TYPOGRAPHY|H9|H₉",
  "LANGUAGETOOL|language((?:[–\\-—]))tool|LanguageTool"
]);

function languageToolRuleKey(rule){
  return (rule.id||'')+'|'+(rule.regex||'')+'|'+(rule.suggestion||'');
}

function isTrustedLanguageToolRule(rule){
  return LANGUAGE_TOOL_TRUSTED_RULES.has(languageToolRuleKey(rule));
}

function buildReasoning(issue){
  if(issue.reasoning&&issue.reasoning.length)return issue.reasoning;
  const steps=[];
  if(issue.source==='LanguageTool'){
    steps.push('Source: LanguageTool English');
    if(issue.title)steps.push('Rule: '+issue.title);
    if(issue.explanation)steps.push('Why: '+issue.explanation);
    return steps;
  }
  if(issue.title)steps.push('Rule: '+issue.title);
  if(issue.formula)steps.push('Formula: '+issue.formula);
  if(issue.explanation)steps.push('Why: '+issue.explanation);
  steps.push('Detected: '+issue.wrong+' → '+issue.correct);
  return steps;
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
      out.push({start:m.index,end:m.index+m[0].length,wrong:m[0],correct:rule.correct,title:rule.category||'Spelling',category:'Spelling',severity:'error',priority:100,explanation:rule.explanation,formula:rule.formula||'',reasoning:['Word form: '+m[0]+' is missing the apostrophe.','Correct contraction: '+rule.correct,rule.explanation||'Use the standard contraction spelling.']});
    }
  });return out;
}
function externalLanguageToolIssues(text){
  var out=[];
  if(text.length>12000)return out;
  KB.externalRules.filter(isTrustedLanguageToolRule).slice(0,100).forEach(function(rule){
    try{
      var re=new RegExp(rule.regex,'gi'),m;
      while((m=re.exec(text))){
        if(!rule.suggestion || m[0]===rule.suggestion)continue;
        out.push({
          start:m.index,end:m.index+m[0].length,
          wrong:m[0],correct:rule.suggestion,
          title:rule.name||'LanguageTool rule',
          category:'LanguageTool',
          severity:'error',
          priority:45,
          explanation:rule.message||'LanguageTool grammar rule.',
          formula:'LanguageTool runtime rule',
          source:'LanguageTool',
          reasoning:[
            'Source: LanguageTool English',
            'Rule: '+(rule.name||rule.id||'Runtime rule'),
            'Why: '+(rule.message||'LanguageTool identified a likely language issue.'),
            'Correction: '+m[0]+' → '+rule.suggestion
          ]
        });
        if(out.length>=40)return;
      }
    }catch(e){}
  });
  return out;
}
function commonErrorIssues(text){
  var out=[];
  KB.commonErrors.forEach(function(rule){
    findExactRanges(text,rule.wrong).forEach(function(r){
      out.push({start:r[0],end:r[1],wrong:text.slice(r[0],r[1]),correct:rule.correct,title:rule.category||'Common learner error',category:'Suggestion',severity:'error',priority:105,explanation:rule.explanation,formula:rule.formula||'',reasoning:['Pattern: '+rule.wrong+' → '+rule.correct,'Grammar focus: '+(rule.formula||rule.category||'common learner error'),rule.explanation||'This is a frequent learner pattern.']});
    });
  });return out;
}
function thirdPersonIssues(text){
  var out=[],re=/\b(he|she|it)\s+(go|do|have|watch|wash|fix|study|try|play|work|live|like|want|need|use|make|take|read|write)\b/gi,m;
  while((m=re.exec(text))){
    var b=m[2].toLowerCase(),f=b+'s';
    if(b==='go'||b==='do'||/(watch|wash|fix)$/.test(b))f=b+'es';
    else if(/[^aeiou]y$/.test(b))f=b.slice(0,-1)+'ies';
    out.push({start:m.index,end:m.index+m[0].length,wrong:m[0],correct:m[1]+' '+f,title:'Subject–verb agreement',category:'Grammar',severity:'error',priority:110,explanation:'He/She/It normally takes the third-person singular form in the Present Simple.',formula:'He / She / It + V1 + s/es',reasoning:['Subject: '+m[1]+' = third-person singular','Tense: Present Simple','Rule: He / She / It + V1 + s/es','Verb: '+b+' → '+f]});
  }return out;
}
function auxiliaryIssues(text){
  var out=[],rules=[{re:/\b(he|she|it)\s+don't\b/gi,r:"doesn't"},{re:/\b(i|you|we|they)\s+doesn't\b/gi,r:"don't"}];
  rules.forEach(function(rule){var m;while((m=rule.re.exec(text)))out.push({start:m.index,end:m.index+m[0].length,wrong:m[0],correct:m[1]+' '+rule.r,title:'Subject–auxiliary agreement',category:'Grammar',severity:'error',priority:110,explanation:'The auxiliary must agree with the subject.',formula:'He/She/It + doesn\'t + V1 | I/You/We/They + don\'t + V1',reasoning:['Subject: '+m[1]+' determines the auxiliary','Negative Present Simple uses do/does + not','Correct form: '+m[1]+' '+rule.r+' + V1']});});
  return out;
}
function tenseIssues(text){
  var out=[],lower=text.toLowerCase();
  if(/\b(yesterday|last\s+\w+|\d+\s+days?\s+ago)\b/.test(lower)){
    var bad=text.match(/\b(he|she|it|i|we|they|you)\s+(go|come|see|eat|write|take|work|play|walk)\b/i);
    if(bad){
      var map={go:'went',come:'came',see:'saw',eat:'ate',write:'wrote',take:'took',work:'worked',play:'played',walk:'walked'};
      out.push({start:bad.index,end:bad.index+bad[0].length,wrong:bad[0],correct:bad[1]+' '+map[bad[2].toLowerCase()],title:'Past Simple',category:'Tense',severity:'error',priority:90,explanation:'A completed past-time marker such as “yesterday” normally calls for the Past Simple.',formula:'Subject + V2',reasoning:['Signal word: a completed past-time marker was detected','Tense: Past Simple','Formula: Subject + V2','Verb: '+bad[2]+' → '+map[bad[2].toLowerCase()]]});
    }
  }return out;
}
function analyze(text){
  var list=commonErrorIssues(text).concat(
    contractionIssues(text),
    thirdPersonIssues(text),
    auxiliaryIssues(text),
    tenseIssues(text),
    externalLanguageToolIssues(text)
  ),seen={};
  list=list.filter(function(i){
    var k=i.start+'|'+i.end+'|'+i.correct;
    if(seen[k])return false;
    seen[k]=true;
    return true;
  });
  list.forEach(function(i){i.reasoning=buildReasoning(i);});
  list.sort(function(a,b){
    var p=(b.priority||0)-(a.priority||0);
    return p||a.start-b.start;
  });
  return list;
}
function suggestionHtml(issue,index){
  var reasoning=(issue.reasoning||buildReasoning(issue)).map(function(step,n){
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
loadKnowledge().then(runCheck);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('./sw.js').catch(function (error) {
      console.warn('Offline cache registration failed:', error);
    });
  });
}
