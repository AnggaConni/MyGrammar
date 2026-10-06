let linter=null;
let findings=[];
let currentText='';
let currentDialect=localStorage.getItem('mygrammar-dialect')||'American';
let currentFilter='all';
let selectedIssue=-1;
let KB=null;
let writingMode=localStorage.getItem('mygrammar-writing-mode')||'General';
let personalDictionary=loadDictionary();

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
  const counts={Grammar:0,Verb:0,Learner:0,Spelling:0};
  findings.forEach(function(f){
    const c=f.category||'';
    if(c==='Grammar'||c==='Tense')counts.Grammar++;
    else if(c==='Verb'||c==='Verb form'||c==='Verb pattern')counts.Verb++;
    else if(c==='Indonesian learner pattern'||c==='Learner pattern')counts.Learner++;
    else if(c==='Spelling')counts.Spelling++;
  });
  document.getElementById('healthGrammar').textContent=counts.Grammar;
  document.getElementById('healthVerb').textContent=counts.Verb;
  document.getElementById('healthLearner').textContent=counts.Learner;
  document.getElementById('healthSpelling').textContent=counts.Spelling;

  const stats=sentenceHealth(currentText,findings);
  document.getElementById('healthScore').textContent=stats.score;
  document.getElementById('healthScoreLabel').textContent=stats.label;
  document.getElementById('healthSentence').textContent=stats.count;
  document.getElementById('sentenceMeta').textContent=stats.avg.toFixed(1)+' words avg';
  document.getElementById('sentenceNote').textContent=stats.count
    ? 'Sentence Health: '+stats.label+'. Average '+stats.avg.toFixed(1)+' words/sentence; '+stats.long+' sentence(s) exceed 30 words; '+stats.issueDensity.toFixed(2)+' findings per sentence.'
    : 'Sentence Health will summarize average sentence length and long-sentence pressure after a check.';
}
function sentenceHealth(text,issues){
  const clean=String(text||'').trim();
  if(!clean)return {score:0,label:'waiting',count:0,avg:0,long:0,issueDensity:0};
  const sentences=clean.split(/(?<=[.!?])\s+/).filter(Boolean);
  const count=Math.max(1,sentences.length);
  const lens=sentences.map(function(s){return words(s);});
  const avg=lens.reduce(function(a,b){return a+b;},0)/count;
  const long=lens.filter(function(n){return n>30;}).length;
  const density=issues.length/count;
  const score=Math.max(0,Math.min(100,Math.round(100-Math.min(40,density*14)-Math.min(30,long*5)-Math.max(0,avg-22)*1.1)));
  const label=score>=90?'Excellent':score>=75?'Good':score>=60?'Needs review':'At risk';
  return {score:score,label:label,count:count,avg:avg,long:long,issueDensity:density};
}
function normalizeText(s){return String(s||'').replace(/\u00a0/g,' ');}
function dialectEnum(name){return MyGrammarHarper.Dialect[name] ?? MyGrammarHarper.Dialect.American;}
function textFromSuggestion(s){
  if(s==null)return '';
  if(typeof s==='string')return s;
  if(typeof s.text==='string')return s.text;
  try{return String(s);}catch(e){return '';}
}
function loadDictionary(){
  try{
    const value=JSON.parse(localStorage.getItem('mygrammar-personal-dictionary')||'[]');
    return Array.isArray(value)?value.filter(Boolean):[];
  }catch(e){return [];}
}
function saveDictionary(){
  localStorage.setItem('mygrammar-personal-dictionary',JSON.stringify(personalDictionary));
}
function dictionaryHas(value){
  const target=String(value||'').trim().toLowerCase();
  return target&&personalDictionary.some(function(item){return item.toLowerCase()===target;});
}
function renderDictionary(){
  const list=document.getElementById('dictionaryList');
  if(!list)return;
  list.innerHTML=personalDictionary.length
    ? personalDictionary.map(function(item,i){
        return '<span class="dictionary-chip">'+esc(item)+'<button type="button" data-dict-remove="'+i+'" aria-label="Remove '+esc(item)+'">×</button></span>';
      }).join('')
    : '<span style="font-size:10px;color:#94a3b8">No saved words yet.</span>';
}
function addToDictionary(value){
  const clean=String(value||'').trim();
  if(!clean)return;
  if(!personalDictionary.some(function(item){return item.toLowerCase()===clean.toLowerCase();})){
    personalDictionary.push(clean);
    personalDictionary.sort(function(a,b){return a.localeCompare(b);});
    saveDictionary();
  }
  renderDictionary();
}
function styleModeIssues(text,mode){
  const out=[];
  const rules={
    Academic:[
      {re:/\b(a lot of)\b/gi,to:'many',title:'Academic precision',message:'Academic writing often benefits from more precise quantifiers.',priority:28},
      {re:/\b(can't|cannot|don't|doesn't|didn't|won't|isn't|aren't|wasn't|weren't)\b/gi,toMap:{can't:'cannot',cannot:'cannot',don't:'do not',doesn't:'does not',didn't:'did not',won't:'will not',isn't:'is not',aren't:'are not',wasn't:'was not',weren't:'were not'},title:'Formal academic style',message:'Consider expanding the contraction in formal academic writing.',priority:26}
    ],
    Professional:[
      {re:/\bASAP\b/gi,to:'as soon as possible',title:'Professional tone',message:'Consider replacing shorthand with a clearer professional phrase.',priority:28},
      {re:/\b(a lot of)\b/gi,to:'many',title:'Professional precision',message:'Consider a more precise professional expression.',priority:25}
    ],
    Policy:[
      {re:/\bI think\b/gi,to:'the evidence suggests',title:'Policy-neutral phrasing',message:'Policy writing often benefits from evidence-led phrasing rather than personal opinion.',priority:28},
      {re:/\byou should\b/gi,to:'it is recommended that',title:'Policy recommendation',message:'Consider a more neutral recommendation structure for policy writing.',priority:27},
      {re:/\bwe need to\b/gi,to:'there is a need to',title:'Policy-neutral phrasing',message:'Consider a more institutional formulation.',priority:25}
    ],
    Email:[
      {re:/^\s*Hey\b/im,to:'Hello',title:'Formal email greeting',message:'Consider a more formal greeting for professional email.',priority:30},
      {re:/\bThanks a lot\b/gi,to:'Thank you',title:'Formal email tone',message:'Consider a more neutral closing or acknowledgement.',priority:26},
      {re:/\bASAP\b/gi,to:'as soon as possible',title:'Formal email tone',message:'Consider expanding shorthand in formal correspondence.',priority:27}
    ]
  };
  (rules[mode]||[]).forEach(function(rule){
    let m;
    while((m=rule.re.exec(text))){
      let replacement=rule.to;
      if(rule.toMap)replacement=rule.toMap[String(m[0]).toLowerCase()]||m[0];
      if(rule.re.ignoreCase&&m[0][0]===m[0][0].toUpperCase()&&replacement){
        replacement=replacement.charAt(0).toUpperCase()+replacement.slice(1);
      }
      out.push({
        start:m.index,end:m.index+m[0].length,wrong:m[0],correct:replacement,
        message:rule.message,title:rule.title,category:'Style',source:'Writing mode',
        safe:false,priority:rule.priority,suggestionText:replacement,reasoning:[
          'Writing mode: '+mode,
          'Style focus: '+rule.title,
          'Suggested wording: '+replacement
        ]
      });
    }
  });
  return out;
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
    if(dictionaryHas(f.wrong))return false;
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
    results.innerHTML='<div style="padding:16px;color:#64748b;font-size:13px">Checking locally with Harper + MyGrammar…</div>';
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
    unified.push.apply(unified,styleModeIssues(raw,writingMode));
    findings=dedupeFindings(unified);
    issueStat.textContent=findings.length+' issues';
    updateHealth();
    progressBar.style.width='100%';
    selectedIssue=findings.length?findings[0].uid:-1;
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
    return currentFilter==='all'||f.category===currentFilter||(currentFilter==='Verb'&&['Verb','Verb form','Verb pattern','Tense'].indexOf(f.category)>=0);
  });
}
function renderFindings(){
  const list=visibleFindings();
  if(!list.length){
    results.innerHTML=findings.length?'<div class="ok-state">✅ No findings in this filter.</div>':'<div class="ok-state">✅ No findings detected in this document.</div>';
    return;
  }
  results.innerHTML=list.map(function(f){
    const displayText=currentText.slice(f.start,f.end);
    const badge=f.safe?'<span class="badge safe">Safe fix</span>':'<span class="badge review">Review</span>';
    const source='<span class="badge">'+esc(f.source)+'</span>';
    const suggested=f.suggestionText?'<div class="result-snippet">Suggested: '+esc(f.suggestionText)+'</div>':'';
    const actions=[];
    if(f.safe&&f.correct)actions.push('<button class="apply" data-apply-my="'+f.uid+'">✓ Apply</button>');
    else if(f.source==='Harper'&&f.suggestions&&f.suggestions.length)actions.push('<button class="apply" data-apply-harper="'+f.uid+'">✓ Apply suggestion</button>');
    if(f.wrong&&f.wrong.trim())actions.push('<button data-dict-add="'+f.uid+'">📚 Add to dictionary</button>');
    actions.push('<button data-go="'+f.uid+'">Go to</button>');
    return '<article class="result-item '+(f.safe?'safe':'review')+'"><div class="result-head"><h3>'+esc(f.title)+'</h3><div class="result-badges"><span class="badge">'+esc(f.category)+'</span>'+source+badge+'</div></div><p>'+esc(f.message)+'</p><div class="result-snippet">'+esc(displayText)+'</div>'+suggested+'<div class="result-actions">'+actions.join('')+'</div></article>';
  }).join('');
}
function selectIssue(uid){
  const f=findings.find(function(x){return x.uid===uid;});
  if(!f)return;
  selectedIssue=uid;textArea.focus();textArea.setSelectionRange(f.start,f.end);
  const visible=visibleFindings(),idx=visible.findIndex(function(x){return x.uid===uid;});
  if(idx>=0){const node=results.querySelectorAll('.result-item')[idx];if(node)node.scrollIntoView({block:'nearest'});}
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
  }else if(f.source==='Writing mode'){
    currentText=currentText.slice(0,f.start)+f.correct+currentText.slice(f.end);
  }
  textArea.value=currentText;await checkDocument();
}
results.addEventListener('click',async function(e){
  const my=e.target.closest('[data-apply-my]'),harper=e.target.closest('[data-apply-harper]'),go=e.target.closest('[data-go]'),dict=e.target.closest('[data-dict-add]');
  if(my)await applyFinding(findings.find(function(f){return f.uid===Number(my.dataset.applyMy)}));
  else if(harper)await applyFinding(findings.find(function(f){return f.uid===Number(harper.dataset.applyHarper)}));
  else if(go)selectIssue(Number(go.dataset.go));
  else if(dict){
    const f=findings.find(function(x){return x.uid===Number(dict.dataset.dictAdd)});
    if(f){addToDictionary(f.wrong);await checkDocument();}
  }
});
document.querySelectorAll('.filter-btn').forEach(function(btn){btn.addEventListener('click',function(){
  document.querySelectorAll('.filter-btn').forEach(function(b){b.classList.remove('active')});
  btn.classList.add('active');currentFilter=btn.dataset.filter;renderFindings();
});});
function moveIssue(delta){
  const list=visibleFindings();if(!list.length)return;
  let idx=list.findIndex(function(f){return f.uid===selectedIssue;});
  if(idx<0)idx=delta>0?-1:list.length;
  idx=(idx+delta+list.length)%list.length;selectIssue(list[idx].uid);
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
document.getElementById('writingMode').value=writingMode;
document.getElementById('writingMode').addEventListener('change',function(){
  writingMode=this.value;localStorage.setItem('mygrammar-writing-mode',writingMode);
  if(textArea.value.trim())checkDocument();
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
document.getElementById('dictionaryBtn').addEventListener('click',function(){
  const panel=document.getElementById('dictionaryPanel');
  panel.hidden=!panel.hidden;if(!panel.hidden)document.getElementById('dictionaryInput').focus();
});
document.getElementById('dictionaryAddBtn').addEventListener('click',function(){
  const input=document.getElementById('dictionaryInput');addToDictionary(input.value);input.value='';
});
document.getElementById('dictionaryInput').addEventListener('keydown',function(e){
  if(e.key==='Enter'){e.preventDefault();document.getElementById('dictionaryAddBtn').click();}
});
document.getElementById('dictionaryList').addEventListener('click',function(e){
  const button=e.target.closest('[data-dict-remove]');if(!button)return;
  personalDictionary.splice(Number(button.dataset.dictRemove),1);saveDictionary();renderDictionary();
});
const fileInput=document.getElementById('fileInput');
fileInput.addEventListener('change',async function(){
  const file=this.files[0];if(!file)return;
  try{
    if(/\.docx$/i.test(file.name)){
      if(!window.mammoth)throw new Error('DOCX reader is not available yet. Refresh after the offline bundle is built.');
      const arrayBuffer=await file.arrayBuffer();
      if(arrayBuffer.byteLength>25*1024*1024)throw new Error('DOCX file is larger than the 25 MB local import limit.');
      const result=await mammoth.extractRawText({arrayBuffer:arrayBuffer});
      textArea.value=normalizeText(result.value||'');
      if(result.messages&&result.messages.length)console.info('DOCX conversion messages:',result.messages);
    }else{
      const reader=new FileReader();
      reader.onload=function(){textArea.value=String(reader.result||'');updateStats();};
      reader.readAsText(file);
      return;
    }
    updateStats();
    results.innerHTML='<div style="padding:16px;color:#166534;font-size:13px">✅ Imported '+esc(file.name)+'. Click Check Document.</div>';
  }catch(error){
    console.error(error);
    results.innerHTML='<div class="ok-state" style="color:#b91c1c;background:#fef2f2;border-color:#fecaca">Could not import '+esc(file.name)+'. '+esc(error.message||'Unknown DOCX error')+'</div>';
  }finally{this.value='';}
});
textArea.addEventListener('input',updateStats);
renderDictionary();
document.getElementById('writingMode').value=writingMode;
updateStats();
setupEngine().catch(function(error){engineStat.textContent='Engine: unavailable';console.error(error);});