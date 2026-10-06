(function(global){
  'use strict';

  const TRUSTED_LANGUAGE_TOOL_RULES=new Set([
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

  const FALLBACK={
    rules:{},
    tenses:[{
      id:'present_simple',
      name:'Present Simple',
      formula:'Subject + V1 (He/She/It → V1+s/es)',
      signals:['every','usually','always','often','sometimes','never'],
      description:'Habits, routines, facts and repeated actions.'
    }],
    commonErrors:[],
    contractions:[{
      wrong:'wouldnt',
      correct:"wouldn't",
      category:'Spelling',
      formula:"wouldn't + V1",
      explanation:"The negative form of 'would' is written with an apostrophe: wouldn't."
    }],
    verbs:[
      {v1:'work',v2:'worked',v3:'worked',type:'regular',example:'I worked yesterday.'},
      {v1:'go',v2:'went',v3:'gone',type:'irregular',example:'I went to work.'},
      {v1:'write',v2:'wrote',v3:'written',type:'irregular',example:'She has written a report.'}
    ],
    samples:[],
    externalRules:[],
    commonWords:[],
    loaded:false
  };

  function timeout(ms){
    return new Promise(function(resolve){setTimeout(resolve,ms);});
  }

  async function loadJSON(path,fallback){
    try{
      const response=await Promise.race([
        fetch(path,{cache:'no-store'}),
        timeout(3500).then(function(){throw new Error('timeout');})
      ]);
      if(!response.ok)throw new Error(response.status);
      return await response.json();
    }catch(e){
      return fallback;
    }
  }

  async function loadKnowledge(){
    const data=await Promise.all([
      loadJSON('data/grammar_rules.json',FALLBACK.rules),
      loadJSON('data/tenses.json',FALLBACK.tenses),
      loadJSON('data/common_errors.json',FALLBACK.commonErrors),
      loadJSON('data/contractions.json',FALLBACK.contractions),
      loadJSON('data/verbs.json',FALLBACK.verbs),
      loadJSON('data/samples.json',FALLBACK.samples),
      loadJSON('data/external/languagetool_runtime.json',{rules:[]}),
      loadJSON('data/external/common_words.json',{words:[]})
    ]);

    return {
      rules:data[0],
      tenses:data[1],
      commonErrors:data[2],
      contractions:data[3],
      verbs:data[4],
      samples:data[5],
      externalRules:(data[6]&&Array.isArray(data[6].rules))?data[6].rules:[],
      commonWords:(data[7]&&Array.isArray(data[7].words))?data[7].words:[],
      loaded:true
    };
  }

  function defaultKnowledge(){
    return JSON.parse(JSON.stringify(FALLBACK));
  }

  function languageToolRuleKey(rule){
    return (rule.id||'')+'|'+(rule.regex||'')+'|'+(rule.suggestion||'');
  }

  function isTrustedLanguageToolRule(rule){
    return TRUSTED_LANGUAGE_TOOL_RULES.has(languageToolRuleKey(rule));
  }

  function trustedLanguageToolCount(kb){
    return (kb.externalRules||[]).filter(isTrustedLanguageToolRule).length;
  }

  function findExactRanges(text,needle){
    const out=[];
    let start=0;
    const source=text.toLowerCase();
    const target=String(needle).toLowerCase();
    while(true){
      const i=source.indexOf(target,start);
      if(i<0)break;
      out.push([i,i+String(needle).length]);
      start=i+String(needle).length;
    }
    return out;
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

  function contractionIssues(text,kb){
    const out=[];
    (kb.contractions||[]).forEach(function(rule){
      const re=new RegExp('\\b'+rule.wrong+'\\b','gi');
      let m;
      while((m=re.exec(text))){
        out.push({
          start:m.index,end:m.index+m[0].length,
          wrong:m[0],correct:rule.correct,
          title:rule.category||'Spelling',
          category:'Spelling',severity:'error',priority:100,
          explanation:rule.explanation,formula:rule.formula||'',
          reasoning:[
            'Word form: '+m[0]+' is missing the apostrophe.',
            'Correct contraction: '+rule.correct,
            rule.explanation||'Use the standard contraction spelling.'
          ]
        });
      }
    });
    return out;
  }

  function externalLanguageToolIssues(text,kb){
    const out=[];
    if(text.length>12000)return out;
    (kb.externalRules||[]).filter(isTrustedLanguageToolRule).slice(0,100).forEach(function(rule){
      try{
        const re=new RegExp(rule.regex,'gi');
        let m;
        while((m=re.exec(text))){
          if(!rule.suggestion||m[0]===rule.suggestion)continue;
          out.push({
            start:m.index,end:m.index+m[0].length,
            wrong:m[0],correct:rule.suggestion,
            title:rule.name||'LanguageTool rule',
            category:'LanguageTool',severity:'error',priority:45,
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

  function commonErrorIssues(text,kb){
    const out=[];
    (kb.commonErrors||[]).forEach(function(rule){
      findExactRanges(text,rule.wrong).forEach(function(r){
        out.push({
          start:r[0],end:r[1],
          wrong:text.slice(r[0],r[1]),correct:rule.correct,
          title:rule.category||'Common learner error',
          category:'Suggestion',severity:'error',priority:105,
          explanation:rule.explanation,formula:rule.formula||'',
          reasoning:[
            'Pattern: '+rule.wrong+' → '+rule.correct,
            'Grammar focus: '+(rule.formula||rule.category||'common learner error'),
            rule.explanation||'This is a frequent learner pattern.'
          ]
        });
      });
    });
    return out;
  }

  function thirdPersonIssues(text){
    const out=[];
    const re=/\b(he|she|it)\s+(go|do|have|watch|wash|fix|study|try|play|work|live|like|want|need|use|make|take|read|write)\b/gi;
    let m;
    while((m=re.exec(text))){
      const base=m[2].toLowerCase();
      let form=base+'s';
      if(base==='go'||base==='do'||/(watch|wash|fix)$/.test(base))form=base+'es';
      else if(/[^aeiou]y$/.test(base))form=base.slice(0,-1)+'ies';
      out.push({
        start:m.index,end:m.index+m[0].length,
        wrong:m[0],correct:m[1]+' '+form,
        title:'Subject–verb agreement',
        category:'Grammar',severity:'error',priority:110,
        explanation:'He/She/It normally takes the third-person singular form in the Present Simple.',
        formula:'He / She / It + V1 + s/es',
        reasoning:[
          'Subject: '+m[1]+' = third-person singular',
          'Tense: Present Simple',
          'Rule: He / She / It + V1 + s/es',
          'Verb: '+base+' → '+form
        ]
      });
    }
    return out;
  }

  function auxiliaryIssues(text){
    const out=[];
    const rules=[
      {re:/\b(he|she|it)\s+don't\b/gi,r:"doesn't"},
      {re:/\b(i|you|we|they)\s+doesn't\b/gi,r:"don't"}
    ];
    rules.forEach(function(rule){
      let m;
      while((m=rule.re.exec(text))){
        out.push({
          start:m.index,end:m.index+m[0].length,
          wrong:m[0],correct:m[1]+' '+rule.r,
          title:'Subject–auxiliary agreement',
          category:'Grammar',severity:'error',priority:110,
          explanation:'The auxiliary must agree with the subject.',
          formula:'He/She/It + doesn\'t + V1 | I/You/We/They + don\'t + V1',
          reasoning:[
            'Subject: '+m[1]+' determines the auxiliary',
            'Negative Present Simple uses do/does + not',
            'Correct form: '+m[1]+' '+rule.r+' + V1'
          ]
        });
      }
    });
    return out;
  }

  function tenseIssues(text){
    const out=[];
    const lower=text.toLowerCase();
    if(/\b(yesterday|last\s+\w+|\d+\s+days?\s+ago)\b/.test(lower)){
      const bad=text.match(/\b(he|she|it|i|we|they|you)\s+(go|come|see|eat|write|take|work|play|walk)\b/i);
      if(bad){
        const map={go:'went',come:'came',see:'saw',eat:'ate',write:'wrote',take:'took',work:'worked',play:'played',walk:'walked'};
        out.push({
          start:bad.index,end:bad.index+bad[0].length,
          wrong:bad[0],correct:bad[1]+' '+map[bad[2].toLowerCase()],
          title:'Past Simple',category:'Tense',severity:'error',priority:90,
          explanation:'A completed past-time marker such as “yesterday” normally calls for the Past Simple.',
          formula:'Subject + V2',
          reasoning:[
            'Signal word: a completed past-time marker was detected',
            'Tense: Past Simple',
            'Formula: Subject + V2',
            'Verb: '+bad[2]+' → '+map[bad[2].toLowerCase()]
          ]
        });
      }
    }
    return out;
  }

  function analyze(text,kb){
    const source=kb||defaultKnowledge();
    let list=commonErrorIssues(text,source)
      .concat(contractionIssues(text,source))
      .concat(thirdPersonIssues(text))
      .concat(auxiliaryIssues(text))
      .concat(tenseIssues(text))
      .concat(externalLanguageToolIssues(text,source));

    const seen={};
    list=list.filter(function(issue){
      const key=issue.start+'|'+issue.end+'|'+issue.correct;
      if(seen[key])return false;
      seen[key]=true;
      issue.reasoning=buildReasoning(issue);
      return true;
    });

    list.sort(function(a,b){
      const priority=(b.priority||0)-(a.priority||0);
      if(priority)return priority;
      const start=a.start-b.start;
      if(start)return start;
      return (b.end-b.start)-(a.end-a.start);
    });

    const filtered=[];
    list.forEach(function(issue){
      const duplicateOverlap=filtered.some(function(existing){
        return existing.start===issue.start &&
          existing.category===issue.category &&
          existing.end>=issue.end;
      });
      if(!duplicateOverlap)filtered.push(issue);
    });
    return filtered;
  }

  function unique(arr){
    return Array.from(new Set(arr));
  }

  function feedbackMessages(text,kb){
    const messages=analyze(text,kb).map(function(issue){
      if(issue.category==='Spelling')return 'Spelling: use '+issue.correct+' instead of '+issue.wrong+'.';
      if(issue.category==='Grammar')return issue.explanation;
      if(issue.category==='Tense')return issue.explanation;
      if(issue.category==='LanguageTool')return issue.explanation;
      return issue.explanation||('Consider '+issue.correct+' instead of '+issue.wrong+'.');
    });

    const trimmed=text.trim();
    if(trimmed&& !/[.!?]$/.test(trimmed)){
      messages.push('Consider ending the response with punctuation.');
    }
    const count=trimmed?trimmed.split(/\s+/).length:0;
    if(count>0&&count<12){
      messages.push('Your response is very short. Add details, reasons or examples to develop the idea.');
    }
    return unique(messages);
  }

  global.MyGrammarGrammarEngine={
    TRUSTED_LANGUAGE_TOOL_RULES:TRUSTED_LANGUAGE_TOOL_RULES,
    defaultKnowledge:defaultKnowledge,
    loadKnowledge:loadKnowledge,
    languageToolRuleKey:languageToolRuleKey,
    isTrustedLanguageToolRule:isTrustedLanguageToolRule,
    trustedLanguageToolCount:trustedLanguageToolCount,
    analyze:analyze,
    feedbackMessages:feedbackMessages,
    buildReasoning:buildReasoning
  };
})(window);
