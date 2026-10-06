let linter=null;
let findings=[];
let currentText='';
let currentDialect=localStorage.getItem('mygrammar-dialect')||'American';
let currentFilter='all';
let selectedIssue=-1;
let KB=null;

const textArea=document.getElementById('docText');
const results=document.getElementById('results');
const engineStat=document.getElementById('engineStat');
const issueStat=document.getElementById('issueStat');
const progressBar=document.getElementById('progressBar');

function esc(v){return String(v).replace(/[&<>"']/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'})[c];});}
function words(s){return s.trim()?s.trim().split(/\s+/).length:0;}
function updateStats(){
  const t=textArea.value;
  document.getElementById('wordStat').textContent=words(t)+' words';
  document.getElementById('charStat').textContent=t.length+' characters';
  document.getElementById('paraStat').textContent=(t.trim()?t.trim().split(/\n\s*\n/).length:0)+' paragraphs';
}
function updateHealth(){
  const counts={Grammar:0,Verb:0,Learner:0,Spelling:0,Style:0};
  findings.forEach(function(f){
    const c=f.category||'Style';
    if(c==='Grammar')counts.Grammar++;
    else if(c==='Verb'||c==='Verb pattern'||c==='Tense')counts.Verb++;
    else if(c==='Indonesian learner pattern'||c==='Learner pattern')counts.Learner++;
    else if(c==='Spelling')counts.Spelling++;
    else counts.Style++;
  });
  document.getElementById('healthGrammar').textContent=counts.Grammar;
  document.getElementById('healthVerb').textContent=counts.Verb;
  document.getElementById('healthLearner').textContent=counts.Learner;
  document.getElementById('healthSpelling').textContent=counts.Spelling;
  document.getElementById('healthStyle').textContent=counts.Style;
}
function normalizeText(s){return s.replace(/\u00a0/g,' ');}
function dialectEnum(name){return MyGrammarHarper.Dialect[name] ?? MyGrammarHarper.Dialect.American;}
function textFromSuggestion(s){
  if(s==null)return '';
  if(typeof s==='string')return s;
  if(typeof s.text==='string')return s.text;
  try{return String(s);}catch(e){return '';}
}
async function setupEngine(){
  if(!window.MyGrammarHarper)throw new Error('Harper bundle is missing.');
  linter=new MyGrammarHarper.WorkerLinter({
    binary:MyGrammarHarper.binaryInlined,
    dialect:dialectEnum(currentDialect)
  });
  if(linter.setup)await linter.setup();
  try{if(linter.getDefaultLintConfig)await linter.getDefaultLintConfig();}catch(e){}
  KB=await MyGrammarGrammarEngine.loadKnowledge();
  engineStat.textContent='Engine: Harper + MyGrammar • offline';
}
function dedupeFindings(list){
  const seen={};
  return list.filter(function(f){
    const key=f.start+'|'+f.end+'|'+String(f.suggestionText||'').toLowerCase();
    if(seen[key])return false;
    seen[key]=true;
    return true;
  }).sort(function(a,b){
    if(a.start!==b.start)return a.start-b.start;
    return (b.priority||0)-(a.priority||0);
  }).map(function(f,i){f.uid=i;return f;});
}
function mapHarperCategory(message){
  const m=String(message||'').toLowerCase();
  if(/spell|word|apostrophe|hyphen/.test(m))return 'Spelling';
  if(/style|readab|redund|verbose/.test(m))return 'Style';
  return 'Grammar';
}
async function checkDocument(){
  const raw=normalizeText(textArea.value);
  currentText=raw;
  updateStats();
  if(!raw.trim()){
    findings=[];selectedIssue=-1;issueStat.textContent='0 issues';updateHealth();
    results.innerHTML='<div style="padding:16px;color:#64748b;font-size:13px">Nothing to check yet.</div>';
    progressBar.style.width='0%';
    return;
  }
  if(raw.length>120000){
    results.innerHTML='<div class="ok-state" style="color:#92400e;background:#fffbeb;border-color:#fde68a">The document is longer than the recommended 120,000-character limit. Split it into sections for the most reliable result.</div>';
    return;
  }
  try{
    if(!linter||!KB)await setupEngine();
    progressBar.style.width='15%';
    results.innerHTML='<div style="padding:16px;color:#64748b;font-size:13px">Checking locally with two engines…</div>';
    const [harperLints,myIssues]=await Promise.all([
      linter.lint(raw,{language:'plaintext'}),
      Promise.resolve(MyGrammarGrammarEngine.analyze(raw,KB))
    ]);

    const unified=[];
    myIssues.forEach(function(issue){
      unified.push({
        start:issue.start,end:issue.end,wrong:issue.wrong,correct:issue.correct,
        message:issue.explanation||issue.title||'MyGrammar suggestion',
        category:issue.category==='LanguageTool'?'Grammar':issue.category||'Grammar',
        title:issue.title||'MyGrammar finding',source:'MyGrammar',
        safe:true,priority:issue.priority||100,suggestionText:issue.correct,issue:issue,
        reasoning:issue.reasoning||[]
      });
    });
    harperLints.forEach(function(lint,index){
      const span=lint.span();
      const suggestions=lint.suggestion_count()>0?lint.suggestions():[];
      const suggestionText=suggestions.length?textFromSuggestion(suggestions[0]):'';
      unified.push({
        start:span.start,end:span.end,wrong:raw.slice(span.start,span.end),
        correct:suggestionText,message:lint.message()||'Grammar or spelling issue',
        category:mapHarperCategory(lint.message()),title:'Harper finding',
        source:'Harper',safe:false,priority:40,suggestionText:suggestionText,
        suggestions:suggestions,index:index,lint:lint,reasoning:[]
      });
    });
    findings=dedupeFindings(unified);
    issueStat.textContent=findings.length+' issues';
    updateHealth();
    progressBar.style.width='100%';
    selectedIssue=findings.length?0:-1;
    renderFindings();
  }catch(error){
    console.error(error);
    findings=[];
    issueStat.textContent='0 issues';
    updateHealth();
    results.innerHTML='<div class="ok-state" style="color:#b91c1c;background:#fef2f2;border-color:#fecaca">The offline document engines could not complete the check. Try a shorter section or reload the page.</div>';
    progressBar.style.width='0%';
  }
}
function visibleFindings(){
  return findings.filter(function(f){
    return currentFilter==='all'||f.category===currentFilter||(currentFilter==='Verb'&&['Verb','Verb pattern','Tense'].indexOf(f.category)>=0)||(currentFilter==='Style'&&['Style','LanguageTool','Suggestion'].indexOf(f.category)>=0);
  });
}
function renderFindings(){
  const list=visibleFindings();
  if(!list.length){
    results.innerHTML=findings.length?'<div class="ok-state">✅ No findings in this filter.</div>':'<div class="ok-state">✅ No findings detected in this document.</div>';
    return;
  }
  results.innerHTML=list.map(function(f,i){
    const displayText=currentText.slice(f.start,f.end);
    const badge=f.safe?'<span class="badge safe">Safe fix</span>':'<span class="badge review">Review</span>';
    const source='<span class="badge">'+esc(f.source)+'</span>';
    const suggested=f.suggestionText?'<div class="result-snippet">Suggested: '+esc(f.suggestionText)+'</div>':'';
    const actions=[];
    if(f.safe&&f.correct)actions.push('<button class="apply" data-apply-my="'+f.uid+'">✓ Apply</button>');
    else if(f.source==='Harper'&&f.suggestions&&f.suggestions.length)actions.push('<button class="apply" data-apply-harper="'+f.uid+'">✓ Apply suggestion</button>');
    actions.push('<button data-go="'+f.uid+'">Go to</button>');
    return '<article class="result-item '+(f.safe?'safe':'review')+'"><div class="result-head"><h3>'+esc(f.title)+'</h3><div class="result-badges"><span class="badge">'+esc(f.category)+'</span>'+source+badge+'</div></div><p>'+esc(f.message)+'</p><div class="result-snippet">'+esc(displayText)+'</div>'+suggested+(actions.length?'<div class="result-actions">'+actions.join('')+'</div>':'')+'</article>';
  }).join('');
}
function selectIssue(uid){
  const f=findings.find(function(x){return x.uid===uid;});
  if(!f)return;
  selectedIssue=uid;
  textArea.focus();
  textArea.setSelectionRange(f.start,f.end);
  const visible=visibleFindings();
  const idx=visible.findIndex(function(x){return x.uid===uid;});
  if(idx>=0){
    const node=results.querySelectorAll('.result-item')[idx];
    if(node)node.scrollIntoView({block:'nearest'});
  }
}
async function applyFinding(f){
  if(!f)return;
  if(f.source==='MyGrammar'){
    currentText=currentText.slice(0,f.start)+f.correct+currentText.slice(f.end);
  }else if(f.source==='Harper'&&f.suggestions&&f.suggestions.length){
    try{currentText=await linter.applySuggestion(currentText,f.lint,f.suggestions[0]);}
    catch(e){
      const suggestion=textFromSuggestion(f.suggestions[0]);
      if(!suggestion)return;
      currentText=currentText.slice(0,f.start)+suggestion+currentText.slice(f.end);
    }
  }
  textArea.value=currentText;
  await checkDocument();
}
results.addEventListener('click',async function(e){
  const my=e.target.closest('[data-apply-my]'),harper=e.target.closest('[data-apply-harper]'),go=e.target.closest('[data-go]');
  if(my){await applyFinding(findings.find(function(f){return f.uid===Number(my.dataset.applyMy)}));}
  else if(harper){await applyFinding(findings.find(function(f){return f.uid===Number(harper.dataset.applyHarper)}));}
  else if(go){selectIssue(Number(go.dataset.go));}
});
document.querySelectorAll('.filter-btn').forEach(function(btn){btn.addEventListener('click',function(){
  document.querySelectorAll('.filter-btn').forEach(function(b){b.classList.remove('active')});
  btn.classList.add('active');currentFilter=btn.dataset.filter;renderFindings();
});});
function moveIssue(delta){
  const list=visibleFindings();
  if(!list.length)return;
  let idx=list.findIndex(function(f){return f.uid===selectedIssue;});
  if(idx<0)idx=delta>0?-1:list.length;
  idx=(idx+delta+list.length)%list.length;
  selectIssue(list[idx].uid);
}
document.getElementById('prevIssueBtn').addEventListener('click',function(){moveIssue(-1);});
document.getElementById('nextIssueBtn').addEventListener('click',function(){moveIssue(1);});
document.getElementById('checkBtn').addEventListener('click',checkDocument);
document.getElementById('dialectSelect').value=currentDialect;
document.getElementById('dialectSelect').addEventListener('change',async function(){
  currentDialect=this.value;localStorage.setItem('mygrammar-dialect',currentDialect);
  if(linter){try{await linter.setDialect(dialectEnum(currentDialect));}catch(e){console.warn(e);}}
  if(textArea.value.trim())await checkDocument();
});
document.getElementById('applyAllBtn').addEventListener('click',async function(){
  const safe=findings.filter(function(f){return f.safe&&f.correct;}).slice().sort(function(a,b){return b.start-a.start;});
  let text=currentText,boundary=Infinity;
  for(const f of safe){
    if(f.end>boundary)continue;
    text=text.slice(0,f.start)+f.correct+text.slice(f.end);boundary=f.start;
  }
  currentText=text;textArea.value=text;updateStats();await checkDocument();
});
document.getElementById('clearBtn').addEventListener('click',function(){
  textArea.value='';currentText='';findings=[];selectedIssue=-1;issueStat.textContent='0 issues';updateHealth();progressBar.style.width='0%';
  results.innerHTML='<div style="padding:16px;color:#64748b;font-size:13px">Paste text and click Check Document.</div>';
});
document.getElementById('copyBtn').addEventListener('click',async function(){
  await navigator.clipboard.writeText(textArea.value);this.textContent='✓ Copied';setTimeout(()=>this.textContent='Copy Text',1200);
});
document.getElementById('fileInput').addEventListener('change',function(){
  const file=this.files[0];if(!file)return;
  const reader=new FileReader();reader.onload=function(){textArea.value=String(reader.result||'');updateStats();};reader.readAsText(file);
});
textArea.addEventListener('input',updateStats);
updateStats();
setupEngine().catch(function(error){engineStat.textContent='Engine: unavailable';console.error(error);});