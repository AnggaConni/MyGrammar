let KB={rules:{},tenses:[],commonErrors:[],irregularVerbs:{}};

async function loadKnowledgeBase(){
  const [rules,tenses,errors,verbs]=await Promise.all([
    fetch("data/grammar_rules.json").then(r=>r.json()),
    fetch("data/tenses.json").then(r=>r.json()),
    fetch("data/common_errors.json").then(r=>r.json()),
    fetch("data/irregular_verbs.json").then(r=>r.json())
  ]);
  KB={rules,tenses,commonErrors:errors,irregularVerbs:verbs};
}

function tokenize(text){return text.match(/\b[\w’'-]+\b|[.!?,;]/g)||[]}
function lowerWords(text){return tokenize(text).map(x=>x.toLowerCase())}
function findCommonErrors(text){
  const normalized=text.toLowerCase().replace(/\s+/g," ").trim();
  return KB.commonErrors.filter(e=>normalized.includes(e.wrong.toLowerCase()));
}
function detectTense(text){
  const words=lowerWords(text);
  return KB.tenses.find(t=>(t.signals||[]).some(s=>words.includes(s.toLowerCase())))||null;
}
function thirdPersonCheck(text){
  const errors=[];
  const re=/\b(he|she|it)\s+(go|do|have|watch|wash|fix|study|try|play|work|live|like|want|need|use|make|take|read|write)\b/i;
  const m=text.match(re);
  if(!m)return errors;
  const base=m[2].toLowerCase();
  let corrected=base+"s";
  if(["go","do"].includes(base)||/(watch|wash|fix)$/.test(base)) corrected=base+"es";
  else if(/[^aeiou]y$/.test(base)) corrected=base.slice(0,-1)+"ies";
  errors.push({label:"Present Simple — third-person singular",wrong:m[0],correct:m[1]+" "+corrected,explanation:"He/She/It normally takes the third-person singular form in the Present Simple."});
  return errors;
}
function auxiliaryCheck(text){
  const errors=[];
  const rules=[
    {re:/\b(he|she|it)\s+don't\s+/i,correct:"doesn't"},
    {re:/\b(i|you|we|they)\s+doesn't\s+/i,correct:"don't"}
  ];
  for(const p of rules){
    const m=text.match(p.re);
    if(m)errors.push({label:"Subject–auxiliary agreement",wrong:m[0],correct:m[0].replace(/don't|doesn't/i,p.correct),explanation:"The auxiliary verb must agree with the subject."});
  }
  return errors;
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]))}
function render(results,tense){
  const root=document.getElementById("results");
  let html=results.length?results.map(r=>`<article class="result warning"><h3>⚠️ ${r.label}</h3><div><span class="wrong">${escapeHtml(r.wrong)}</span> → <span class="correct">${escapeHtml(r.correct)}</span></div><div class="meta">${escapeHtml(r.explanation)}</div></article>`).join(""):`<div class="result ok"><h3>✅ No obvious rule-based errors found</h3><div class="meta">This checker focuses on common grammar patterns and does not guarantee perfect naturalness.</div></div>`;
  if(tense)html+=`<div class="result"><h3>🧭 Detected tense: ${escapeHtml(tense.name)}</h3><div class="formula">${escapeHtml(tense.formula)}</div><div class="meta">${escapeHtml(tense.description||"")}</div></div>`;
  root.innerHTML=html;
}
async function check(){
  const text=document.getElementById("inputText").value.trim(),status=document.getElementById("status");
  if(!text){status.textContent="Please enter a sentence";return}
  status.textContent="Checking…";
  const results=[];
  findCommonErrors(text).forEach(e=>results.push({label:e.category||"Common learner error",wrong:e.wrong,correct:e.correct,explanation:e.explanation}));
  results.push(...thirdPersonCheck(text),...auxiliaryCheck(text));
  const tense=detectTense(text);render(results,tense);
  status.textContent=`${results.length} issue${results.length===1?"":"s"} found`;
}
document.getElementById("checkBtn").addEventListener("click",check);
document.getElementById("clearBtn").addEventListener("click",()=>{document.getElementById("inputText").value="";document.getElementById("results").innerHTML="";document.getElementById("status").textContent="Ready"});
document.getElementById("exampleBtn").addEventListener("click",()=>{document.getElementById("inputText").value="She go to the office every day.";check()});
loadKnowledgeBase().catch(err=>{document.getElementById("status").textContent="Knowledge Base failed to load";console.error(err)});