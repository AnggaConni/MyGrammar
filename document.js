let linter=null;
let findings=[];
let currentText='';
let currentDialect=localStorage.getItem('mygrammar-dialect')||'American';

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
function normalizeText(s){return s.replace(/\u00a0/g,' ');}
function snippet(text,start,end){
  const a=Math.max(0,start-70),b=Math.min(text.length,end+70);
  return text.slice(a,b);
}
function dialectEnum(name){return MyGrammarHarper.Dialect[name] ?? MyGrammarHarper.Dialect.American;}
async function setupEngine(){
  if(!window.MyGrammarHarper) throw new Error('Harper bundle is missing. Run the GitHub Action once.');
  linter=new MyGrammarHarper.WorkerLinter({
    binary:MyGrammarHarper.binaryInlined,
    dialect:dialectEnum(currentDialect)
  });
  if(linter.setup) await linter.setup();
  try{if(linter.getDefaultLintConfig) await linter.getDefaultLintConfig();}catch(e){}
  engineStat.textContent='Engine: Harper.js offline';
}
async function checkDocument(){
  const raw=normalizeText(textArea.value);
  currentText=raw;
  if(!raw.trim()){results.innerHTML='<div style="padding:16px;color:#64748b;font-size:13px">Nothing to check yet.</div>';return;}
  if(raw.length>120000){results.innerHTML='<div class="ok-state" style="color:#92400e;background:#fffbeb;border-color:#fde68a">The document is longer than Harper’s recommended 120,000-character limit. Split it into sections for the most reliable result.</div>';return;}
  if(!linter) await setupEngine();
  progressBar.style.width='20%';
  results.innerHTML='<div style="padding:16px;color:#64748b;font-size:13px">Checking locally…</div>';
  try{
    const lints=await linter.lint(raw,{language:'plaintext'});
    findings=lints.map(function(lint,index){
      const span=lint.span();
      const suggestions=lint.suggestion_count()>0?lint.suggestions():[];
      return {index,start:span.start,end:span.end,message:lint.message(),suggestions,display:span,lint};
    });
    issueStat.textContent=findings.length+' issues';
    progressBar.style.width='100%';
    renderFindings();
  }catch(error){
    console.error(error);
    results.innerHTML='<div class="ok-state" style="color:#b91c1c;background:#fef2f2;border-color:#fecaca">The offline grammar engine could not complete the check. Try a shorter section or reload the page.</div>';
    progressBar.style.width='0%';
  }
}
function renderFindings(){
  if(!findings.length){
    results.innerHTML='<div class="ok-state">✅ No Harper findings detected in this document.</div>';
    return;
  }
  results.innerHTML=findings.map(function(f,i){
    const text=currentText.slice(f.start,f.end);
    let suggestion='';
    if(f.suggestions.length){
      suggestion='<div class="result-snippet">Suggested: '+esc(f.suggestions[0].toString ? f.suggestions[0].toString() : 'Correction available')+'</div>';
    }
    return '<article class="result-item"><h3>⚠️ Finding '+(i+1)+'</h3><p>'+esc(f.message||'Grammar or spelling issue')+'</p><div class="result-snippet">'+esc(text)+'</div>'+suggestion+
      (f.suggestions.length?'<div class="result-actions"><button class="apply" data-apply="'+i+'">✓ Apply first suggestion</button></div>':'')+
      '</article>';
  }).join('');
}
results.addEventListener('click',async function(e){
  const button=e.target.closest('[data-apply]');
  if(!button)return;
  const f=findings[Number(button.dataset.apply)];
  if(!f||!f.suggestions.length)return;
  try{
    currentText=await linter.applySuggestion(currentText,f.lint,f.suggestions[0]);
  }catch(error){
    const suggestion=f.suggestions[0];
    if(suggestion&&suggestion.text){
      currentText=currentText.slice(0,f.start)+suggestion.text+currentText.slice(f.end);
    }else{
      return;
    }
  }
  textArea.value=currentText;
  updateStats();
  await checkDocument();
});
document.getElementById('checkBtn').addEventListener('click',checkDocument);
document.getElementById('dialectSelect').value=currentDialect;
document.getElementById('dialectSelect').addEventListener('change',async function(){
  currentDialect=this.value;localStorage.setItem('mygrammar-dialect',currentDialect);
  if(linter){try{await linter.setDialect(dialectEnum(currentDialect));}catch(e){console.warn(e);}}
  if(textArea.value.trim()) await checkDocument();
});
document.getElementById('applyAllBtn').addEventListener('click',async function(){
  if(!findings.length)return;
  const sorted=findings.filter(function(f){return f.suggestions&&f.suggestions.length;}).slice().sort(function(a,b){return b.start-a.start;});
  let text=currentText, boundary=Infinity;
  for(const f of sorted){
    if(f.end>boundary)continue;
    try{text=await linter.applySuggestion(text,f.lint,f.suggestions[0]);boundary=f.start;}catch(e){console.warn('Skipped suggestion',e);}
  }
  currentText=text;textArea.value=text;updateStats();await checkDocument();
});
document.getElementById('clearBtn').addEventListener('click',function(){textArea.value='';currentText='';findings=[];issueStat.textContent='0 issues';progressBar.style.width='0%';updateStats();results.innerHTML='<div style="padding:16px;color:#64748b;font-size:13px">Paste text and click Check Document.</div>';});
document.getElementById('copyBtn').addEventListener('click',async function(){await navigator.clipboard.writeText(textArea.value);this.textContent='✓ Copied';setTimeout(()=>this.textContent='Copy Text',1200);});
document.getElementById('fileInput').addEventListener('change',function(){
  const file=this.files[0];if(!file)return;
  const reader=new FileReader();
  reader.onload=function(){textArea.value=String(reader.result||'');updateStats();};
  reader.readAsText(file);
});
textArea.addEventListener('input',updateStats);
updateStats();
setupEngine().catch(function(error){engineStat.textContent='Engine: unavailable';console.error(error);});
