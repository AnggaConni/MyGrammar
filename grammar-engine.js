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
    verbPatterns:[],
    learnerErrors:[],
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
      loadJSON('data/external/common_words.json',{words:[]}),
      loadJSON('data/verb_patterns.json',[]),
      loadJSON('data/learner_errors_id.json',[])
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
      verbPatterns:Array.isArray(data[8])?data[8]:[],
      learnerErrors:Array.isArray(data[9])?data[9]:[],
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

function escapeRegex(value){
    return String(value||'').replace(/[|\\{}()[\]^$+*?.-]/g,'\\$&');
  }

function splitForms(value){
    return String(value||'').split('/').map(function(v){return v.trim().toLowerCase();}).filter(Boolean);
  }

  function thirdPersonForm(base){
    base=String(base||'').toLowerCase();
    if(base==='be')return 'is';
    if(base==='have')return 'has';
    if(base==='do'||base==='go')return base+'es';
    if(/(s|sh|ch|x|z|o)$/.test(base))return base+'es';
    if(/[^aeiou]y$/.test(base))return base.slice(0,-1)+'ies';
    return base+'s';
  }

  function ingForm(base){
    base=String(base||'').toLowerCase();
    const overrides={be:'being',have:'having',do:'doing',go:'going',see:'seeing'};
    if(overrides[base])return overrides[base];
    if(/ie$/.test(base))return base.slice(0,-2)+'ying';
    if(/e$/.test(base)&&!/ee$|ye$/.test(base))return base.slice(0,-1)+'ing';
    if(/[^aeiou][aeiou][^aeiouyw]$/.test(base)&&base.length<=5)return base+base.slice(-1)+'ing';
    return base+'ing';
  }

  function buildVerbLexicon(kb){
    const byForm={};
    function add(form,row,kind){
      const key=String(form||'').toLowerCase();
      if(!key)return;
      if(!byForm[key])byForm[key]=[];
      if(!byForm[key].some(function(item){return item.row===row&&item.kind===kind;})){
        byForm[key].push({row:row,kind:kind});
      }
    }
    (kb.verbs||[]).forEach(function(row){
      const base=String(row.v1||'').toLowerCase();
      if(!base)return;
      add(base,row,'base');
      splitForms(row.v2).forEach(function(form){add(form,row,'past');});
      splitForms(row.v3).forEach(function(form){add(form,row,'participle');});
      if(base!=='be')add(thirdPersonForm(base),row,'third');
      add(ingForm(base),row,'ing');
    });
    return byForm;
  }

  function findVerbMatch(lexicon,token){
    const matches=lexicon[String(token||'').toLowerCase()]||[];
    return matches.length?matches[0]:null;
  }

  function correctPastForm(row,subject){
    const base=String(row.v1||'').toLowerCase();
    if(base==='be'){
      const s=String(subject||'').toLowerCase();
      return (s==='i'||s==='he'||s==='she'||s==='it')?'was':'were';
    }
    return splitForms(row.v2)[0]||base;
  }

  function sentenceAround(text,index,end){
    const left=text.lastIndexOf('.',index);
    const q=text.lastIndexOf('?',index);
    const ex=text.lastIndexOf('!',index);
    const start=Math.max(left,q,ex)+1;
    const rDot=text.indexOf('.',end);
    const rQ=text.indexOf('?',end);
    const rEx=text.indexOf('!',end);
    const candidates=[rDot,rQ,rEx].filter(function(v){return v>=0;});
    const finish=candidates.length?Math.min.apply(null,candidates):text.length;
    return text.slice(start,finish);
  }

  function dynamicSubjectVerbIssues(text,kb){
    const out=[];
    const lexicon=buildVerbLexicon(kb);
    const bases=(kb.verbs||[]).map(function(v){return String(v.v1||'').toLowerCase();})
      .filter(function(v){return v&&v!=='be';})
      .sort(function(a,b){return b.length-a.length;})
      .map(escapeRegex);
    if(bases.length){
      const re=new RegExp('\\b(he|she|it)\\s+('+bases.join('|')+')\\b','gi');
      let m;
      while((m=re.exec(text))){
        const sentence=sentenceAround(text,m.index,m.index+m[0].length);
        if(/\b(yesterday|last\s+\w+|\d+\s+days?\s+ago)\b/i.test(sentence))continue;
        const row=findVerbMatch(lexicon,m[2]);
        if(!row)continue;
        const form=thirdPersonForm(m[2]);
        if(form.toLowerCase()===m[2].toLowerCase())continue;
        out.push({
          start:m.index,end:m.index+m[0].length,
          wrong:m[0],correct:m[1]+' '+form,
          title:'Subject–verb agreement',
          category:'Grammar',severity:'error',priority:120,
          explanation:'He/She/It normally takes the third-person singular form in the Present Simple.',
          formula:'He / She / It + V1 + s/es',
          reasoning:[
            'Subject: '+m[1]+' = third-person singular',
            'Tense: Present Simple',
            'Verb: '+m[2]+' → '+form
          ]
        });
      }
    }

    const beRules=[
      {re:/\b(he|she|it)\s+(am|are)\b/gi,form:'is'},
      {re:/\b(i)\s+(is|are)\b/gi,form:'am'},
      {re:/\b(you|we|they)\s+(is|am)\b/gi,form:'are'}
    ];
    beRules.forEach(function(rule){
      let m;
      while((m=rule.re.exec(text))){
        out.push({
          start:m.index,end:m.index+m[0].length,
          wrong:m[0],correct:m[1]+' '+rule.form,
          title:'Subject–be agreement',
          category:'Grammar',severity:'error',priority:125,
          explanation:'The verb be must agree with the subject.',
          formula:'I + am | He/She/It + is | You/We/They + are',
          reasoning:[
            'Subject: '+m[1],
            'Verb: '+m[2]+' is the wrong form of be for this subject',
            'Correct form: '+m[1]+' '+rule.form
          ]
        });
      }
    });
    return out;
  }

  function verbFormIssues(text,kb){
    const out=[];
    const lexicon=buildVerbLexicon(kb);
    const entries=Object.keys(lexicon);

    function add(issue){
      issue.reasoning=issue.reasoning||[];
      out.push(issue);
    }

    if(entries.length){
      const tokenPattern=entries.sort(function(a,b){return b.length-a.length;})
        .map(escapeRegex).join('|');

      const modalRe=new RegExp('\\b(can|could|may|might|must|shall|should|will|would)\\s+('+tokenPattern+')\\b','gi');
      let m;
      while((m=modalRe.exec(text))){
        const match=findVerbMatch(lexicon,m[2]);
        if(!match||match.kind==='base')continue;
        add({
          start:m.index,end:m.index+m[0].length,
          wrong:m[0],correct:m[1]+' '+match.row.v1,
          title:'Modal + base form',category:'Verb form',severity:'error',priority:119,
          explanation:'Modal verbs such as can, should and would are followed by the base form (V1).',
          formula:'Modal + V1',
          reasoning:[
            'Modal: '+m[1],
            'Rule: modal + V1',
            'Verb form: '+m[2]+' → '+match.row.v1
          ]
        });
      }

      const perfectRe=new RegExp('\\b(have|has|had)\\s+('+tokenPattern+')\\b','gi');
      while((m=perfectRe.exec(text))){
        const match=findVerbMatch(lexicon,m[2]);
        if(!match)continue;
        const validParticiple=splitForms(match.row.v3).includes(String(m[2]).toLowerCase());
        if(validParticiple)continue;
        if(match.kind!=='base'&&match.kind!=='past'&&match.kind!=='third')continue;
        add({
          start:m.index,end:m.index+m[0].length,
          wrong:m[0],correct:m[1]+' '+match.row.v3.split('/')[0],
          title:'Perfect + past participle',category:'Verb form',severity:'error',priority:118,
          explanation:'Have/has/had is followed by the past participle (V3) in perfect constructions.',
          formula:'Have / Has / Had + V3',
          reasoning:[
            'Auxiliary: '+m[1],
            'Rule: have/has/had + V3',
            'Verb form: '+m[2]+' → '+match.row.v3.split('/')[0]
          ]
        });
      }

      const continuousRe=new RegExp('\\b(am|is|are|was|were)\\s+('+tokenPattern+')\\b','gi');
      while((m=continuousRe.exec(text))){
        const match=findVerbMatch(lexicon,m[2]);
        if(!match||match.kind!=='base')continue;
        add({
          start:m.index,end:m.index+m[0].length,
          wrong:m[0],correct:m[1]+' '+ingForm(match.row.v1),
          title:'Continuous + V-ing',category:'Verb form',severity:'error',priority:117,
          explanation:'A continuous construction uses a form of be followed by the -ing form.',
          formula:'Be + V-ing',
          reasoning:[
            'Auxiliary: '+m[1],
            'Rule: be + V-ing',
            'Verb form: '+m[2]+' → '+ingForm(match.row.v1)
          ]
        });
      }

      const infinitiveRe=new RegExp('\\bto\\s+('+tokenPattern+')\\b','gi');
      while((m=infinitiveRe.exec(text))){
        const before=text.slice(Math.max(0,m.index-80),m.index).toLowerCase();
        const isPrepositionalTo=(kb.verbPatterns||[]).some(function(rule){
          return rule.kind==='fixed_gerund' && rule.phrase &&
            before.endsWith(String(rule.phrase).toLowerCase());
        });
        if(isPrepositionalTo)continue;
        const match=findVerbMatch(lexicon,m[1]);
        if(!match||match.kind==='base')continue;
        add({
          start:m.index,end:m.index+m[0].length,
          wrong:m[0],correct:'to '+match.row.v1,
          title:'Infinitive + base form',category:'Verb form',severity:'error',priority:116,
          explanation:'The infinitive marker to is followed by the base form (V1).',
          formula:'to + V1',
          reasoning:[
            'Marker: to',
            'Rule: to + V1',
            'Verb form: '+m[1]+' → '+match.row.v1
          ]
        });
      }
    }

    return out;
  }

  
  function preserveCase(original,replacement){
    const source=String(original||'');
    const target=String(replacement||'');
    if(!source||!target)return replacement;
    if(source===source.toUpperCase())return target.toUpperCase();
    if(source[0]===source[0].toUpperCase())return target.charAt(0).toUpperCase()+target.slice(1);
    return target;
  }

  function learnerErrorIssues(text,kb){
    const out=[];
    (kb.learnerErrors||[]).forEach(function(rule){
      findExactRanges(text,rule.wrong).forEach(function(r){
        out.push({
          start:r[0],end:r[1],
          wrong:text.slice(r[0],r[1]),correct:preserveCase(text.slice(r[0],r[1]),rule.correct),
          title:rule.title||'Indonesian learner pattern',
          category:rule.category||'Learner pattern',
          severity:rule.severity||'error',
          priority:rule.priority||108,
          explanation:rule.explanation||'This is a common learner pattern.',
          formula:rule.formula||'',
          reasoning:[
            'Learner pattern: '+rule.wrong+' → '+rule.correct,
            'Grammar focus: '+(rule.formula||rule.title||'learner pattern'),
            rule.explanation||'Use the standard English pattern.'
          ]
        });
      });
    });
    return out;
  }

  function patternVerbRows(kb,verbs){
    return (verbs||[]).map(function(base){
      return (kb.verbs||[]).find(function(v){
        return String(v.v1||'').toLowerCase()===String(base||'').toLowerCase();
      });
    }).filter(Boolean);
  }

  function verbPatternIssues(text,kb){
    const out=[];
    const lexicon=buildVerbLexicon(kb);
    const baseForms=Object.keys(lexicon).filter(function(form){
      const hit=lexicon[form]&&lexicon[form][0];
      return hit&&hit.kind==='base';
    }).sort(function(a,b){return b.length-a.length;});
    const ingForms=Object.keys(lexicon).filter(function(form){
      const hit=lexicon[form]&&lexicon[form][0];
      return hit&&hit.kind==='ing';
    }).sort(function(a,b){return b.length-a.length;});
    const basePattern=baseForms.map(escapeRegex).join('|');
    const ingPattern=ingForms.map(escapeRegex).join('|');
    if(!basePattern)return out;

    function surfacePattern(rows){
      const surface=[];
      rows.forEach(function(row){
        surface.push(row.v1,row.v2,thirdPersonForm(row.v1));
      });
      return Array.from(new Set(surface.filter(Boolean)))
        .sort(function(a,b){return b.length-a.length;})
        .map(escapeRegex).join('|');
    }

    (kb.verbPatterns||[]).forEach(function(rule){
      try{
        if(rule.kind==='gerund_after'&&Array.isArray(rule.verbs)&&rule.verbs.length){
          const verbSurface=surfacePattern(patternVerbRows(kb,rule.verbs));
          if(!verbSurface)return;
          const re=new RegExp('\\b('+verbSurface+')\\s+to\\s+('+basePattern+')\\b','gi');
          let m;
          while((m=re.exec(text))){
            const correct=m[1]+' '+ingForm(m[2]);
            out.push({
              start:m.index,end:m.index+m[0].length,wrong:m[0],correct:correct,
              title:rule.title||'Verb pattern',category:'Verb pattern',severity:'error',
              priority:rule.priority||114,explanation:rule.explanation||'Use the standard verb pattern.',
              formula:rule.formula||'',
              reasoning:[
                'Main verb: '+m[1],
                'Rule: '+(rule.formula||'verb pattern'),
                'Complement: '+m[2]+' must use V-ing here',
                'Correction: '+correct
              ]
            });
          }
        }

        if(rule.kind==='infinitive_after'&&Array.isArray(rule.verbs)&&rule.verbs.length&&ingPattern){
          const verbSurface=surfacePattern(patternVerbRows(kb,rule.verbs));
          if(!verbSurface)return;
          const re=new RegExp('\\b('+verbSurface+')\\s+('+ingPattern+')\\b','gi');
          let m;
          while((m=re.exec(text))){
            const next=findVerbMatch(lexicon,m[2]);
            if(!next||next.kind!=='ing')continue;
            const correct=m[1]+' to '+next.row.v1;
            out.push({
              start:m.index,end:m.index+m[0].length,wrong:m[0],correct:correct,
              title:rule.title||'Verb pattern',category:'Verb pattern',severity:'error',
              priority:rule.priority||113,explanation:rule.explanation||'Use the standard verb pattern.',
              formula:rule.formula||'',
              reasoning:[
                'Main verb: '+m[1],
                'Rule: '+(rule.formula||'verb pattern'),
                'Complement: '+m[2]+' should use the infinitive here',
                'Correction: '+correct
              ]
            });
          }
        }

        if(rule.kind==='fixed_gerund'&&rule.phrase){
          const re=new RegExp('\\b('+escapeRegex(rule.phrase)+')\\s+('+basePattern+')\\b','gi');
          let m;
          while((m=re.exec(text))){
            const next=findVerbMatch(lexicon,m[2]);
            if(!next||next.kind!=='base')continue;
            const correct=m[1]+' '+ingForm(next.row.v1);
            out.push({
              start:m.index,end:m.index+m[0].length,wrong:m[0],correct:correct,
              title:rule.title||'Verb pattern',category:'Verb pattern',severity:'error',
              priority:rule.priority||114,explanation:rule.explanation||'Use the standard verb pattern.',
              formula:rule.formula||'',
              reasoning:[
                'Fixed expression: '+m[1],
                'Rule: '+(rule.formula||'phrase + V-ing'),
                'Following verb: '+m[2]+' → '+ingForm(next.row.v1)
              ]
            });
          }
        }
      }catch(e){}
    });
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

  function thirdPersonIssues(text,kb){
    return dynamicSubjectVerbIssues(text,kb);
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

function tenseIssues(text,kb){
    const out=[];
    const lower=text.toLowerCase();
    if(/\b(yesterday|last\s+\w+|\d+\s+days?\s+ago)\b/.test(lower)){
      const lexicon=buildVerbLexicon(kb);
      const bases=(kb.verbs||[]).map(function(v){return String(v.v1||'').toLowerCase();})
        .filter(Boolean)
        .sort(function(a,b){return b.length-a.length;})
        .map(escapeRegex);
      if(bases.length){
        const re=new RegExp('\\b(he|she|it|i|we|they|you)\\s+('+bases.join('|')+')\\b','gi');
        let m;
        while((m=re.exec(text))){
          const match=findVerbMatch(lexicon,m[2]);
          if(!match||match.kind!=='base')continue;
          const past=correctPastForm(match.row,m[1]);
          if(String(past).toLowerCase()===String(m[2]).toLowerCase())continue;
          out.push({
            start:m.index,end:m.index+m[0].length,
            wrong:m[0],correct:m[1]+' '+past,
            title:'Past Simple',category:'Tense',severity:'error',priority:90,
            explanation:'A completed past-time marker such as “yesterday” normally calls for the Past Simple.',
            formula:'Subject + V2',
            reasoning:[
              'Signal word: a completed past-time marker was detected',
              'Tense: Past Simple',
              'Formula: Subject + V2',
              'Verb: '+m[2]+' → '+past
            ]
          });
        }
      }
    }
    return out;
  }


  function analyze(text,kb){
    const source=kb||defaultKnowledge();
    let list=commonErrorIssues(text,source)
      .concat(learnerErrorIssues(text,source))
      .concat(verbPatternIssues(text,source))
      .concat(contractionIssues(text,source))
      .concat(thirdPersonIssues(text,source))
      .concat(auxiliaryIssues(text))
      .concat(verbFormIssues(text,source))
      .concat(tenseIssues(text,source))
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
