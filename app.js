let KB = { rules: {}, tenses: [], commonErrors: [], contractions: [], irregularVerbs: {} };
let issues = [];
let timer = null;

const input = document.getElementById('inputText');
const highlights = document.getElementById('highlightLayer');
const results = document.getElementById('results');
const statusEl = document.getElementById('status');
const issueCount = document.getElementById('issueCount');
const score = document.getElementById('score');

async function loadKnowledgeBase() {
  const data = await Promise.all([
    fetch('data/grammar_rules.json').then(function(r){ return r.json(); }),
    fetch('data/tenses.json').then(function(r){ return r.json(); }),
    fetch('data/common_errors.json').then(function(r){ return r.json(); }),
    fetch('data/contractions.json').then(function(r){ return r.json(); }),
    fetch('data/irregular_verbs.json').then(function(r){ return r.json(); })
  ]);
  KB.rules = data[0];
  KB.tenses = data[1];
  KB.commonErrors = data[2];
  KB.contractions = data[3];
  KB.irregularVerbs = data[4];
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, function(c) {
    return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'})[c];
  });
}

function findRanges(text, needle) {
  var out = [], start = 0;
  var source = text.toLowerCase(), target = needle.toLowerCase();
  while (start < text.length) {
    var index = source.indexOf(target, start);
    if (index < 0) break;
    out.push([index, index + needle.length]);
    start = index + needle.length;
  }
  return out;
}

function commonErrorIssues(text) {
  var out = [];
  KB.commonErrors.forEach(function(rule) {
    findRanges(text, rule.wrong).forEach(function(range) {
      out.push({
        id: 'common-' + range[0] + '-' + rule.wrong,
        start: range[0], end: range[1],
        wrong: text.slice(range[0], range[1]), correct: rule.correct,
        title: rule.category || 'Common learner error',
        explanation: rule.explanation, formula: rule.formula || '',
        category: 'Suggestion', severity: rule.severity || 'error'
      });
    });
  });
  return out;
}

function contractionIssues(text) {
  var out = [];
  KB.contractions.forEach(function(rule) {
    var re = new RegExp('\\\\b' + rule.wrong + '\\\\b', 'gi');
    var match;
    while ((match = re.exec(text)) !== null) {
      out.push({
        id: 'contraction-' + match.index + '-' + rule.wrong,
        start: match.index,
        end: match.index + match[0].length,
        wrong: match[0],
        correct: rule.correct,
        title: rule.category || 'Spelling',
        explanation: rule.explanation,
        formula: rule.formula || '',
        category: 'Spelling',
        severity: 'error'
      });
    }
  });
  return out;
}

function thirdPersonIssues(text) {
  var out = [];
  var re = /\b(he|she|it)\s+(go|do|have|watch|wash|fix|study|try|play|work|live|like|want|need|use|make|take|read|write)\b/gi;
  var match;
  while ((match = re.exec(text)) !== null) {
    var base = match[2].toLowerCase(), fixed = base + 's';
    if (base === 'go' || base === 'do' || /(watch|wash|fix)$/.test(base)) fixed = base + 'es';
    else if (/[^aeiou]y$/.test(base)) fixed = base.slice(0, -1) + 'ies';
    out.push({
      id:'third-'+match.index, start:match.index, end:match.index+match[0].length,
      wrong:match[0], correct:match[1]+' '+fixed,
      title:'Subject–verb agreement',
      explanation:'He/She/It normally takes the third-person singular form in the Present Simple.',
      formula:'He / She / It + V1 + s/es', category:'Grammar', severity:'error'
    });
  }
  return out;
}

function auxiliaryIssues(text) {
  var out = [];
  var patterns = [
    { regex:/\b(he|she|it)\s+don't\b/gi, replacement:'doesn\'t' },
    { regex:/\b(i|you|we|they)\s+doesn\'t\b/gi, replacement:'don\'t' }
  ];
  patterns.forEach(function(rule) {
    var match;
    while ((match = rule.regex.exec(text)) !== null) {
      out.push({
        id:'aux-'+match.index, start:match.index, end:match.index+match[0].length,
        wrong:match[0], correct:match[1]+' '+rule.replacement,
        title:'Subject–auxiliary agreement',
        explanation:'The auxiliary must agree with the subject.',
        formula:'He/She/It + doesn\'t + V1 | I/You/We/They + don\'t + V1',
        category:'Grammar', severity:'error'
      });
    }
  });
  return out;
}

function detectTenses(text) {
  var lower = text.toLowerCase();
  return KB.tenses.filter(function(tense) {
    return (tense.signals || []).some(function(signal) {
      return new RegExp('\\b' + signal + '\\b', 'i').test(lower);
    });
  }).slice(0,2);
}

