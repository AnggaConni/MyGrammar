const TENSES=[
['Present Simple','Subject + V1 (He/She/It → V1+s/es)','I love you. / He loves it.'],
['Present Continuous','Subject + am/is/are + V-ing','I am reading. / She is working.'],
['Present Perfect','Subject + have/has + V3','I have finished. / He has arrived.'],
['Present Perfect Continuous','Subject + have/has been + V-ing','I have been waiting. / She has been studying.'],
['Past Simple','Subject + V2','I worked yesterday. / He went home.'],
['Past Continuous','Subject + was/were + V-ing','I was working. / They were studying.'],
['Past Perfect','Subject + had + V3','I had finished. / She had left.'],
['Past Perfect Continuous','Subject + had been + V-ing','I had been waiting. / They had been working.'],
['Future Simple','Subject + will + V1','I will call you. / He will help us.'],
['Future Continuous','Subject + will be + V-ing','I will be working. / She will be traveling.'],
['Future Perfect','Subject + will have + V3','I will have finished. / He will have arrived.'],
['Future Perfect Continuous','Subject + will have been + V-ing','I will have been working for a year. / She will have been studying for three hours.']
];

const DRILLS=[
{id:'ps',title:'Present Simple',focus:'subject + verb',prompt:'Write two sentences about your daily routine. Use Present Simple. One sentence must use I/You/We/They and one must use He/She/It.',min:20},
{id:'pc',title:'Present Continuous',focus:'am/is/are + V-ing',prompt:'Write two sentences describing what people are doing right now.',min:20},
{id:'pp',title:'Present Perfect',focus:'have/has + V3',prompt:'Write two sentences about experiences or things you have completed recently.',min:20},
{id:'ppc',title:'Present Perfect Continuous',focus:'have/has been + V-ing',prompt:'Write two sentences about activities that have continued for a period of time.',min:20},
{id:'past',title:'Past Simple',focus:'V2',prompt:'Write four sentences about what you did yesterday.',min:35},
{id:'pastc',title:'Past Continuous',focus:'was/were + V-ing',prompt:'Write a short scene using two Past Continuous sentences.',min:30},
{id:'pastp',title:'Past Perfect',focus:'had + V3',prompt:'Write two sentences showing which action happened first in the past.',min:30},
{id:'pastpc',title:'Past Perfect Continuous',focus:'had been + V-ing',prompt:'Write two sentences describing an activity that continued before another past event.',min:30},
{id:'future',title:'Future Simple',focus:'will + V1',prompt:'Write three sentences about your plans, predictions or promises for the future.',min:30},
{id:'futurec',title:'Future Continuous',focus:'will be + V-ing',prompt:'Write two sentences about what you will be doing at a specific future time.',min:30},
{id:'futurep',title:'Future Perfect',focus:'will have + V3',prompt:'Write two sentences about things that will be completed before a future deadline.',min:30},
{id:'futurepc',title:'Future Perfect Continuous',focus:'will have been + V-ing',prompt:'Write two sentences about activities continuing until a future point.',min:30},
{id:'agreement',title:'Subject–Verb Agreement',focus:'He/She/It + s/es',prompt:'Write three sentences. Include one sentence with He, one with She, and one with They.',min:25},
{id:'articles',title:'Articles',focus:'a / an / the',prompt:'Write a short description of a room or place using a, an and the correctly.',min:35},
{id:'prepositions',title:'Prepositions',focus:'in / on / at / to / for',prompt:'Write five sentences about your day using different prepositions of time and place.',min:35},
{id:'modals',title:'Modal Verbs',focus:'can / should / must / might',prompt:'Write four sentences giving advice, ability, obligation and possibility.',min:35},
{id:'conditional',title:'Conditionals',focus:'if + result',prompt:'Write three conditional sentences about real and hypothetical situations.',min:35},
{id:'passive',title:'Passive Voice',focus:'be + V3',prompt:'Write two sentences in the passive voice about a process, product or event.',min:25},
{id:'gerund',title:'Gerund / Infinitive',focus:'V-ing / to + V1',prompt:'Write four sentences using different verbs followed by a gerund or infinitive.',min:35},
{id:'comparison',title:'Comparatives',focus:'-er / more / than',prompt:'Compare two places, people, technologies or products in four sentences.',min:35}
];

