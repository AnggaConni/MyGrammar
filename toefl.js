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
{id:'ps',title:'Present Simple',focus:'subject + verb',prompt:'Write two different sentences about your daily routine. Use Present Simple. Use I/You/We/They in one sentence and He/She/It in the other.',min:20,tasks:2,examples:['I work from home every Monday.','She drinks coffee every morning.']},
{id:'pc',title:'Present Continuous',focus:'am/is/are + V-ing',prompt:'Write two different sentences describing what people are doing right now.',min:20,tasks:2,examples:['I am reading a book right now.','They are waiting for the bus.']},
{id:'pp',title:'Present Perfect',focus:'have/has + V3',prompt:'Write two different sentences about experiences or things you have completed recently.',min:20,tasks:2,examples:['I have finished my report.','She has visited Bali twice.']},
{id:'ppc',title:'Present Perfect Continuous',focus:'have/has been + V-ing',prompt:'Write two different sentences about activities that have continued for a period of time.',min:20,tasks:2,examples:['I have been studying for two hours.','He has been working here since June.']},
{id:'past',title:'Past Simple',focus:'V2',prompt:'Write four different sentences about what you did yesterday.',min:35,tasks:4,examples:['I visited my friend yesterday.','We watched a movie last night.']},
{id:'pastc',title:'Past Continuous',focus:'was/were + V-ing',prompt:'Write two different sentences describing actions that were in progress at a past time.',min:30,tasks:2,examples:['I was cooking at eight.','They were talking when I arrived.']},
{id:'pastp',title:'Past Perfect',focus:'had + V3',prompt:'Write two different sentences showing an action that happened before another past action.',min:30,tasks:2,examples:['I had finished dinner before he called.','She had left when I arrived.']},
{id:'pastpc',title:'Past Perfect Continuous',focus:'had been + V-ing',prompt:'Write two different sentences describing activities that continued before another past event.',min:30,tasks:2,examples:['I had been waiting for an hour before the bus came.','They had been working all morning before lunch.']},
{id:'future',title:'Future Simple',focus:'will + V1',prompt:'Write three different sentences about your plans, predictions or promises for the future.',min:30,tasks:3,examples:['I will call you tomorrow.','She will start a new job next month.']},
{id:'futurec',title:'Future Continuous',focus:'will be + V-ing',prompt:'Write two different sentences about what you will be doing at a specific future time.',min:30,tasks:2,examples:['I will be working at eight tomorrow.','They will be traveling next week.']},
{id:'futurep',title:'Future Perfect',focus:'will have + V3',prompt:'Write two different sentences about things that will be completed before a future deadline.',min:30,tasks:2,examples:['I will have finished the report by Friday.','She will have arrived by noon.']},
{id:'futurepc',title:'Future Perfect Continuous',focus:'will have been + V-ing',prompt:'Write two different sentences about activities continuing until a future point.',min:30,tasks:2,examples:['I will have been working here for a year by June.','She will have been studying for three hours by noon.']},
{id:'agreement',title:'Subject–Verb Agreement',focus:'He/She/It + s/es',prompt:'Write three different sentences: one with He, one with She, and one with They.',min:25,tasks:3,examples:['He works at a hospital.','She studies English every night.']},
{id:'articles',title:'Articles',focus:'a / an / the',prompt:'Write three different sentences about a room or place. Use a, an and the correctly.',min:35,tasks:3,examples:['There is a table near the window.','I saw an old clock on the wall.']},
{id:'prepositions',title:'Prepositions',focus:'in / on / at / to / for',prompt:'Write five different sentences about your day using different prepositions of time and place.',min:35,tasks:5,examples:['I wake up at six.','My phone is on the table.']},
{id:'modals',title:'Modal Verbs',focus:'can / should / must / might',prompt:'Write four different sentences: ability, advice, obligation and possibility.',min:35,tasks:4,examples:['I can speak English.','You should get more rest.']},
{id:'conditional',title:'Conditionals',focus:'if + result',prompt:'Write three different conditional sentences about real or hypothetical situations.',min:35,tasks:3,examples:['If it rains, I will stay home.','If I had more time, I would travel more.']},
{id:'passive',title:'Passive Voice',focus:'be + V3',prompt:'Write two different sentences in the passive voice about a process, product or event.',min:25,tasks:2,examples:['The report was written yesterday.','English is spoken in many countries.']},
{id:'gerund',title:'Gerund / Infinitive',focus:'V-ing / to + V1',prompt:'Write four different sentences using verbs followed by a gerund or an infinitive.',min:35,tasks:4,examples:['I enjoy reading.','I want to learn English.']},
{id:'comparison',title:'Comparatives',focus:'-er / more / than',prompt:'Write four different sentences comparing two places, people, technologies or products.',min:35,tasks:4,examples:['Jakarta is busier than my hometown.','This phone is more expensive than mine.']}
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