function analyze(text) {
  var list = commonErrorIssues(text).concat(contractionIssues(text), thirdPersonIssues(text), auxiliaryIssues(text));
  var seen = {};
  list = list.filter(function(item) {
    var key = item.start+'|'+item.end+'|'+item.correct;
    if (seen[key]) return false;
    seen[key] = true;
    return true;
  });
  list.sort(function(a,b){ return a.start-b.start; });
  return {issues:list, tenses:detectTenses(text)};
}

function renderHighlights(text) {
  if (!text) { highlights.innerHTML=''; return; }
  var html='', cursor=0;
  issues.forEach(function(issue) {
    if (issue.start < cursor) return;
    html += escapeHtml(text.slice(cursor,issue.start));
    html += '<span class="'+(issue.severity==='warn'?'mark-warning':'mark-error')+'">'+escapeHtml(text.slice(issue.start,issue.end))+'</span>';
    cursor = issue.end;
  });
  html += escapeHtml(text.slice(cursor))+'\\n';
  highlights.innerHTML=html;
  highlights.scrollTop=input.scrollTop;
  highlights.scrollLeft=input.scrollLeft;
}

function suggestionHtml(issue,index) {
  var formula = issue.formula ? '<div class="formula-box"><div class="formula-label">Grammar formula</div><div class="formula">'+escapeHtml(issue.formula)+'</div></div>' : '';
  return '<article class="suggestion">'+
    '<div class="suggestion-head"><span class="severity '+(issue.severity==='warn'?'warn':'error')+'">'+escapeHtml(issue.category)+'</span><h3>'+escapeHtml(issue.title)+'</h3></div>'+
    '<div class="comparison"><span class="wrong">'+escapeHtml(issue.wrong)+'</span> → <span class="correct">'+escapeHtml(issue.correct)+'</span></div>'+
    '<div class="explanation">'+escapeHtml(issue.explanation)+'</div>'+formula+
    '<div class="suggestion-actions"><button class="apply" data-apply="'+index+'">✓ Apply</button><button data-ignore="'+index+'">Ignore</button></div></article>';
}

function render(tenses) {
  issueCount.textContent=issues.length;
  if (!issues.length) {
    results.innerHTML='<div class="empty">✅ No obvious problems found. Keep writing!</div>';
    score.textContent=input.value.trim()?'Looks good':'—';
  } else {
    results.innerHTML=issues.map(suggestionHtml).join('');
    score.textContent=issues.length+' suggestion'+(issues.length===1?'':'s');
  }
  if (tenses.length) {
    var tense=tenses[0];
    results.insertAdjacentHTML('beforeend',
      '<div class="suggestion"><div class="suggestion-head"><span class="severity warn">Detected</span><h3>🧭 '+escapeHtml(tense.name)+'</h3></div>'+
      '<div class="formula-box"><div class="formula-label">Grammar formula</div><div class="formula">'+escapeHtml(tense.formula)+'</div></div>'+
      '<div class="explanation">'+escapeHtml(tense.description||'')+'</div></div>');
  }
  renderHighlights(input.value);
}

function analyzeNow() {
  var result=analyze(input.value);
  issues=result.issues;
  statusEl.textContent=input.value.trim()?'Checked automatically':'Ready';
  render(result.tenses);
}

function schedule() {
  clearTimeout(timer);
  statusEl.textContent='Checking…';
  timer=setTimeout(analyzeNow,180);
}

results.addEventListener('click',function(event) {
  var apply=event.target.closest('[data-apply]');
  if (apply) {
    var item=issues[Number(apply.dataset.apply)];
    if (!item) return;
    input.value=input.value.slice(0,item.start)+item.correct+input.value.slice(item.end);
    var caret=item.start+item.correct.length;
    input.focus(); input.setSelectionRange(caret,caret); schedule(); return;
  }
  var ignore=event.target.closest('[data-ignore]');
  if (ignore) { issues.splice(Number(ignore.dataset.ignore),1); render([]); }
});

input.addEventListener('input',schedule);
input.addEventListener('scroll',function(){highlights.scrollTop=input.scrollTop;highlights.scrollLeft=input.scrollLeft;});
document.getElementById('clearBtn').addEventListener('click',function(){
  input.value=''; issues=[]; render([]); statusEl.textContent='Ready'; input.focus();
});
document.getElementById('exampleBtn').addEventListener('click',function(){
  input.value='She go to the office every day. I am agree with the plan.'; schedule(); input.focus();
});

loadKnowledgeBase().then(analyzeNow).catch(function(error){
  statusEl.textContent='Knowledge Base error';
  results.innerHTML='<div class="empty">Could not load the local grammar knowledge base. Use a local/static server rather than file://.</div>';
  console.error(error);
});