const ESSAYS=[
{id:'opinion',title:'Opinion Essay',type:'Argument',prompt:'Do you agree or disagree with the following idea? People learn more from real-world experience than from formal education. Explain your position with reasons and examples.',min:180},
{id:'choice',title:'Preference Essay',type:'Preference',prompt:'Some people prefer to live in a large city, while others prefer a small town. Which do you prefer and why?',min:160},
{id:'cause',title:'Cause & Effect',type:'Academic',prompt:'What is one major reason people have difficulty maintaining a healthy work-life balance? Explain the cause and its effects.',min:160},
{id:'problem',title:'Problem & Solution',type:'Academic',prompt:'Many students struggle to write confidently in English. What are the main causes, and what practical solutions would you recommend?',min:180},
{id:'discussion',title:'Discussion Essay',type:'Discussion',prompt:'Some people think technology makes communication better. Others think it makes people less connected. Discuss both views and give your opinion.',min:200},
{id:'education',title:'Education Essay',type:'Academic',prompt:'Should universities focus more on practical skills or theoretical knowledge? Explain your answer with examples.',min:180}
];

let currentDrill=DRILLS[0];
let currentEssay=null;

function esc(v){return String(v).replace(/[&<>"']/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'})[c];});}
function words(text){return text.trim()?text.trim().split(/\s+/).length:0;}
function unique(arr){return Array.from(new Set(arr));}

function localGrammarFeedback(text){
  const findings=[];
  const lower=text.toLowerCase();
  const contractions=[
    ['wouldnt',"wouldn't"],['couldnt',"couldn't"],['shouldnt',"shouldn't"],
    ['dont',"don't"],['doesnt',"doesn't"],['didnt',"didn't"],['cant',"can't"],
    ['wont',"won't"],['isnt',"isn't"],['arent',"aren't"],['wasnt',"wasn't"],
    ['werent',"weren't"],['havent',"haven't"],['hasnt',"hasn't"],['hadnt',"hadn't"]
  ];
  contractions.forEach(function(pair){
    const re=new RegExp('\\b'+pair[0]+'\\b','i');
    if(re.test(text))findings.push('Spelling: use '+pair[1]+' instead of '+pair[0]+'.');
  });
  if(/\b(he|she|it)\s+(go|do|have|watch|wash|fix|study|try|play|work|live|like|want|need)\b/i.test(text))
    findings.push('Subject–verb agreement: He/She/It normally takes V1+s/es in the Present Simple.');
  if(/\b(he|she|it)\s+don't\b/i.test(text))
    findings.push("Use doesn't with He/She/It in the Present Simple.");
  if(/\b(i|you|we|they)\s+doesn't\b/i.test(text))
    findings.push("Use don't with I/You/We/They in the Present Simple.");
  if(/\b(yesterday|last\s+\w+|\d+\s+days?\s+ago)\b/i.test(text)&&/\b(i|he|she|they|we|you)\s+(go|come|see|eat|write|take)\b/i.test(text))
    findings.push('Past-time markers such as yesterday normally call for a Past Simple V2 form.');
  if(/\bi am agree\b/i.test(lower))findings.push("Common learner error: use 'I agree', not 'I am agree'.");
  if(/\bdiscuss about\b/i.test(lower))findings.push("Use 'discuss the issue', not 'discuss about the issue'.");
  if(!/[.!?]$/.test(text.trim())&&text.trim())findings.push('Consider ending the response with punctuation.');
  if(words(text)>0&&words(text)<12)findings.push('Your response is very short. Add details, reasons or examples to develop the idea.');
  return unique(findings);
}

function scoreResponse(text,min){
  const wc=words(text);
  let grammar=100-(localGrammarFeedback(text).length*12);
  grammar=Math.max(0,grammar);
  let development=wc>=min?90:(wc>=min*.75?75:55);
  let organization=text.split(/\n|(?<=[.!?])\s+/).filter(Boolean).length>=3?88:68;
  let overall=Math.round((grammar+development+organization)/3);
  return {wc,grammar,development,organization,overall};
}

function renderLessons(){
  document.getElementById('lessonGrid').innerHTML=TENSES.map(function(t){
    return '<article class="lesson-card"><span class="eyebrow">GRAMMAR</span><h3>'+esc(t[0])+'</h3><div class="lesson-formula">'+esc(t[1])+'</div><div class="lesson-example">Examples: '+esc(t[2])+'</div></article>';
  }).join('');
}

function renderDrillMenu(){
  document.getElementById('exerciseMenu').innerHTML=DRILLS.map(function(d,i){
    return '<button class="exercise-item '+(i===0?'active':'')+'" data-drill="'+i+'"><strong>'+esc(d.title)+'</strong><span>'+esc(d.focus)+' • '+d.min+'+ words</span></button>';
  }).join('');
}

function openDrill(index){
  currentDrill=DRILLS[index];
  document.querySelectorAll('.exercise-item').forEach(function(b){b.classList.toggle('active',Number(b.dataset.drill)===index);});
  const saved=localStorage.getItem('mygrammar-drill-'+currentDrill.id)||'';
  document.getElementById('exerciseContent').innerHTML=
    '<div class="prompt-meta"><span class="pill">'+esc(currentDrill.focus)+'</span><span class="pill">Suggested minimum: '+currentDrill.min+' words</span></div>'+
    '<h2>'+esc(currentDrill.title)+'</h2><div class="prompt">'+esc(currentDrill.prompt)+'</div>'+
    '<textarea id="drillAnswer" class="writing-box" placeholder="Write your answer here…">'+esc(saved)+'</textarea>'+
    '<div class="write-toolbar"><span id="drillWords" class="word-count">0 words</span><button id="submitDrill" class="btn primary">Check My Writing</button></div>'+
    '<div id="drillFeedback"></div>';
  const a=document.getElementById('drillAnswer');
  const updateCount=function(){document.getElementById('drillWords').textContent=words(a.value)+' words';localStorage.setItem('mygrammar-drill-'+currentDrill.id,a.value);};
  a.addEventListener('input',updateCount);updateCount();
  document.getElementById('submitDrill').addEventListener('click',function(){renderFeedback('drillFeedback',a.value,currentDrill.min);});
}

function renderFeedback(targetId,text,min){
  const feedback=localGrammarFeedback(text),s=scoreResponse(text,min);
  document.getElementById(targetId).innerHTML=
    '<div class="feedback"><div class="score-strip">'+
    '<div class="metric"><b>'+s.overall+'</b><span>Writing readiness</span></div>'+
    '<div class="metric"><b>'+s.grammar+'</b><span>Grammar</span></div>'+
    '<div class="metric"><b>'+s.development+'</b><span>Development</span></div>'+
    '</div>'+
    '<h3>Guidance</h3>'+
    (feedback.length?feedback.map(function(x){return '<div class="feedback-item">⚠️ '+esc(x)+'</div>';}).join(''):'<div class="feedback-item">✅ No obvious rule-based grammar problems found.</div>')+
    '<div class="feedback-item">📐 Target: '+min+'+ words. Current: '+s.wc+' words.</div>'+
    '</div>';
}

function renderEssays(){
  document.getElementById('essayList').innerHTML=ESSAYS.map(function(e,i){
    return '<article class="essay-card"><span class="eyebrow">'+esc(e.type)+'</span><h3>'+esc(e.title)+'</h3><p>'+esc(e.prompt)+'</p><p><strong>Suggested length:</strong> '+e.min+'+ words</p><button class="btn" data-essay="'+i+'">Open Essay</button></article>';
  }).join('');
}

function openEssay(index){
  currentEssay=ESSAYS[index];
  document.querySelector('[data-panel="essays"]').click();
  const root=document.getElementById('essayList');
  root.innerHTML='<section class="card" style="padding:20px;grid-column:1/-1">'+
    '<a href="#" id="backEssays" class="back">← All essay prompts</a>'+
    '<div class="prompt-meta"><span class="pill">'+esc(currentEssay.type)+'</span><span class="pill">'+currentEssay.min+'+ words</span></div>'+
    '<h2>'+esc(currentEssay.title)+'</h2><div class="prompt">'+esc(currentEssay.prompt)+'</div>'+
    '<textarea id="essayAnswer" class="writing-box" placeholder="Write your essay here…"></textarea>'+
    '<div class="write-toolbar"><span id="essayWords" class="word-count">0 words</span><button id="submitEssay" class="btn primary">Check Essay</button></div>'+
    '<div id="essayFeedback"></div></section>';
  const a=document.getElementById('essayAnswer');
  a.addEventListener('input',function(){document.getElementById('essayWords').textContent=words(a.value)+' words';});
  document.getElementById('submitEssay').addEventListener('click',function(){renderFeedback('essayFeedback',a.value,currentEssay.min);});
  document.getElementById('backEssays').addEventListener('click',function(e){e.preventDefault();renderEssays();});
}

document.querySelectorAll('.subtab').forEach(function(btn){
  btn.addEventListener('click',function(){
    document.querySelectorAll('.subtab').forEach(function(b){b.classList.remove('active');});
    document.querySelectorAll('.writer-panel').forEach(function(p){p.classList.remove('active');});
    btn.classList.add('active');document.getElementById(btn.dataset.panel).classList.add('active');
    window.scrollTo({top:0,behavior:'smooth'});
  });
});
document.getElementById('exerciseMenu').addEventListener('click',function(e){const b=e.target.closest('[data-drill]');if(b)openDrill(Number(b.dataset.drill));});
document.getElementById('essayList').addEventListener('click',function(e){const b=e.target.closest('[data-essay]');if(b)openEssay(Number(b.dataset.essay));});

renderLessons();renderDrillMenu();openDrill(0);renderEssays();