let grammarKB=MyGrammarGrammarEngine.defaultKnowledge();

function localGrammarFeedback(text){
  return MyGrammarGrammarEngine.feedbackMessages(text,grammarKB);
}

MyGrammarGrammarEngine.loadKnowledge().then(function(kb){
  grammarKB=kb;
}).catch(function(error){
  console.warn('Shared grammar knowledge could not be loaded:',error);
});

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
  document.querySelectorAll('.exercise-item').forEach(function(b){
    b.classList.toggle('active',Number(b.dataset.drill)===index);
  });
  const saved=JSON.parse(localStorage.getItem('mygrammar-drill-'+currentDrill.id)||'[]');
  const exampleHtml=(currentDrill.examples||[]).map(function(example,i){
    return '<div class="example-sentence"><span class="example-tag">Example '+(i+1)+'</span><span>'+esc(example)+'</span></div>';
  }).join('');
  const taskHtml=Array.from({length:currentDrill.tasks||1},function(_,i){
    return '<div class="task-row"><div class="task-number">'+(i+1)+'</div><div class="task-body"><label for="task-'+i+'">Write a different sentence</label><input id="task-'+i+'" class="task-input" data-task-index="'+i+'" placeholder="'+(i===0?'Start writing your own sentence…':'Write another sentence with the same grammar…')+'" value="'+esc(saved[i]||'')+'"></div></div>';
  }).join('');
  document.getElementById('exerciseContent').innerHTML=
    '<div class="prompt-meta"><span class="pill">'+esc(currentDrill.focus)+'</span><span class="pill">'+currentDrill.tasks+' sentence'+(currentDrill.tasks===1?'':'s')+'</span><span class="pill">Suggested minimum: '+currentDrill.min+' words</span></div>'+
    '<h2>'+esc(currentDrill.title)+'</h2>'+
    '<div class="prompt"><strong>Your task</strong><p>'+esc(currentDrill.prompt)+'</p><span class="do-not-copy">Create sentences with your own ideas. Do not copy the examples.</span></div>'+
    '<div class="examples-panel"><div class="examples-title">📌 See the pattern first</div>'+exampleHtml+'</div>'+
    '<div class="tasks-panel"><div class="tasks-title">✍️ Now write your own</div>'+taskHtml+'</div>'+
    '<div class="write-toolbar"><span id="drillWords" class="word-count">0 words</span><button id="submitDrill" class="btn primary">Check My Writing</button></div>'+
    '<div id="drillFeedback"></div>';
  const fields=Array.from(document.querySelectorAll('.task-input'));
  const update=function(){
    const values=fields.map(function(f){return f.value;});
    const joined=values.filter(Boolean).join(' ');
    document.getElementById('drillWords').textContent=words(joined)+' words';
    localStorage.setItem('mygrammar-drill-'+currentDrill.id,JSON.stringify(values));
  };
  fields.forEach(function(f){f.addEventListener('input',update);});
  update();
  document.getElementById('submitDrill').addEventListener('click',function(){
    const joined=fields.map(function(f){return f.value.trim();}).filter(Boolean).join(' ');
    renderFeedback('drillFeedback',joined,currentDrill.min,fields.length,fields.map(function(f){return f.value.trim();}));
  });
}
function renderFeedback(targetId,text,min,expectedCount,answers){
  const feedback=localGrammarFeedback(text),s=scoreResponse(text,min);
  const completed=(answers||[]).filter(Boolean).length;
  const missing=Math.max(0,(expectedCount||0)-completed);
  document.getElementById(targetId).innerHTML=
    '<div class="feedback"><div class="score-strip">'+
    '<div class="metric"><b>'+s.overall+'</b><span>Practice readiness</span></div>'+
    '<div class="metric"><b>'+s.grammar+'</b><span>Grammar</span></div>'+
    '<div class="metric"><b>'+s.development+'</b><span>Development</span></div>'+
    '</div>'+
    '<h3>Guidance</h3>'+
    (missing?'<div class="feedback-item">⚠️ You completed '+completed+' of '+expectedCount+' sentence'+(expectedCount===1?'':'s')+'. Finish all numbered tasks.</div>':'<div class="feedback-item">✅ All numbered writing tasks are completed.</div>')+
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
