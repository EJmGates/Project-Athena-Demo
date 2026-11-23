
var optionalEpoch=0;
var S={optionalUploads:{},optionalOwner:null,optionalOwnerPending:null,page:"start",cfg:null,bq:null,answers:{},upload:null,plan:null,confirmed:false,result:null,view:"overview",busy:false,failed:null,updateFailed:null,updateBusy:false,drawer:null,acctIssues:null,config:null,configSummary:null,staged:null,cfgIssues:null,cfgNotice:null,shell:"classic",draftNote:null,wiz:null,wizDraft:null,wizFocus:null};
var main=document.getElementById("main"),drawer=document.getElementById("drawer");
S.xblocks=[];S.drawerFrom=null;
var pending=0,planGeneration=0,updateGeneration=0,wizardGeneration=0,configStageGeneration=0,uploadGeneration=0,resultGeneration=0;
function busy(d){pending+=d;document.documentElement.setAttribute("aria-busy",pending>0?"true":"false");}
document.documentElement.setAttribute("aria-busy","false");
function esc(s){return String(s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];});}
function busyLabel(message){return '<span class="analysis-spinner" aria-hidden="true"></span>'+esc(message);}
function n0(x){return Math.round(x).toLocaleString("en-US");}
function n1(x){return (Math.round(x*10)/10).toLocaleString("en-US",{minimumFractionDigits:1,maximumFractionDigits:1});}
function pct(x){return (Math.round(x*1000)/10).toLocaleString("en-US",{minimumFractionDigits:1,maximumFractionDigits:1})+"%";}
function api(){
  return Promise.resolve({status:405,body:{message:"The public demo uses a fixed synthetic report."}});
}
// Uploads are short-lived server-side handles, not saved analysis data. A
// generation lets the browser ignore and release a late inspection response
// after the operator starts over or selects a different file.
function releaseUpload(uploadId){
  if(!uploadId)return;
  fetch("/api/end-session",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({upload_id:uploadId}),keepalive:true}).catch(function(){});
}
function abandonUpload(){
  uploadGeneration++;
  var uploadId=S.upload&&S.upload.upload_id;
  S.upload=null;S.busy=false;S.uploadingFile=null;S.uploadingGrain=null;
  releaseUpload(uploadId);
}
// One owner for every navigation or input action that invalidates a visible
// result. Advancing the generation prevents an older request from reclaiming
// the screen after the operator has changed course.
function invalidateResult(){S.analysisBusy=false;resultGeneration++;S.confirmed=false;S.result=null;}
function go(p){if(S.shell==="sidebar"&&gRoute(p))return;S.modal=null;S.cockpit=false;S.page=p;closeDrawer();document.body.classList.remove("menu-open");render();if(S.shell==="sidebar")window.scrollTo(0,0);main.focus(S.shell==="sidebar"?{preventScroll:true}:undefined);document.getElementById("live").textContent={start:"Start",data:"Your data",insights:"Insights","full-insights":"Full-detail Insights",home:"Home",new:"New Analysis",config:"Session Configuration",guides:"Templates and Guides"}[p]||"";}
function optionalUploadIds(){var o={};Object.keys(S.optionalUploads||{}).forEach(function(k){var u=S.optionalUploads[k].upload;if(u&&u.ok&&u.upload_id)o[k]=u.upload_id;});return o;}
function planBody(){
  var b={answers:S.answers,upload_id:S.upload&&S.upload.ok?S.upload.upload_id:null,configuration:S.config};
  if(S.analysisSetup&&S.analysisSetup.metric_id&&S.analysisSetup.metric_id!=='aht'){
    var setup=S.analysisSetup;
    if(metricScoreFormat(setup.metric_id)==='fraction'&&(!setup.scoring||setup.scoring.scoring_type!=='percent')){
      // Values entered in points cannot be carried over as percentage requirements.
      S.analysisSetup=setup={metric_id:setup.metric_id,direction:setup.direction,scoring:{scoring_type:'percent'}};
    }
    setup.unit=metricUnitOf(setup.metric_id,setup.scoring);
  }      /* the unit follows the scoring, so an older saved draft cannot carry a stale one */
  if(S.shell==="sidebar"){b.journey="cycle1";b.display_unit=S.displayUnit;if(S.analysisMapping)b.analysis_mapping=S.analysisMapping;else if(S.analysisSetup&&(S.analysisSetup.metric_id==='aht'||scoringValid(S.analysisSetup.scoring)))b.analysis_setup=S.analysisSetup;}
  return b;
}
function replan(){
  var generation=++planGeneration;
  return api("/api/plan",planBody()).then(function(r){
    if(generation!==planGeneration)return S.plan;
    if(r.status!==200){S.mappingIssues=(r.body&&r.body.message)||"Review your analysis setup.";S.confirmed=false;render();return S.plan;}
    S.mappingIssues=null;S.plan=r.body;
    // The plan returns only complete, validated answers.  Keep an in-progress
    // number-with-unit or date-range entry in the browser until its companion
    // field is supplied, otherwise every change would erase the prior part.
    var shown={};(S.plan.questions||[]).forEach(function(q){if(!q.unavailable)shown[q.id]=true;});
    Object.keys(S.answers).forEach(function(k){if(!shown[k]&&k!=='report_questions')delete S.answers[k];});
    Object.keys(S.plan.answers||{}).forEach(function(k){if(S.answers[k]===undefined)S.answers[k]=S.plan.answers[k];});
    (S.plan.derived||[]).forEach(function(x){if(x&&x.question)S.answers[x.question]=x.value;});
    render();return S.plan;
  });
}
function setAnswer(id,val){
  if(S.shell==="sidebar")S.cockpitChosen=true;
  // Controls are disabled during Update Analysis, but keep the state guard here
  // as well so a queued/programmatic event cannot make the eventual result and
  // the visible answers disagree.
  if(S.updateBusy)return Promise.resolve(S.plan);
  if(id==='goal')delete S.answers.report_questions;
  if(val===null||val===undefined)delete S.answers[id];else S.answers[id]=val;
  invalidateResult();
  return replan();
}
function openDrawer(html){S.drawerFrom=document.activeElement;S.drawer=html;drawer.hidden=false;drawer.innerHTML=html+'<div class="actions"><button class="btn secondary" id="drawer-close">Close</button></div>';drawer.setAttribute("data-open","true");document.body.classList.add("drawer-open");drawer.focus();}
function closeDrawer(){S.drawer=null;drawer.setAttribute("data-open","false");drawer.hidden=true;document.body.classList.remove("drawer-open");}

function requiredLabel(){return ' <span class="required-label">(Required)</span>';}
function qHtml(q){
 if(S.shell==="sidebar"&&(q.id==="scope_lines_of_business"||q.id==="scope_contact_types"))return scopeSelector(q);
  if(q.unavailable)return '';
  var locked=!!(S.updateBusy&&S.modal&&S.modal.tab==="update");
  var a=S.answers[q.id],cockpit=S.shell==="sidebar"&&S.cockpit,h='<div class="'+(cockpit?(q.type==="date_range"?"cockpit-date-question":"cockpit-question"):"panel")+'"><fieldset'+(locked?' disabled':'')+'><legend>'+esc(q.prompt)+((q.id==='goal'||q.id==='scope_period')?requiredLabel():'')+'</legend>'+(q.hint?'<div class="muted">'+esc(q.hint)+'</div>':'');
  if(q.type==="multi"||q.type==="single"){
    if(cockpit)h+='<div class="cockpit-question-options">';
    if(q.bulk_select)h+='<div class="actions" style="margin-top:6px"><button class="btn secondary" data-all="'+q.id+'">Select all</button></div>';
    q.options.forEach(function(o){var lk=(q.locked||[]).indexOf(o.id)!==-1,on=lk||(q.type==="multi"?(a||[]).indexOf(o.id)!==-1:a===o.id);
      h+='<label class="opt'+(lk?' locked':'')+'"><input type="'+(q.type==="multi"?"checkbox":"radio")+'" name="q-'+q.id+'" data-q="'+q.id+'" value="'+esc(o.id)+'"'+(on?" checked":"")+(lk?" disabled":"")+'><span>'+esc(o.label)+'</span></label>';});
    if(cockpit)h+='</div>';
  }else if(q.type==="number_with_unit"){
    var v=a?a.value:"",u=a?a.unit:"",src=S.plan.prefilled&&S.plan.prefilled[q.id];
    h+='<div class="inline"><input type="number" min="0" step="any" aria-label="'+esc(q.prompt)+'" data-num="'+q.id+'" value="'+esc(v)+'">';
    q.units.forEach(function(x){h+='<label><input type="radio" name="u-'+q.id+'" data-unit="'+q.id+'" value="'+esc(x.id)+'"'+(u===x.id?" checked":"")+'> '+esc(x.label)+'</label>';});
    h+='</div>'+(src?'<p class="muted" style="margin:8px 0 0">From your saved configuration '+esc(src.profile_id)+' '+esc(src.profile_version)+'. Change it here if this run uses a different target.</p>':'');
    if(q.requires_confirmation)h+='<label class="opt" style="margin-top:10px"><input type="checkbox" data-confirm="'+q.id+'"'+(a&&a.confirmed?" checked":"")+'><span>'+esc(q.confirmation_label)+'</span></label>';
  }else if(q.type==="date_range"){
    var s=a?a.start:"",e=a?a.end:"",b=q.bounds||{};
    h+=(b.min?'<div class="muted">Your file covers '+esc(b.min)+' to '+esc(b.max)+'.</div>':'')
      +'<div class="'+(cockpit?'cockpit-dates':'inline')+'"><label>From <input type="date" required aria-required="true" data-date="'+q.id+'" data-end="0" value="'+esc(s)+'" min="'+esc(b.min||"")+'" max="'+esc(b.max||"")+'"></label>'
      +'<label>Until <input type="date" required aria-required="true" data-date="'+q.id+'" data-end="1" value="'+esc(e)+'" min="'+esc(b.min||"")+'" max="'+esc(b.max||"")+'"></label></div>';
  }
  return h+'</fieldset></div>';
}
function metricScoreFormat(id){
  var summary=S.upload&&S.upload.summary;
  return summary&&summary.score_formats&&summary.score_formats[id];
}
function scoringModes(id){
  if(metricScoreFormat(id)==='fraction')return ['percent'];
  var u=S.upload,have=u&&u.summary&&u.summary.extra_columns||[],cols=(metricInfo(id).columns||{})[u&&u.grain]||{};
  return [['scale',cols.score],['percent',cols.pass_flag||cols.pass_rate_pct]]
    .filter(function(mode){return have.includes(mode[1]);}).map(function(mode){return mode[0];});
}
function metricOptions(){
  return ['aht','csat','qa_score'].filter(function(id){return id==='aht'||scoringModes(id).length;}).map(function(id){return {id:id,label:metricInfo(id).label};});}
function scaleDefaults(id){
  if(metricScoreFormat(id)==='binary')return {scoring_type:'scale',scale_start:0,scale_end:1};
  return {scoring_type:'scale',scale_start:id==='csat'?1:0,scale_end:id==='csat'?5:100};
}
function metricUnitOf(id,sc){return id==='aht'?'seconds':(sc&&sc.scoring_type==='percent'?'percent':'points');}
function setMetric(id){var info=metricInfo(id),dir=info.default_direction||'lower_is_better';
  var scoring=scoringModes(id)[0]==='percent'?{scoring_type:'percent'}:scaleDefaults(id);
 S.analysisSetup=id==='aht'?{metric_id:id,direction:dir}:{metric_id:id,direction:dir,scoring:scoring,unit:metricUnitOf(id,scoring)};
  S.cockpitChosen=true;invalidateResult();saveDraft();replan();}
/* Constraints analysis card: shown only when the constraints file is loaded. The choices are sent with the analysis and are not kept in the saved draft. */
function constraintSetup(){S.constraintSetup=S.constraintSetup||{adoption:0.8};return S.constraintSetup;}
function constraintCard(){var u=S.optionalUploads&&S.optionalUploads.D09&&S.optionalUploads.D09.upload;if(!(u&&u.ok))return '';var c=constraintSetup();
  return '<label class="field cockpit-effectivity"><span>Expected effectivity of implemented actions (allowance added to avoid expectations of 100% effectivity)</span><select id="cockpit-adoption" data-constraint="adoption">'
   +[0.5,0.7,0.8].map(function(v){return '<option value="'+v+'"'+(c.adoption===v?' selected':'')+'>'+Math.round(v*100)+'%</option>';}).join('')+'</select></label>';}
document.addEventListener('change',function(e){var t=e.target;if(!t.dataset.constraint||S.analysisBusy||S.updateBusy)return;var c=constraintSetup();
  if(t.dataset.constraint==='adoption')c.adoption=Number(t.value);S.cockpitChosen=true;invalidateResult();render();});
function metricExtra(id){if(id!==metricId())return '';return id==='aht'?durationUnitChooser():'<div class="cockpit-metric-extra" style="grid-column:1/-1">'+metricCard()+'</div>';}
function metricCard(){var id=metricId();if(id==='aht')return '';var sc=(S.analysisSetup&&S.analysisSetup.scoring)||{},v=function(k){return sc[k]===undefined?'':sc[k];};
  var num=function(k,label){return '<label class="field">'+label+requiredLabel()+'<input type="number" step="any" aria-required="true" data-scoring="'+k+'" value="'+esc(v(k))+'"></label>';};
  return '<div class="cockpit-question"><fieldset><legend>Scoring type'+requiredLabel()+'</legend><div class="cockpit-question-options">'
   +[['scale','Scale scoring'],['percent','Percent scoring']].filter(function(o){return scoringModes(id).includes(o[0]);}).map(function(o){return '<label class="opt"><input type="radio" name="scoring-type" data-scoring-type="'+o[0]+'"'+(sc.scoring_type===o[0]?' checked':'')+'><span>'+o[1]+'</span></label>';}).join('')+'</div>'
   +(sc.scoring_type==='scale'?'<div class="cockpit-thresholds">'+num('scale_start','Scale start')+num('scale_end','Scale end')+num('cutoff',id==='csat'?'Cut-off (a score at or above counts as satisfied)':'Cut-off (a score at or above passes)')+'</div>':'')+'</fieldset></div>';}
document.addEventListener('change',function(e){var t=e.target;if(S.updateBusy||!S.analysisSetup)return;
  if(t.dataset.scoringType){var a=S.analysisSetup,sc=t.dataset.scoringType==='scale'?scaleDefaults(a.metric_id):{scoring_type:'percent'};a.scoring=sc;a.unit=metricUnitOf(a.metric_id,sc);S.cockpitChosen=true;invalidateResult();saveDraft();replan();return;}
  if(t.dataset.scoring){var b=S.analysisSetup;b.scoring=b.scoring||{};if(t.value==='')delete b.scoring[t.dataset.scoring];else b.scoring[t.dataset.scoring]=Number(t.value);S.cockpitChosen=true;invalidateResult();saveDraft();replan();}});
function selectorState(id){S.selectorFilters=S.selectorFilters||{};return S.selectorFilters[id]||(S.selectorFilters[id]={query:'',open:false});}
function selectorBox(id,label,options,selected,single){
 var filter=selectorState(id),show=options.length>6||filter.open||!!filter.query,utility=function(mode,text){return '<button type="button" class="selector-utility" id="bulk-'+id+'-'+mode+'" data-selector-bulk="'+id+'" data-bulk-mode="'+mode+'">'+text+'</button>';};
 return '<section class="selection-panel"><div class="selection-heading"><h3>'+esc(label)+requiredLabel()+'</h3><div class="selector-tools"><span class="selection-count">'+selected.length+' selected'+(single?'':' of '+options.length)+'.'+(!single&&selected.length===0?' Select at least one group.':'')+'</span>'+(single?'':utility('all','Select all')+utility('none','Clear all'))+(options.length<=6?'<button type="button" class="selector-utility" id="filter-'+id+'" data-selector-filter="'+id+'" aria-controls="filter-box-'+id+'" aria-expanded="'+show+'">Filter</button>':'')+'</div></div><div id="filter-box-'+id+'"'+(show?'':' hidden')+'><label class="selector-filter-label" for="search-'+id+'">Search '+esc(label.toLowerCase())+'</label><div class="selector-search"><span aria-hidden="true">'+gIcon('M21 21l-5-5M18 10a8 8 0 11-16 0 8 8 0 0116 0',18)+'</span><input id="search-'+id+'" type="search" data-selector-search="'+id+'" value="'+esc(filter.query)+'" autocomplete="off"></div></div><div class="selector-box" data-selector-box="'+id+'" role="group" aria-label="'+esc(label)+'">'+options.map(function(o){var checked=selected.includes(o.id),hidden=!o.label.toLowerCase().includes(filter.query.toLowerCase());return (single?'<div class="cockpit-metric-card">':'')+'<button type="button" role="checkbox" class="selector-option" id="choice-'+id+'-'+esc(o.id)+'" data-selector="'+id+'" data-value="'+esc(o.id)+'" aria-checked="'+checked+'" aria-pressed="'+checked+'"'+(hidden?' hidden':'')+'><span class="selection-check" aria-hidden="true">'+(checked?'✓':'')+'</span><span>'+esc(o.label)+'</span></button>'+(single?metricExtra(o.id)+'</div>':'');}).join('')+'<p class="muted selector-empty"'+(options.some(o=>o.label.toLowerCase().includes(filter.query.toLowerCase()))?' hidden':'')+'>No matching options.</p></div></section>';
}
function scopeSelector(q){var values=S.answers[q.id]||q.options.map(function(o){return o.id;});return selectorBox(q.id,q.id==='scope_lines_of_business'?'Lines of Business':'Contact drivers',q.options,values,false);}
document.addEventListener('input',function(e){var id=e.target.dataset.selectorSearch;if(!id)return;if(cockpitDrag?.control.dataset.selectorBox===id)finishCockpitDrag(false);selectorState(id).query=e.target.value;var box=document.querySelector('[data-selector-box="'+id+'"]'),any=false;Array.from(box.querySelectorAll('button')).forEach(function(o){o.hidden=!o.textContent.toLowerCase().includes(e.target.value.toLowerCase());if(!o.hidden)any=true;});box.querySelector('.selector-empty').hidden=any;});
document.addEventListener('click',function(e){
 var t=e.target.closest('button');if(!t||S.analysisBusy||S.updateBusy)return;
 if(t.dataset.selectorFilter){var id=t.dataset.selectorFilter,state=selectorState(id);state.open=!state.open;if(!state.open&&state.query)state.open=true;render();var el=document.getElementById(state.open?'search-'+id:'filter-'+id);if(el)el.focus({preventScroll:true});return;}
 if(t.dataset.selectorBulk){var id=t.dataset.selectorBulk,q=S.plan.questions.find(q=>q.id===id);if(q)setAnswer(id,t.dataset.bulkMode==='all'?q.options.map(o=>o.id):[]);return;}
 if(!t.dataset.selector)return;S.cockpitChosen=true;if(t.dataset.selector==='metric'){if(t.dataset.value!==metricId())setMetric(t.dataset.value);else render();return;}var q=S.plan.questions.find(q=>q.id===t.dataset.selector),values=(S.answers[q.id]||q.options.map(o=>o.id)).slice(),i=values.indexOf(t.dataset.value);if(i<0)values.push(t.dataset.value);else values.splice(i,1);setAnswer(q.id,values);
});
function phaseQs(ph){return ((S.plan&&S.plan.questions)||[]).filter(function(q){return q.phase===ph&&!q.auto&&!q.unavailable;});}
function issuesHtml(list,showManifest){
  return list.map(function(i){
    return '<div class="notice" role="alert"><b>'+esc(i.problem)+'</b>'+esc(i.why)+' '+esc(i.remedy)
      +(i.rows?'<div class="muted">Rows '+i.rows.join(", ")+(i.row_count>i.rows.length?" and "+n0(i.row_count-i.rows.length)+" more":"")+'</div>':'')+'</div>';
  }).join("")+(showManifest&&S.upload.manifest_url?'<div class="actions"><a class="btn secondary" href="'+esc(S.upload.manifest_url)+'" download>Download the rows to correct</a></div>':"");
}
function setAsideHtml(){
  var N=S.upload.notices||[],rc=S.upload.reconciliation;if(!N.length||!rc)return "";
  var h='<h2>What we set aside</h2><div class="panel"><p style="margin:0 0 8px">'+n0(rc.source_rows)+' rows in your file: '+n0(rc.canonical_valid)+' counted'
    +(rc.collapsed_copies?', '+n0(rc.collapsed_copies)+' repeats counted once':'')+(rc.quarantined?', '+n0(rc.quarantined)+' set aside as invalid':'')+(rc.held?', '+n0(rc.held)+' held because of a conflict':'')+'.</p>';
  N.forEach(function(n){var info=(n.disposition==="valid"||n.disposition==="flag");
    h+='<div class="notice'+(info?' info':'')+'"><b>'+esc(n.problem)+'</b>'+esc(n.why)+' '+esc(n.effect)+(info?'':' '+esc(n.remedy))
      +'<div class="muted">Rows '+n.rows.join(", ")+(n.row_count>n.rows.length?" and "+n0(n.row_count-n.rows.length)+" more":"")+'</div></div>';});
  if(S.upload.manifest_url)h+='<div class="actions"><a class="btn secondary" href="'+esc(S.upload.manifest_url)+'" download>Download the rows to correct</a></div>';
  return h+'</div>';
}

function dayBefore(d){var t=new Date(d+"T00:00:00Z");t.setUTCDate(t.getUTCDate()-1);return t.toISOString().slice(0,10);}
function dirText(d){return {lower_is_better:"Lower is better",higher_is_better:"Higher is better",within_bounds:"Within bounds",monitor_only:"Monitor only"}[d]||d;}
function num(x){return (x===null||x===undefined)?"—":durationNumber(x,true);}
/* The analysed metric: from the result when there is one, otherwise from the Cockpit setup. Units come from the registry served in /api/config. */
function metricId(){var R=S.result;return R&&R.metric?R.metric.metric_id:((S.analysisSetup&&S.analysisSetup.metric_id)||'aht');}
function metricInfo(id){return (S.cfg&&S.cfg.metrics&&S.cfg.metrics[id||metricId()])||{label:'Average handle time',directions:['lower_is_better','higher_is_better','within_bounds','monitor_only']};}
function metricScoring(){var R=S.result;return R&&R.metric?R.metric.scoring:(S.analysisSetup&&S.analysisSetup.scoring)||null;}
function metricKind(){var id=metricId(),sc=metricScoring();if(id==='aht')return 'seconds';return sc&&sc.scoring_type==='percent'?'percent':'points';}
function ML(){var id=metricId();if(id==='aht')return 'Average handle time';
  var basis=S.result&&S.result.metric&&S.result.metric.percent_basis;
  var supplied=basis?basis==='supplied_fraction':metricScoreFormat(id)==='fraction';
  if(metricKind()==='percent'&&!supplied)return id==='csat'?'Customer satisfaction rate':'QA pass rate';
  return metricInfo().label;}
function ml(){return ML().toLowerCase();}
function scoringValid(s){if(!s)return false;if(s.scoring_type==='percent')return true;if(s.scoring_type!=='scale')return false;var f=function(x){return typeof x==='number'&&isFinite(x);};return f(s.scale_start)&&f(s.scale_end)&&s.scale_start<s.scale_end&&f(s.cutoff)&&s.cutoff>=s.scale_start&&s.cutoff<=s.scale_end;}
function durationUnit(){if(metricKind()!=='seconds')return metricKind();return S.displayUnit||'seconds';}
function durationFactor(unit){if(metricKind()!=='seconds')return 1;return S.cfg.duration_units[unit||durationUnit()];}
function durationUnitName(capitalize){var value=durationUnit();return capitalize?value[0].toUpperCase()+value.slice(1):value;}
function reportUnitSymbol(unit){return unit==='seconds'?'sec':unit;}
function durationUnitSymbol(){return {seconds:'sec',minutes:'min',hours:'hr',percent:'%',points:'pts'}[durationUnit()];}
function displayNumber(value,digits,maxDigits=digits){
  var magnitude=Math.abs(value);
  if(magnitude>0&&magnitude<.5*10**(-maxDigits)){
    maxDigits=Math.max(maxDigits,1-Math.floor(Math.log10(magnitude)));
    if(maxDigits>7)return value.toExponential(2);
  }
  return (value===0?0:value).toLocaleString('en-US',{minimumFractionDigits:digits,maximumFractionDigits:maxDigits});
}
function durationNumber(value,integer){
  if(value===null||value===undefined)return '—';
  if(metricKind()!=='seconds')return displayNumber(value,integer?0:1,integer?20:1);
  var digits=durationUnit()==='seconds'?(integer?0:1):2;
  return displayNumber(value/durationFactor(),digits);
}
function percentNumber(value){return displayNumber(value,1);}
function editableDuration(value,inputUnit){if(metricKind()!=='seconds')return value;return value*durationFactor(inputUnit||'seconds')/durationFactor();}
function durationUnitChooser(){if(metricId()!=='aht')return '';return '<label class="field cockpit-unit" for="aht-unit">Unit<select id="aht-unit" aria-required="true" aria-describedby="aht-unit-help">'+Object.keys(S.cfg.duration_units).map(unit=>'<option value="'+unit+'"'+(unit===S.displayUnit?' selected':'')+'>'+unit[0].toUpperCase()+unit.slice(1)+'</option>').join('')+'</select></label><p class="muted cockpit-unit-help" id="aht-unit-help">Controls target entry and report display. Source handling fields remain seconds.</p>';}
function calcText(R){var k=metricKind();
  if(k==='seconds')return "Total handling "+durationUnitName(false)+" divided by handled contacts: "+durationNumber(R.total,true)+" "+durationUnitSymbol()+" ÷ "+n0(R.count)+" contacts = "+durationNumber(R.value,false)+" "+durationUnitSymbol();
  if(k==='percent'){
    var rate=durationNumber(R.value,false)+' %';
    if(R.metric.percent_basis==='supplied_fraction')return 'Weighted average of the supplied scores over '+n0(R.count)+' '+gCountLabel(R).toLowerCase()+', expressed as a percentage = '+rate;
    return R.metric.percent_basis==='pass_flags'
      ? n0(R.total/100)+' passes out of '+n0(R.count)+' contacts with pass outcomes = '+rate
      : 'Supplied rates pooled over '+n0(R.count)+' handled contacts = '+rate;
  }
  return 'Weighted average over '+n0(R.count)+' '+gCountLabel(R).toLowerCase()+' = '+durationNumber(R.value,false)+' '+durationUnitSymbol();}
function weightingFormula(unweighted){if(metricKind()!=='seconds')return unweighted?"Sum of each agent's result ÷ number of agents":"Pooled over every scored contact";return unweighted?"Sum of each agent's mean ("+durationUnitName()+") ÷ number of agents":"Total handling "+durationUnitName()+" ÷ handled contacts";}
function weightingNarrative(w){return 'Contact-weighted average '+durationNumber(w.contact_weighted.value,false)+' '+durationUnitSymbol()+', compared with '+durationNumber(w.unweighted_agent_mean.value,false)+' '+durationUnitSymbol()+' for the average of agent averages. Each contact contributes according to its volume.';}
document.addEventListener('change',function(e){if(e.target.id==='sample-set'){
  S.sampleSet=e.target.value==='stress'?'stress':'happy';
  try{sessionStorage.setItem(SAMPLE_CHOICE_KEY,S.sampleSet);}catch(error){}
}});
document.addEventListener('change',function(e){if(e.target.id!=='aht-unit')return;S.displayUnit=e.target.value;S.cockpitChosen=true;invalidateResult();saveDraft();replan();});
function targetsTable(ts){
  return '<div class="scroll"><table><thead><tr><th>Applies</th><th class="n">Target ('+durationUnitSymbol()+')</th><th class="n">Lower limit ('+durationUnitSymbol()+')</th><th class="n">Upper limit ('+durationUnitSymbol()+')</th><th>Direction</th></tr></thead><tbody>'
   +ts.map(function(t){return '<tr><td>'+(t.scope?esc((t.scope.kind==="line_of_business"?"Line of Business ":"Contact type ")+t.scope.values.join(", "))+', ':'')+esc(t.start)+(t.end?' to '+esc(dayBefore(t.end)):' onward')+'</td><td class="n">'+num(t.target)+'</td><td class="n">'+num(t.lower_specification_limit)+'</td><td class="n">'+num(t.upper_specification_limit)+'</td><td>'+esc(dirText(t.direction))+'</td></tr>';}).join('')+'</tbody></table></div>';
}
function profileDetailRows(p){
  var rows=[['Industry',p.industry],['Lines of business',(p.lines_of_business||[]).join(', ')],['Contact channels',(p.contact_channels||[]).join(', ')],['Countries and regions supported',(p.regions_supported||[]).join(', ')]];
  if(p.hours)rows.push(['Operating hours',p.hours.mode==='24_7'?'24/7':p.hours.days.map(d=>['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][d]).join(', ')+' '+p.hours.start+'–'+p.hours.end+(p.hours.ends_next_day?' (next day)':'')]);
  if(p.shifts&&p.shifts.length)rows.push(['Shifts',p.shifts.map(v=>v.name).join(', ')]);
  return rows;
}
function profileSummaryHtml(p){var rows=[['Project or analysis title',p.project_name],...profileDetailRows(p)];return '<dl>'+rows.filter(v=>v[1]).map(v=>'<dt>'+esc(v[0])+'</dt><dd>'+esc(v[1])+'</dd>').join('')+'</dl>';}
function cfgSummaryDl(m){return '<dl><dt>Account name</dt><dd>'+esc(m.account_id)+'</dd><dt>Operating hours time zone</dt><dd>'+esc(m.business_timezone)+'</dd><dt>Date format</dt><dd>'+esc(dateFormatText(m.date_format))+'</dd></dl>'+profileSummaryHtml(m.operating_profile||{});}
function activeConfigName(){return (S.configSummary&&S.configSummary.business_label)||"Active session configuration";}
function cfgIssuesHtml(list){
  return list.map(function(i){return '<div class="notice" role="alert"><b>'+esc(i.problem)+'</b>'+esc(i.why)+' '+esc(i.remedy)+(i.fields?'<div class="muted">Fields: '+esc(i.fields.join(", "))+'</div>':'')+'</div>';}).join("");
}
function sessionConfigHtml(){
  var h='<h2>Account configuration</h2>';
  if(S.cfgNotice)h+='<div class="notice info"><b>The configuration saved for this tab was not restored.</b>'+esc(S.cfgNotice)+'</div>';
  if(S.config)h+='<div class="panel"><strong>Active for this session</strong>'+cfgSummaryDl(S.configSummary)+targetsTable(S.configSummary.targets)
    +(S.configSummary.scoped_targets&&S.configSummary.scoped_targets.length?'<p class="muted" style="margin:10px 0 4px">Targets that name a Line of Business or contact type</p>'+targetsTable(S.configSummary.scoped_targets):'')+'</div>';
  else h+='<p class="muted">No configuration is active for this session. Upload one and Athena applies it for as long as this tab stays open. Nothing is stored on the server.</p>';
  if(S.staged){
    h+='<div class="panel"><strong>Review before using</strong>'+cfgSummaryDl(S.staged.summary)+targetsTable(S.staged.summary.targets)
      +(S.staged.warnings||[]).map(function(w){return '<p class="muted">'+esc(w.text)+(w.from?' ('+esc(w.from)+' to '+esc(dayBefore(w.to)||w.to)+')':'')+'</p>';}).join('')
      +(S.staged.changes&&S.staged.changes.length?'<strong>What changes</strong><ul class="plain">'+S.staged.changes.map(function(c){return '<li>'+esc(c)+'</li>';}).join('')+'</ul>':'')
      +'<div class="actions"><button class="btn" id="cfg-use">Use for this session</button><button class="btn secondary" id="cfg-discard">Discard</button></div></div>';
  }
  if(S.cfgIssues&&S.cfgIssues.length)h+=cfgIssuesHtml(S.cfgIssues);
  h+='<div class="actions"><a class="btn secondary" href="/api/account-template" download>Download the blank configuration</a>'
    +'<label class="btn secondary" for="acctfile">'+(S.config?'Replace the configuration':'Upload a configuration')+'</label><input class="sr" id="acctfile" type="file" accept=".json,application/json">'
    +(S.config?'<button class="btn secondary" id="cfg-end">End session</button>':'')+'</div>';
  return h;
}
/* ---- guided configuration wizard (sidebar shell). The server validates; the page only builds, shows and explains. ---- */
var WKEY="athena.wizard", NEW_WKEY="athena.wizard.new", SAMPLE_CHOICE_KEY="athena.settings.sample";
var WSTEPS=["Account","Coverage","Business time zone","Review"];
var WREASON={"profile-hours":"Choose operating days and valid start/end times. Select Ends on the following day for overnight hours.","profile-shifts":"Each shift needs a unique name, operating days and valid times. Mark overnight shifts as ending on the following day.","profile-value":"Check this operating-business field and its allowed length or choices.",required:"Required.","enum":"Choose one.","format:date":"Enter a real date.","format:date-time":"Enter a real date and time.",minItems:"Add at least one.",minLength:"Required.",pattern:"Enter a value without spaces at the start or end.",exclusiveMinimum:"Must be above zero.",minimum:"Too small.",type:"Not the right kind of value.",additionalProperties:"Not recognised.","const":"Not valid."};
var WDIRS=[["lower_is_better","Lower is better"],["higher_is_better","Higher is better"],["within_bounds","Within bounds"],["monitor_only","Monitor only"]];
function wJ(x){return JSON.parse(JSON.stringify(x));}
function nextDay(d){var t=new Date(d+"T00:00:00Z");t.setUTCDate(t.getUTCDate()+1);return t.toISOString().slice(0,10);}
function p2(n){return String(n).padStart(2,"0");}
function localFromIso(iso){if(!iso)return "";var t=new Date(iso);if(isNaN(t))return "";return t.getFullYear()+"-"+p2(t.getMonth()+1)+"-"+p2(t.getDate())+"T"+p2(t.getHours())+":"+p2(t.getMinutes())+":"+p2(t.getSeconds());}
function isoFromLocal(l){if(!l)return "";var t=new Date(l);if(isNaN(t))return "";return t.toISOString().replace(/\.\d{3}Z$/,"Z");}
function blankVersion(){return {label:"",start:"",last:"",target:"",lower:"",upper:"",material:"",scopeKind:"",scopeVals:[],dir:"",orig:null};}
function blankModel(){return {draft_id:crypto.randomUUID(),id:"",ver:"",acc:{id:"",tz:"",covFrom:"",covLast:"",fmt:"month_first"},profile:{}};}
function modelFromConfig(cfg){var m=blankModel(),a=cfg.account;m.id=cfg.configuration_id;m.ver=cfg.configuration_version;m.draft_id=cfg.draft_id||m.draft_id;m.acc={id:a.account_id,tz:a.business_timezone,covFrom:a.coverage_start||"",covLast:a.coverage_end?dayBefore(a.coverage_end):"",fmt:a.date_format||"month_first"};m.profile=wJ(cfg.operating_profile||(cfg.extensions||{}).operating_profile||{});delete m.profile.markets_served;m.source_configuration=wJ(cfg);return m;}
/* Direction requirements come from the metric registry (served in /api/config), never from a copy here. */
/* How uploaded files are read comes from the applied configuration: the account time zone and the date format. */
function dateSettings(){var a=(S.config&&S.config.account)||{};return {date_format:a.date_format||'month_first',time_zone:a.business_timezone||'Asia/Manila'};}
function dateHeaders(){var d=dateSettings();return {'X-Date-Format':d.date_format,'X-Business-Timezone':d.time_zone};}
/* True when a loaded file was read with a different format or zone than the configuration now says. */
function datesStale(){var d=dateSettings(),differs=function(u){var s=u&&u.date_settings;return !!s&&(s.date_format!==d.date_format||s.time_zone!==d.time_zone);};
  return differs(S.upload)||Object.keys(S.optionalUploads||{}).some(function(id){return differs(S.optionalUploads[id].upload);});}
function dirRequires(d){var D=S.cfg&&S.cfg.directions&&S.cfg.directions[d];return D?D.requires:[];}
function ruleFor(d){return dirRequires(d).indexOf('target')>=0?S.cfg.directions[d].target_rule:null;}
function verLabel(v){return v.label||("AHT from "+(v.start||"the start")+((v.scopeKind==="lines_of_business"||v.scopeKind==="types")&&v.scopeVals.length?" ("+v.scopeVals.join(", ")+")":""));}
function versionMetric(m,v){
  var o=v.orig?wJ(v.orig):{},dir=m.mixedDir?v.dir:m.direction,rule=ruleFor(dir);
  o.metric_id="aht";o.definition_version=verLabel(v);o.canonical_unit="seconds";o.direction=dir;
  if(v.start)o.effective_start=v.start;else delete o.effective_start;
  if(v.last)o.effective_end=nextDay(v.last);else delete o.effective_end;
  if(v.target!==""&&rule){o.target=Number(v.target);o.target_rule=rule;}else{delete o.target;delete o.target_rule;}
  [["lower","lower_specification_limit"],["upper","upper_specification_limit"],["material","materiality_seconds"]].forEach(function(p){if(v[p[0]]!=="")o[p[1]]=Number(v[p[0]]);else delete o[p[1]];});
  delete o.applies_to;
  if(v.scopeKind==="lines_of_business")o.applies_to={line_of_business_ids:v.scopeVals.slice()};else if(v.scopeKind==="types")o.applies_to={contact_types:v.scopeVals.slice()};
  return o;
}
function cleanProfile(p){var out=wJ(p||{});Object.keys(out).forEach(function(k){if(typeof out[k]==='string'&&!out[k].trim()||Array.isArray(out[k])&&!out[k].length)delete out[k];});return out;}
function modelToPayload(m){var a=m.acc,acct={account_id:a.id,business_timezone:a.tz},profile=cleanProfile(m.profile);if(a.covFrom)acct.coverage_start=a.covFrom;if(a.covLast)acct.coverage_end=nextDay(a.covLast);
 var source=m.source_configuration;
 /* The date format is stored only when it is not the default or the source already had one, so an unchanged setup keeps its revision. */
 if(a.fmt==='day_first'||(source&&source.account.date_format))acct.date_format=a.fmt;
 if(source){var priorAccount={account_id:source.account.account_id,business_timezone:source.account.business_timezone,...(source.account.coverage_start?{coverage_start:source.account.coverage_start}:{}),...(source.account.coverage_end?{coverage_end:source.account.coverage_end}:{}),...(source.account.date_format?{date_format:source.account.date_format}:{})},priorProfile=source.operating_profile||(source.extensions||{}).operating_profile||{};
 if(JSON.stringify(acct)===JSON.stringify(priorAccount)&&JSON.stringify(profile)===JSON.stringify(cleanProfile(priorProfile)))return wJ(source);
 if(!['0.3.0','0.4.0'].includes(source.schema_version)){var original=wJ(source),olderAcct=Object.assign({},acct);delete olderAcct.date_format;original.account=Object.assign({},original.account,olderAcct);if(!a.covFrom)delete original.account.coverage_start;if(!a.covLast)delete original.account.coverage_end;original.extensions=original.extensions||{};if(Object.keys(profile).length)original.extensions.operating_profile=profile;else delete original.extensions.operating_profile;delete original.provenance;original.prior_provenance=wJ(source.provenance);original.prior_snapshot=wJ(source);return {guided_form:original};}}
 var payload={schema_version:'0.4.0',draft_id:m.draft_id,account:acct};if(Object.keys(profile).length)payload.operating_profile=profile;if(m.id)payload.configuration_id=m.id;return {session_setup:payload};}
function ctlRank(k){
  var fixed=["label","acc.id","acc.lines_of_business","acc.types","acc.covFrom","acc.covLast","acc.tz","acc.fmt","direction","others","conf.preparedBy","conf.authorizedBy","conf.authorizedAt","conf.ref"],i=fixed.indexOf(k);
  if(i>=0)return i;var r=/^v(\d+)\.(\w+)$/.exec(k);
  if(r)return 100+(+r[1])*20+["dir","start","last","target","lower","upper","material","scope"].indexOf(r[2]);return 9999;
}
function ctlStep(k){if(k==="acc.tz"||k==="acc.fmt")return 3;if(k==="acc.covFrom"||k==="acc.covLast")return 2;if(k==="label"||k.indexOf("acc.")===0)return 1;if(k==="direction"||k==="others"||/^v\d+\./.test(k))return 2;if(k.indexOf("conf.")===0)return 3;return 4;}
function fieldCtl(m,f){
  if(f.indexOf('operating_profile.')===0){var key=f.slice(18);return 'profile.'+(key==='hours'?'hours.start':key==='shifts'?'shift-error':key);}
  var map={"account.account_id":"acc.id","account.line_of_business_ids":"acc.lines_of_business","account.contact_types":"acc.types","account.business_timezone":"acc.tz","account.date_format":"acc.fmt","account.coverage_start":"acc.covFrom","account.coverage_end":"acc.covLast",
    "confirmation.prepared_by":"conf.preparedBy","confirmation.confirmed_by":"conf.authorizedBy","confirmation.confirmed_at":"conf.authorizedAt","confirmation.confirmation_reference":"conf.ref"};
  if(map[f])return map[f];
  var r=/^metrics\[(\d+)\]\.(\w+)$/.exec(f);
  if(r){var i=+r[1];if(i>=m.versions.length)return "others";
    var k={effective_start:"start",definition_version:"start",effective_end:"last",target:"target",lower_specification_limit:"lower",upper_specification_limit:"upper",materiality_seconds:"material",applies_to:"scope"}[r[2]];
    if(!k)return (m.mixedDir&&r[2]==="direction")?("v"+i+".dir"):"direction";
    return "v"+i+"."+k;}
  return "general";
}
function wizClientErrors(m,errs){}
function wizCollect(res,m){
  var errs={};
  (res.issues||[]).forEach(function(it){
    (it.fields||[]).forEach(function(f){var ctl=fieldCtl(m,f);if(errs[ctl])return;errs[ctl]=(it.field_reasons&&it.field_reasons[f])?(WREASON[it.field_reasons[f]]||"Not valid."):(it.problem+" "+it.remedy);});
    if(!(it.fields||[]).length&&!errs.general)errs.general=it.problem+" "+it.remedy;
  });
  wizClientErrors(m,errs);return errs;
}
function wizValidate(){
  var wiz=S.wiz;if(!wiz)return Promise.resolve(null);
  var m=wiz.m,generation=++wizardGeneration;
  return api("/api/configuration/validate",modelToPayload(m)).then(function(r){
    if(generation!==wizardGeneration||S.wiz!==wiz)return null;
    if(r.body.ok&&m.source_configuration&&JSON.stringify(modelToPayload(m))===JSON.stringify(m.source_configuration))r.body.configuration=wJ(m.source_configuration);
    wiz.result=r.body;wiz.errors=wizCollect(r.body,m);return r.body;
  });
}
function saveWiz(){
  if(!S.wiz||(!S.pendingNew&&(S.wizRecovery||S.legacyWizPending)))return;
  try{
    var m=wJ(S.wiz.m),src=m.source_configuration;
    if(S.pendingNew&&JSON.stringify(m)===S.pendingNew.initial&&!S.newWizDraft)return;
    delete m.source_configuration;
    sessionStorage.setItem(S.pendingNew?NEW_WKEY:WKEY,JSON.stringify(Object.assign({v:4,m:m},src?{source_configuration:src}:{})));
  }catch(e){}
}
function clearWiz(){S.wizRecovery=false;S.legacyWizPending=false;try{sessionStorage.removeItem(WKEY);}catch(e){}S.wizDraft=null;}
function readNewWizardDraft(){
  try{
    var draft=JSON.parse(sessionStorage.getItem(NEW_WKEY));
    if(draft&&draft.v===4&&validWizardDraft(draft))return draft;
  }catch(e){}
  return null;
}
function clearNewWizardDraft(){S.newWizDraft=null;try{sessionStorage.removeItem(NEW_WKEY);}catch(e){}}
function keysOnly(o,keys){return plainObject(o)&&Object.keys(o).every(function(k){return keys.includes(k);});}
function shortText(v,n){return typeof v==='string'&&v.length<=n;}
function validStringList(a){return Array.isArray(a)&&a.length<=10000&&a.every(function(v){return shortText(v,128)&&v.length>0;})&&new Set(a).size===a.length;}
function draftDate(v){return v===undefined||v===''||typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!isNaN(new Date(v+'T00:00:00Z'))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;}
function finiteDraftNumber(v){return typeof v==='number'&&Number.isFinite(v);}
function validMappingDraft(a){return Array.isArray(a)&&a.length<=100&&a.every(function(m){if(!keysOnly(m,['metric_id','definition_version','effective_start','effective_end','direction','canonical_unit','target','target_rule','lower_specification_limit','upper_specification_limit','applies_to','aggregation_rule','handling_components','materiality_seconds','numerator_id','denominator_id','guardrail','bounded_min','bounded_max','handling_equals_component_sum']))return false;
 if(m.metric_id!=='aht'||m.canonical_unit!=='seconds'||!shortText(m.definition_version,128)||!['','lower_is_better','higher_is_better','within_bounds','monitor_only'].includes(m.direction)||!draftDate(m.effective_start)||!draftDate(m.effective_end))return false;
 if(['target','lower_specification_limit','upper_specification_limit','materiality_seconds','bounded_min','bounded_max'].some(function(k){return k in m&&!finiteDraftNumber(m[k]);})||['guardrail','handling_equals_component_sum'].some(function(k){return k in m&&typeof m[k]!=='boolean';}))return false;
 if('target_rule' in m&&!['at_or_below','at_or_above','inclusive_range','none'].includes(m.target_rule))return false;
 if(m.applies_to!==undefined&&(!keysOnly(m.applies_to,['line_of_business_ids','contact_types'])||Object.keys(m.applies_to).length!==1||!Object.values(m.applies_to).every(validStringList)))return false;
 return (!('handling_components' in m)||validStringList(m.handling_components))&&['aggregation_rule','numerator_id','denominator_id'].every(function(k){return !(k in m)||shortText(m[k],1000);});});}
function validSetupDraft(a){if(!keysOnly(a,['metric_id','direction','unit','scoring','target','lower_specification_limit','upper_specification_limit','periods'])||!['aht','csat','qa_score'].includes(a.metric_id)||('unit' in a&&(typeof a.unit!=='string'||(a.metric_id==='aht'?!Object.prototype.hasOwnProperty.call(S.cfg.duration_units,a.unit):!['percent','points'].includes(a.unit))))||('scoring' in a&&(!plainObject(a.scoring)||!['scale','percent'].includes(a.scoring.scoring_type)||Object.keys(a.scoring).some(function(k){return !['scoring_type','scale_start','scale_end','cutoff'].includes(k)||(k!=='scoring_type'&&!finiteDraftNumber(a.scoring[k]));})))||!['lower_is_better','higher_is_better','within_bounds','monitor_only'].includes(a.direction))return false;
 var numbers=['target','lower_specification_limit','upper_specification_limit'];if(numbers.some(function(k){return k in a&&!finiteDraftNumber(a[k]);}))return false;
 return !('periods' in a)||Array.isArray(a.periods)&&a.periods.length<=100&&a.periods.every(function(p){return keysOnly(p,['effective_start','effective_end'].concat(numbers))&&draftDate(p.effective_start)&&draftDate(p.effective_end)&&numbers.every(function(k){return !(k in p)||finiteDraftNumber(p[k]);});});}
function validSourceDraft(c){if(!plainObject(c)||!['0.2.0','0.3.0','0.4.0'].includes(c.schema_version)||!plainObject(c.account)||!shortText(c.account.account_id,128)||!shortText(c.account.business_timezone,64))return false;
 if(!plainObject(c.provenance)||!Array.isArray(c.provenance.inputs)||!Array.isArray(c.provenance.transformations))return false;
 if(c.schema_version==='0.2.0')return Array.isArray(c.metrics)&&c.metrics.every(function(m){return plainObject(m)&&shortText(m.metric_id,128);})&&plainObject(c.confirmation);
 return !('metrics' in c)&&!('confirmation' in c)&&(!('operating_profile' in c)||validProfileDraft(c.operating_profile));}
function validLegacyVersion(v){if(!plainObject(v))return false;var strings=['label','start','last','target','lower','upper','material','scopeKind','dir'];if(strings.some(function(k){return k in v&&!shortText(v[k],128);}))return false;
 if(['target','lower','upper','material'].some(function(k){return k in v&&v[k]!==''&&!Number.isFinite(Number(v[k]));}))return false;
 if(!draftDate(v.start)||!draftDate(v.last)||('scopeVals' in v&&!validStringList(v.scopeVals)))return false;
 if(v.scopeKind&& !['account','lines_of_business','types'].includes(v.scopeKind))return false;
 if((v.scopeKind==='lines_of_business'||v.scopeKind==='types')&&!Array.isArray(v.scopeVals))return false;
 return v.orig===undefined||v.orig===null||plainObject(v.orig)&&validMappingDraft([v.orig]);}
function validProfileDraft(p){if(!keysOnly(p,['project_name','account_name','industry','current_phase','contact_flow','service_scope','support_notes','account_background','lines_of_business','contact_channels','regions_supported','service_languages','delivery_sites','hours','shifts']))return false;
 var limits={project_name:128,account_name:128,industry:128,current_phase:128,contact_flow:20,service_scope:2000,support_notes:2000,account_background:8000};if(Object.keys(limits).some(k=>k in p&&(!shortText(p[k],limits[k])||(['service_scope','support_notes','account_background'].includes(k)?/[\x00-\x08\x0b-\x1f\x7f]/:/[\x00-\x1f\x7f]/).test(p[k]))))return false;
 var lists=['lines_of_business','contact_channels','regions_supported','service_languages','delivery_sites'];if(lists.some(k=>k in p&&(!Array.isArray(p[k])||p[k].length>50||p[k].some(v=>!shortText(v,128)||/[\x00-\x1f\x7f]/.test(v)))))return false;
 function interval(v,shift){if(!keysOnly(v,shift?['name','days','start','end','ends_next_day']:['mode','days','start','end','ends_next_day']))return false;if(!shift&&v.mode==='24_7')return Object.keys(v).length===1;if(!shift&&v.mode!=='weekly')return false;if(shift&&(!shortText(v.name,128)||/[\x00-\x1f\x7f]/.test(v.name)))return false;return Array.isArray(v.days)&&v.days.length<=7&&v.days.every(d=>Number.isInteger(d)&&d>=0&&d<=6)&&typeof v.start==='string'&&(v.start===''||/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(v.start))&&typeof v.end==='string'&&(v.end===''||/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(v.end))&&typeof v.ends_next_day==='boolean';}
 return (!('hours' in p)||interval(p.hours,false))&&(!('shifts' in p)||Array.isArray(p.shifts)&&p.shifts.length<=50&&p.shifts.every(v=>interval(v,true)));}
function validWizardDraft(d){if(!plainObject(d)||![1,2,3,4].includes(d.v)||!plainObject(d.m)||!plainObject(d.m.acc))return false;var m=d.m,a=m.acc;
 if(!shortText(a.id,128)||!shortText(a.tz,64)||!draftDate(a.covFrom)||!draftDate(a.covLast))return false;
 if(d.v===1)return Array.isArray(m.versions)&&m.versions.length<=100&&m.versions.every(validLegacyVersion)&&plainObject(m.conf)&&['preparedBy','authorizedBy','authorizedAt','authorizedAtOrig','ref'].every(function(k){return !(k in m.conf)||shortText(m.conf[k],2000);})&&(!('lines_of_business' in a)||validStringList(a.lines_of_business))&&(!('types' in a)||validStringList(a.types))&&(!('direction' in m)||['','lower_is_better','higher_is_better','within_bounds','monitor_only'].includes(m.direction))&&(!('mixedDir' in m)||typeof m.mixedDir==='boolean');
 return keysOnly(d,['v','m','source_configuration'])&&keysOnly(m,d.v===4?['draft_id','id','ver','acc','profile','chip_pending']:['draft_id','id','ver','acc','profile'])&&(d.v!==4||!('chip_pending' in m)||validChipPending(m.chip_pending))&&(d.v<3||validProfileDraft(m.profile))&&keysOnly(a,['id','tz','covFrom','covLast','fmt'])&&(!('fmt' in a)||a.fmt==='month_first'||a.fmt==='day_first')&&shortText(m.draft_id,64)&&/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(m.draft_id)&&shortText(m.id,128)&&shortText(m.ver,128)&&(d.source_configuration===undefined||validSourceDraft(d.source_configuration));}
function restoreWiz(){if(S.shell!=="sidebar")return Promise.resolve();S.newWizDraft=readNewWizardDraft();var raw=null;try{raw=sessionStorage.getItem(WKEY);}catch(e){}if(!raw)return Promise.resolve();var d=null;try{d=JSON.parse(raw);}catch(e){}if(!validWizardDraft(d)){S.wizRecovery=true;S.cfgNotice="A saved configuration draft could not be restored. It is kept until you choose Reset saved draft.";return Promise.resolve();}
 if(d.v===1){var old=d.m,m=blankModel();m.id=old.id||"";m.ver=old.ver||"";m.acc={id:old.acc.id,tz:old.acc.tz,covFrom:old.acc.covFrom||"",covLast:old.acc.covLast||"",fmt:"month_first"};if(Array.isArray(old.versions)){S.analysisMapping=old.versions.map(function(v){return versionMetric(old,v);});}d={v:2,m:m};S.legacyWizPending=true;}
 if(!d.m.profile)d.m.profile={};if(d.source_configuration)d.m.source_configuration=d.source_configuration;d.step=1;d.furthest=4;S.wizDraft=d;return Promise.resolve();}
function openWizard(model,step){wizardGeneration++;stageOther=false;S.wiz={step:step||1,furthest:step||1,m:model,errors:{},attempted:{},result:null,compat:null,changes:[]};S.wizDraft=null;saveWiz();if(S.shell!=="sidebar")S.page="config";S.wizFocus="w-first";if(S.shell==="sidebar"&&!S.modal)S.modal={tab:"wizard",from:null};render();}
function resumeWizard(){var d=S.wizDraft;if(!d)return;wizardGeneration++;stageOther=false;S.wiz={step:d.step,furthest:d.furthest,m:d.m,errors:{},attempted:{},result:null,compat:null,changes:[]};S.wizDraft=null;wizEnter();}
function closeWizard(){if(!flushProfileChips())return;var wiz=S.wiz;if(!wiz)return;wiz.attempted={1:true,2:true,3:true,4:true};wizValidate().then(function(r){if(S.wiz!==wiz||S.modal?.closing)return;if(r&&r.ok){gDismissSettings(wizUse);return;}saveWiz();wiz.step=Object.keys(wiz.errors).map(ctlStep).sort()[0]||1;S.wizFocus=ctlId(Object.keys(wiz.errors).sort(function(a,b){return ctlRank(a)-ctlRank(b);})[0]||"acc.id");render();});}
function wizEnter(){
  var wiz=S.wiz;if(!wiz)return Promise.resolve(null);
  busy(1);var fin=function(){setTimeout(function(){busy(-1);},0);};
  var go2=function(){if(S.wiz!==wiz)return;S.wizFocus="w-first";render();};
  var p=wiz.step===4?wizReview().then(go2):wizValidate().then(go2);
  p.then(fin,fin);return p;
}
function wizRender(){saveWiz();render();}
function wizReview(){
  var wiz=S.wiz;if(!wiz)return Promise.resolve(null);
  var m=wiz.m;wiz.attempted[4]=true;
  return wizValidate().then(function(res){
    if(!res||S.wiz!==wiz)return res;
    wiz.compat=null;wiz.changes=[];
    var jobs=[];
    if(res.ok&&S.configSummary)jobs.push(api("/api/configuration/diff",{active:S.configSummary,staged:res.summary}).then(function(d){if(S.wiz===wiz)wiz.changes=d.body.lines||[];}));
    if(res.ok&&S.upload&&S.upload.ok)jobs.push(api("/api/plan",{answers:{},upload_id:S.upload.upload_id,configuration:res.configuration}).then(function(p){if(S.wiz===wiz)wiz.compat=p.body;}));
    return Promise.all(jobs).then(function(){return res;});
  });
}
function wizNext(){
  var wiz=S.wiz;if(!wiz)return;
  busy(1);var fin=function(){setTimeout(function(){busy(-1);},0);};
  wizValidate().then(function(res){
    if(!res||S.wiz!==wiz)return;
    var step=wiz.step;wiz.attempted[step]=true;
    var bad=Object.keys(wiz.errors).filter(function(k){return ctlStep(k)===step;});
    if(bad.length){bad.sort(function(a,b){return ctlRank(a)-ctlRank(b);});S.wizFocus=ctlId(bad[0]);wizRender();return;}
    wiz.step=step+1;wiz.furthest=Math.max(wiz.furthest,wiz.step);saveWiz();return wizEnter();
  }).then(fin,fin);
}
function wizBack(){if(S.wiz&&S.wiz.step>1){S.wiz.step--;saveWiz();wizEnter();}}
function wizUse(){
  var r=S.wiz.result;if(!r||!r.ok)return;var migrated=S.legacyWizPending&&S.analysisMapping?wJ(S.analysisMapping):null;
  S.staged={configuration:r.configuration,summary:r.summary,warnings:r.warnings,changes:S.wiz.changes};
  if(S.pendingNew){commitNew();clearNewWizardDraft();}
  wizardGeneration++;S.wiz=null;clearWiz();useStaged();if(migrated){S.analysisMapping=migrated;replan();}
}
function downloadConfig(cfg){
  var url=URL.createObjectURL(new Blob([JSON.stringify(cfg,null,2)],{type:"application/json"})),a=document.createElement("a");
  a.href=url;a.download="session_configuration.json";document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url);},1000);
}
/* ---- rendering ---- */
function ctlId(k){if(k==='profile.account_background')return 'profile-background';if(k==='profile.contact_flow')return 'profile-contact-flow';if(k.indexOf('profile.')===0&&PROFILE_LISTS&&PROFILE_LISTS.includes(k.slice(8)))return 'profile-'+k.slice(8);return "w-"+k.replace(/\./g,"-");}
function wErr(k){var e=S.wiz.errors[k];return (e&&S.wiz.attempted[ctlStep(k)])?'<div class="werr" id="'+ctlId(k)+'-e" role="alert">'+esc(e)+'</div>':'';}
function wBad(k){return (S.wiz.errors[k]&&S.wiz.attempted[ctlStep(k)])?' aria-invalid="true"':'';}
function wDesc(k,hint){return ' aria-describedby="'+(hint?ctlId(k)+'-h ':'')+ctlId(k)+'-e"';}
function wGet(k){var r=/^v(\d+)\.(\w+)$/.exec(k);var path=r?["versions",r[1],r[2]]:k.split(".");return path.reduce(function(a,x){return a==null?a:a[x];},S.wiz.m);}
function wSet(k,v){var r=/^v(\d+)\.(\w+)$/.exec(k);var path=r?["versions",r[1],r[2]]:k.split(".");var t=S.wiz.m;for(var i=0;i<path.length-1;i++)t=t[path[i]];t[path[path.length-1]]=v;}
function wText(k,type,label,hint,attrs){
  var mandatory=k==='acc.id'||/^profile\.(hours|shifts\.\d+)\.(start|end|name)$/.test(k);
  return '<div class="field"><label class="f" for="'+ctlId(k)+'">'+label+(mandatory?requiredLabel():'')+'</label>'+(hint?'<div class="hint" id="'+ctlId(k)+'-h">'+hint+'</div>':'')
    +'<input type="'+type+'" id="'+ctlId(k)+'" data-w="'+k+'" value="'+esc(wGet(k)||"")+'"'+wBad(k)+wDesc(k,hint)+(mandatory?' required aria-required="true"':'')+(attrs||'')+'>'+wErr(k)+'</div>';
}
function wList(k,list,label,hint,addLabel){
  var name=k.split(".")[1];
  return '<fieldset class="field"><legend>'+label+'</legend><div class="hint" id="'+ctlId(k)+'-h">'+hint+'</div>'
    +'<div class="chips">'+list.map(function(x){return '<span class="tag">'+esc(x)+' <button type="button" class="linkbtn" data-wdel="'+name+'|'+esc(x)+'" aria-label="Remove '+esc(x)+'">Remove</button></span>';}).join("")+'</div>'
    +'<div class="addrow"><input type="text" id="w-add-'+name+'" data-wadd-input="'+name+'" aria-label="'+addLabel+'"'+wBad(k)+wDesc(k,true)+'><button type="button" class="btn secondary" data-wadd="'+name+'">Add</button></div>'+wErr(k)+'</fieldset>';
}
var tzShown=[],tzActive=-1,tzCommitted="";
function tzZones(){var z=[];try{z=Intl.supportedValuesOf("timeZone").slice();}catch(e){}if(z.indexOf("UTC")<0)z.push("UTC");return z;}
function tzLabel(z){return z.replace(/_/g," ");}
function tzOptId(i){return "w-tz-opt-"+i;}
function tzMatches(q){
  var qq=(q||"").trim().toLowerCase(),all=tzZones();
  var rows=all.map(function(z,i){return {z:z,i:i,id:z.toLowerCase(),lbl:tzLabel(z).toLowerCase()};});
  if(!qq)return rows;
  var out=rows.filter(function(x){return x.id.indexOf(qq)>=0||x.lbl.indexOf(qq)>=0;});
  out.sort(function(a,b){var as=a.lbl.indexOf(qq)===0?0:1,bs=b.lbl.indexOf(qq)===0?0:1;return as-bs||(a.z<b.z?-1:a.z>b.z?1:0);});
  return out;
}
function tzPopHtml(rows,active){
  if(!rows.length)return '<li class="tz-none">No time zone matches "'+esc((document.getElementById("w-acc-tz")&&document.getElementById("w-acc-tz").value)||"")+'". Search by city or region, such as Manila or New York.</li>';
  return rows.map(function(x,j){return '<li id="'+tzOptId(x.i)+'" role="option" data-tz="'+esc(x.z)+'" aria-selected="'+(j===active?"true":"false")+'"'+(j===active?' class="sel"':'')+'><span class="tzh">'+esc(tzLabel(x.z))+'</span><span class="tzid">'+esc(x.z)+'</span></li>';}).join("");
}
function tzOptions(){return '<datalist id="w-tzlist">'+tzZones().map(function(x){return '<option value="'+esc(x)+'">';}).join("")+'</datalist>';}
function renderTzPop(rows,active){var pop=document.getElementById("w-tzpop");if(pop)pop.innerHTML=tzPopHtml(rows,active);}
function tzOpen(inp){
  var pop=document.getElementById("w-tzpop");if(pop)pop.hidden=false;
  if(inp)inp.setAttribute("aria-expanded","true");
  var btn=document.getElementById("w-tzopen");if(btn)btn.setAttribute("aria-expanded","true");
}
function tzClose(inp){
  var pop=document.getElementById("w-tzpop");if(pop)pop.hidden=true;
  tzActive=-1;
  if(inp){inp.setAttribute("aria-expanded","false");inp.removeAttribute("aria-activedescendant");}
  var btn=document.getElementById("w-tzopen");if(btn)btn.setAttribute("aria-expanded","false");
}
function tzFilter(inp){
  var rows=tzMatches(inp.value);tzShown=rows;tzActive=-1;renderTzPop(rows,-1);tzOpen(inp);
}
function tzClearErr(inp){
  delete S.wiz.errors["acc.tz"];
  var er=document.getElementById("w-acc-tz-e");if(er)er.remove();
  inp.removeAttribute("aria-invalid");
}
function tzPick(inp,z){
  inp.value=z;wSet("acc.tz",z);tzCommitted=z;tzClearErr(inp);tzClose(inp);saveWiz();
}
function tzRestore(inp){
  inp.value=tzCommitted;wSet("acc.tz",tzCommitted);tzClearErr(inp);tzClose(inp);saveWiz();
}
function tzMove(inp,dir){
  var rows=tzShown;if(!rows.length)return;
  tzActive=tzActive<0?(dir>0?0:rows.length-1):(tzActive+dir+rows.length)%rows.length;
  renderTzPop(rows,tzActive);
  inp.setAttribute("aria-activedescendant",tzOptId(rows[tzActive].i));
  var el=document.getElementById(tzOptId(rows[tzActive].i)),pop=document.getElementById("w-tzpop");
  if(el&&pop){var r=el.getBoundingClientRect(),q=pop.getBoundingClientRect();if(r.top<q.top)pop.scrollTop+=r.top-q.top;else if(r.bottom>q.bottom)pop.scrollTop+=r.bottom-q.bottom;}
}
function wTz(){
  var k="acc.tz",id=ctlId(k),v=wGet(k)||"";
  tzCommitted=v;tzShown=[];tzActive=-1;
  return '<div class="field"><label class="f" for="'+id+'">Operating hours time zone'+requiredLabel()+'</label>'
    +'<div class="hint" id="'+id+'-h">The shared time zone for this account and its operating schedule, for example Asia/Manila. An offset such as +08:00 is not enough.</div>'
    +'<div class="tzcomb" id="w-tzcomb"><div class="tzrow">'
    +'<input type="text" id="'+id+'" data-w="'+k+'" value="'+esc(v)+'" required aria-required="true" role="combobox" aria-autocomplete="list" aria-haspopup="listbox" aria-expanded="false" aria-controls="w-tzpop" autocomplete="off"'+wBad(k)+wDesc(k,true)+'>'
    +'<button type="button" class="btn secondary tzopen" id="w-tzopen" aria-label="Show all time zones" aria-expanded="false">Show all</button>'
    +'</div><ul id="w-tzpop" class="tzpop" role="listbox" aria-label="Time zones" hidden></ul></div>'+wErr(k)+'</div>';
}
function wStep1(){return '<h2>Account</h2>'+wText("acc.id","text","Account name","The account label for this analysis.",' autocomplete="off"');}
function wDirection(m){
  if(m.mixedDir)return '<div class="notice info"><b>The versions below use different directions.</b>Each version has its own direction.</div>';
  return '<fieldset class="field"><legend>Direction for average handle time</legend><div class="hint" id="w-direction-h">Which way is better decides how a result is described.</div>'
    +WDIRS.map(function(d){return '<label class="opt"><input type="radio" name="w-direction" data-w="direction" value="'+d[0]+'"'+(m.direction===d[0]?' checked':'')+(S.wiz.errors.direction&&S.wiz.attempted[2]?' aria-invalid="true"':'')+' aria-describedby="w-direction-h w-direction-e"><span>'+d[1]+'</span></label>';}).join("")
    +wErr("direction")+'</fieldset>';
}
function wVersion(m,v,i){
  var dir=m.mixedDir?v.dir:m.direction,rule=ruleFor(dir),k="v"+i+".";
  var h='<fieldset class="vers"><legend>Performance rule period '+(i+1)+'</legend>';
  if(m.mixedDir)h+='<fieldset class="field"><legend>Direction</legend>'+WDIRS.map(function(d){return '<label class="opt"><input type="radio" name="w-v'+i+'-dir" data-w="'+k+'dir" value="'+d[0]+'"'+(v.dir===d[0]?' checked':'')+'><span>'+d[1]+'</span></label>';}).join("")+wErr(k+"dir")+'</fieldset>';
  h+='<div class="cols2">'+wText(k+"start","date","Applies from","",'')+wText(k+"last","date","Applies until (last day)","Leave empty if this version is still current. The next version can start on the following day.",'')+'</div>';
  if(rule)h+=wText(k+"target","number","Target (seconds)","Optional. "+(rule==="at_or_below"?"Met when the average is at or below the target.":"Met when the average is at or above the target.")+" Leave empty for no target.",' step="any" inputmode="decimal"');
  else if(dir)h+='<p class="muted">'+(dir==="monitor_only"?"Monitor only: Athena shows the figure and reports any limits, but makes no target verdict.":"Within bounds: a figure is within bounds when it lies between the lower and upper limits.")+'</p>';
  h+='<div class="cols2">'+wText(k+"lower","number","Lower specification limit (seconds)","Optional. The lowest acceptable value.",' step="any" inputmode="decimal"')+wText(k+"upper","number","Upper specification limit (seconds)","Optional. The highest acceptable value.",' step="any" inputmode="decimal"')+'</div>';
  h+='<div class="notice info"><b>Smallest difference that matters</b>'
    +(v.material!==""?'<p>A recorded value of '+esc(v.material)+' seconds is retained with this configuration, but it is not used to change MVP analysis results.</p>':'<p>Not available for this MVP. Athena does not use this field to change analysis results.</p>')
    +'</div>';
  var kinds=[["account","The whole account"],["lines_of_business","Specific Lines of Business"],["types","Specific contact types"]],pool=v.scopeKind==="lines_of_business"?m.acc.lines_of_business:m.acc.types;
  h+='<fieldset class="field"><legend>Applies to</legend><div class="hint" id="w-'+k.replace(".","-")+'scope-h">A target applies to a Line of Business or contact type only when you name it here.</div>'
    +kinds.map(function(x){return '<label class="opt"><input type="radio" name="w-v'+i+'-scope" data-w="'+k+'scopeKind" value="'+x[0]+'"'+(v.scopeKind===x[0]?' checked':'')+'><span>'+x[1]+'</span></label>';}).join("");
  if(v.scopeKind==="lines_of_business"||v.scopeKind==="types")h+=pool.length?'<div class="chips">'+pool.map(function(x){return '<label class="opt"><input type="checkbox" data-wval="v'+i+'|'+esc(x)+'"'+(v.scopeVals.indexOf(x)>=0?' checked':'')+'><span>'+esc(x)+'</span></label>';}).join("")+'</div>':'<p class="muted">Add '+(v.scopeKind==="lines_of_business"?"Lines of Business":"contact types")+' in step 1 first.</p>';
  h+=wErr(k+"scope")+'</fieldset>';
  h+='<div class="setby"><strong>Period label (set by Athena)</strong> <span class="muted">'+esc(verLabel(v))+'</span></div>';
  h+='<div class="actions"><button type="button" class="btn secondary" data-wvdel="'+i+'">Remove this performance rule period</button></div></fieldset>';
  return h;
}
function wStep2(){return '<h2>Coverage dates (optional)</h2><p class="muted">Dates outside this account coverage are excluded. Leave empty to include the available dates.</p>'+wText("acc.covFrom","date","Covered from","",'')+wText("acc.covLast","date","Covered until (last included day)","",'');}
var DATE_FORMATS=[["month_first","Month first","3/4/2026 is March 4"],["day_first","Day first","3/4/2026 is April 3"]];
function dateFormatText(f){var d=DATE_FORMATS.filter(function(x){return x[0]===f;})[0]||DATE_FORMATS[0];return d[1]+' ('+d[2]+')';}
function wDateFormat(){var cur=wGet("acc.fmt")||"month_first";
  return '<fieldset class="field"><legend>Date format in your files</legend><div class="hint" id="w-fmt-h">How dates written with slashes are read. Dates written as 2026-03-04 never change. A time with no offset is read in the time zone above.</div>'
    +'<div class="w-date-format-options">'+DATE_FORMATS.map(function(d){return '<label class="opt"><input type="radio" name="w-fmt" data-w="acc.fmt" value="'+d[0]+'"'+(cur===d[0]?' checked':'')+' aria-describedby="w-fmt-h"><span>'+d[1]+' <span class="muted">('+d[2]+')</span></span></label>';}).join("")
    +'</div>'+wErr("acc.fmt")+'</fieldset>';}
function wStep3(){return '<h2>Business time zone</h2>'+wTz()+tzOptions();}
function wReviewList(m){return '<dl><dt>Account name</dt><dd>'+esc(m.acc.id)+'</dd><dt>Operating hours time zone</dt><dd>'+esc(m.acc.tz)+'</dd><dt>Date format</dt><dd>'+esc(dateFormatText(m.acc.fmt))+'</dd><dt>Coverage</dt><dd>'+esc((m.acc.covFrom||'First available date')+' to '+(m.acc.covLast||'latest available date'))+'</dd></dl>';}
function wCompat(){
  var u=S.upload&&S.upload.ok,c=S.wiz.compat,r=S.wiz.result;
  if(!r||!r.ok)return '<p class="muted">Checked once the configuration is valid.</p>';
  if(!u||!c)return '<p class="muted">Not checked yet. When you upload a data file, Athena checks it against this configuration.</p>';
  var lines=[];
  if(c.configuration_status&&!c.configuration_status.applied)lines.push(c.configuration_status.text);
  else{lines.push("The account matches your data file.");
    var sr=c.scope_restrictions;if(sr&&sr.lines_of_business_not_covered&&sr.lines_of_business_not_covered.length)lines.push("Lines of Business in your file that this configuration does not cover: "+sr.lines_of_business_not_covered.join(", ")+".");
    if(sr&&sr.contact_types_not_covered&&sr.contact_types_not_covered.length)lines.push("Contact types in your file that this configuration does not cover: "+sr.contact_types_not_covered.join(", ")+".");
    if(c.date_coverage&&c.date_coverage.outside)lines.push("Dates in your file fall outside the coverage window.");
    if(lines.length===1)lines.push("Every Line of Business and contact type in your file is covered.");}
  return '<ul class="plain">'+lines.map(function(x){return '<li>'+esc(x)+'</li>';}).join("")+'</ul>';
}
function wStep4(){return '<h2>Review</h2>'+wReviewList(S.wiz.m)+'<p class="muted">Save and close makes this setup current and brings you to your data.</p>';}
var PROFILE_LISTS=['lines_of_business','contact_channels','regions_supported','service_languages','delivery_sites'];
var COUNTRY_ROWS=[["AD","Andorra"],["AE","United Arab Emirates"],["AF","Afghanistan"],["AG","Antigua & Barbuda"],["AI","Anguilla"],["AL","Albania"],["AM","Armenia"],["AO","Angola"],["AQ","Antarctica"],["AR","Argentina"],["AS","Samoa (American)"],["AT","Austria"],["AU","Australia"],["AW","Aruba"],["AX","Åland Islands"],["AZ","Azerbaijan"],["BA","Bosnia & Herzegovina"],["BB","Barbados"],["BD","Bangladesh"],["BE","Belgium"],["BF","Burkina Faso"],["BG","Bulgaria"],["BH","Bahrain"],["BI","Burundi"],["BJ","Benin"],["BL","St Barthelemy"],["BM","Bermuda"],["BN","Brunei"],["BO","Bolivia"],["BQ","Caribbean NL"],["BR","Brazil"],["BS","Bahamas"],["BT","Bhutan"],["BV","Bouvet Island"],["BW","Botswana"],["BY","Belarus"],["BZ","Belize"],["CA","Canada"],["CC","Cocos (Keeling) Islands"],["CD","Congo (Dem. Rep.)"],["CF","Central African Rep."],["CG","Congo (Rep.)"],["CH","Switzerland"],["CI","Côte d’Ivoire"],["CK","Cook Islands"],["CL","Chile"],["CM","Cameroon"],["CN","China"],["CO","Colombia"],["CR","Costa Rica"],["CU","Cuba"],["CV","Cape Verde"],["CW","Curaçao"],["CX","Christmas Island"],["CY","Cyprus"],["CZ","Czech Republic"],["DE","Germany"],["DJ","Djibouti"],["DK","Denmark"],["DM","Dominica"],["DO","Dominican Republic"],["DZ","Algeria"],["EC","Ecuador"],["EE","Estonia"],["EG","Egypt"],["EH","Western Sahara"],["ER","Eritrea"],["ES","Spain"],["ET","Ethiopia"],["FI","Finland"],["FJ","Fiji"],["FK","Falkland Islands"],["FM","Micronesia"],["FO","Faroe Islands"],["FR","France"],["GA","Gabon"],["GB","Britain (UK)"],["GD","Grenada"],["GE","Georgia"],["GF","French Guiana"],["GG","Guernsey"],["GH","Ghana"],["GI","Gibraltar"],["GL","Greenland"],["GM","Gambia"],["GN","Guinea"],["GP","Guadeloupe"],["GQ","Equatorial Guinea"],["GR","Greece"],["GS","South Georgia & the South Sandwich Islands"],["GT","Guatemala"],["GU","Guam"],["GW","Guinea-Bissau"],["GY","Guyana"],["HK","Hong Kong"],["HM","Heard Island & McDonald Islands"],["HN","Honduras"],["HR","Croatia"],["HT","Haiti"],["HU","Hungary"],["ID","Indonesia"],["IE","Ireland"],["IL","Israel"],["IM","Isle of Man"],["IN","India"],["IO","British Indian Ocean Territory"],["IQ","Iraq"],["IR","Iran"],["IS","Iceland"],["IT","Italy"],["JE","Jersey"],["JM","Jamaica"],["JO","Jordan"],["JP","Japan"],["KE","Kenya"],["KG","Kyrgyzstan"],["KH","Cambodia"],["KI","Kiribati"],["KM","Comoros"],["KN","St Kitts & Nevis"],["KP","Korea (North)"],["KR","Korea (South)"],["KW","Kuwait"],["KY","Cayman Islands"],["KZ","Kazakhstan"],["LA","Laos"],["LB","Lebanon"],["LC","St Lucia"],["LI","Liechtenstein"],["LK","Sri Lanka"],["LR","Liberia"],["LS","Lesotho"],["LT","Lithuania"],["LU","Luxembourg"],["LV","Latvia"],["LY","Libya"],["MA","Morocco"],["MC","Monaco"],["MD","Moldova"],["ME","Montenegro"],["MF","St Martin (French)"],["MG","Madagascar"],["MH","Marshall Islands"],["MK","North Macedonia"],["ML","Mali"],["MM","Myanmar (Burma)"],["MN","Mongolia"],["MO","Macau"],["MP","Northern Mariana Islands"],["MQ","Martinique"],["MR","Mauritania"],["MS","Montserrat"],["MT","Malta"],["MU","Mauritius"],["MV","Maldives"],["MW","Malawi"],["MX","Mexico"],["MY","Malaysia"],["MZ","Mozambique"],["NA","Namibia"],["NC","New Caledonia"],["NE","Niger"],["NF","Norfolk Island"],["NG","Nigeria"],["NI","Nicaragua"],["NL","Netherlands"],["NO","Norway"],["NP","Nepal"],["NR","Nauru"],["NU","Niue"],["NZ","New Zealand"],["OM","Oman"],["PA","Panama"],["PE","Peru"],["PF","French Polynesia"],["PG","Papua New Guinea"],["PH","Philippines"],["PK","Pakistan"],["PL","Poland"],["PM","St Pierre & Miquelon"],["PN","Pitcairn"],["PR","Puerto Rico"],["PS","Palestine"],["PT","Portugal"],["PW","Palau"],["PY","Paraguay"],["QA","Qatar"],["RE","Réunion"],["RO","Romania"],["RS","Serbia"],["RU","Russia"],["RW","Rwanda"],["SA","Saudi Arabia"],["SB","Solomon Islands"],["SC","Seychelles"],["SD","Sudan"],["SE","Sweden"],["SG","Singapore"],["SH","St Helena"],["SI","Slovenia"],["SJ","Svalbard & Jan Mayen"],["SK","Slovakia"],["SL","Sierra Leone"],["SM","San Marino"],["SN","Senegal"],["SO","Somalia"],["SR","Suriname"],["SS","South Sudan"],["ST","Sao Tome & Principe"],["SV","El Salvador"],["SX","St Maarten (Dutch)"],["SY","Syria"],["SZ","Eswatini (Swaziland)"],["TC","Turks & Caicos Is"],["TD","Chad"],["TF","French S. Terr."],["TG","Togo"],["TH","Thailand"],["TJ","Tajikistan"],["TK","Tokelau"],["TL","East Timor"],["TM","Turkmenistan"],["TN","Tunisia"],["TO","Tonga"],["TR","Turkey"],["TT","Trinidad & Tobago"],["TV","Tuvalu"],["TW","Taiwan"],["TZ","Tanzania"],["UA","Ukraine"],["UG","Uganda"],["UM","US minor outlying islands"],["US","United States"],["UY","Uruguay"],["UZ","Uzbekistan"],["VA","Vatican City"],["VC","St Vincent"],["VE","Venezuela"],["VG","Virgin Islands (UK)"],["VI","Virgin Islands (US)"],["VN","Vietnam"],["VU","Vanuatu"],["WF","Wallis & Futuna"],["WS","Samoa (western)"],["YE","Yemen"],["YT","Mayotte"],["ZA","South Africa"],["ZM","Zambia"],["ZW","Zimbabwe"]],countryNamesCache=null;
var CHIP_PH={lines_of_business:'e.g. Billing support',contact_channels:'e.g. Voice, Chat',regions_supported:'Search or type a country or region',service_languages:'e.g. English',delivery_sites:'e.g. Manila'};
var STAGES=['Transition','Ramp-up','Steady-state','Wind-down'],stageOther=false;
function countryNames(){if(countryNamesCache)return countryNamesCache;var dn=null,seen={},out=[];try{dn=new Intl.DisplayNames(['en'],{type:'region'});}catch(x){}
 COUNTRY_ROWS.forEach(function(r){var n=r[1],x=null;try{x=dn&&dn.of(r[0]);}catch(e){}if(x&&x!==r[0])n=x;if(!seen[n]){seen[n]=1;out.push(n);}});out.sort(function(a,b){return a.localeCompare(b);});return countryNamesCache=out;}
function canonRegion(v){var l=v.toLowerCase();return countryNames().find(function(n){return n.toLowerCase()===l;})||v;}
function stageHtml(){var v=S.wiz.m.profile.current_phase||'',other=stageOther||(v&&!STAGES.includes(v));return '<div class="field"><label class="f" for="profile-stage">Account operating stage</label><select id="profile-stage" data-profile-stage>'+[['','Not specified']].concat(STAGES.map(function(x){return [x,x];}),[['__other','Other…']]).map(function(o){return '<option value="'+esc(o[0])+'"'+((other?'__other':v)===o[0]?' selected':'')+'>'+esc(o[1])+'</option>';}).join('')+'</select></div>'+(other?wText('profile.current_phase','text','Other stage','', ' maxlength="128" placeholder="e.g. Pilot"'):'');}
function validChipPending(v){return keysOnly(v,PROFILE_LISTS)&&Object.keys(v).every(k=>typeof v[k]==='string'&&v[k].length<=8192&&!/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(v[k]));}
function chipPending(k){return (S.wiz.m.chip_pending||{})[k]||'';}
function chipError(k,message){S.wiz.chipErrors=S.wiz.chipErrors||{};if(message)S.wiz.chipErrors[k]=message;else delete S.wiz.chipErrors[k];}
function chipPlan(k){var pending=chipPending(k),values=(S.wiz.m.profile[k]||[]).slice(),parts=pending.split(/[,\r\n]+/).map(v=>v.trim()).filter(Boolean);
 if(parts.some(v=>v.length>128||/[\x00-\x1f\x7f]/.test(v)))return {error:'Use items up to 128 characters without control characters.'};
 parts.forEach(v=>{var reg=k==='regions_supported';if(reg)v=canonRegion(v);if(!values.some(x=>reg?x.toLowerCase()===v.toLowerCase():x===v))values.push(v);});return values.length>50?{error:'Use no more than 50 items.'}:{values:values};}
function commitProfileChip(k){var next=chipPlan(k);chipError(k,next.error);if(!next.error){if(next.values.length)S.wiz.m.profile[k]=next.values;else delete S.wiz.m.profile[k];if(S.wiz.m.chip_pending)delete S.wiz.m.chip_pending[k];}S.wizFocus='profile-'+k;wizRender();return !next.error;}
function flushProfileChips(){if(!S.wiz)return true;var plans=PROFILE_LISTS.map(k=>[k,chipPlan(k)]),bad=plans.filter(v=>v[1].error);if(bad.length){bad.forEach(v=>chipError(v[0],v[1].error));S.wizFocus='profile-'+bad[0][0];saveWiz();render();return false;}plans.forEach(v=>{if(v[1].values.length)S.wiz.m.profile[v[0]]=v[1].values;else delete S.wiz.m.profile[v[0]];chipError(v[0]);});delete S.wiz.m.chip_pending;saveWiz();return true;}
function profileIdentityHtml(){return '<div class="profile-project">'+wText('profile.project_name','text','Project or analysis title','', ' maxlength="128" placeholder="e.g. Q3 handle-time review"')+'</div>';}
function profileList(k,label){var ph=CHIP_PH[k]||'',values=S.wiz.m.profile[k]||[],error=(S.wiz.chipErrors||{})[k]||S.wiz.errors['profile.'+k];return '<div class="field profile-chip-field"><label class="f" for="profile-'+k+'">'+label+'</label><div class="profile-chip-box">'+values.map((v,i)=>'<span class="profile-chip"><span>'+esc(v)+'</span><button type="button" data-chip-remove="'+k+'" data-chip-index="'+i+'" aria-label="Remove '+esc(v)+' from '+label+'">×</button></span>').join('')+'<input type="text" id="profile-'+k+'" data-profile-chip="'+k+'" value="'+esc(chipPending(k))+'" maxlength="8192"'+(ph?' placeholder="'+esc(ph)+'"':'')+(k==='regions_supported'?' list="profile-region-options"':'')+' aria-describedby="profile-'+k+'-hint'+(error?' profile-'+k+'-error':'')+'"'+(error?' aria-invalid="true"':'')+'><button type="button" class="chip-add" data-chip-add="'+k+'" aria-label="Add '+label+'">Add</button></div><p class="hint" id="profile-'+k+'-hint">'+(k==='regions_supported'?'Pick a country or type your own region · ':'')+'Enter or comma to add · Up to 50 items</p>'+(error?'<p role="alert" id="profile-'+k+'-error">'+esc(error)+'</p>':'')+(k==='regions_supported'?'<datalist id="profile-region-options">'+countryNames().map(function(n){return '<option value="'+esc(n)+'"></option>';}).join('')+'</datalist>':'')+'</div>';}
function formSection(id,title,badge,body){return '<section class="profile-section" aria-labelledby="'+id+'"><div class="profile-section-heading"><h2 id="'+id+'" tabindex="-1">'+title+'</h2><span class="profile-badge">'+badge+'</span></div>'+body+'</section>';}
function operatingInterval(path,shift){var value=wGet(path),labels=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];return (shift?wText(path+'.name','text','Shift name','', ' maxlength="128"'):'')+'<fieldset class="field"><legend>Operating days'+requiredLabel()+'</legend>'+labels.map(function(label,i){return '<label class="inline"><input type="checkbox" data-profile-day="'+path+'" value="'+i+'"'+(value.days.includes(i)?' checked':'')+'>'+label+'</label>';}).join('')+'</fieldset><div class="cols2">'+wText(path+'.start','time','Starts','', '')+wText(path+'.end','time','Ends','', '')+'</div><label class="opt"><input type="checkbox" data-profile-overnight="'+path+'"'+(value.ends_next_day?' checked':'')+'>Ends on the following day</label>';}
function profileHtml(){var p=S.wiz.m.profile,h='<div class="profile-grid2">'+wText('profile.industry','text','Industry','', ' maxlength="128" placeholder="e.g. Retail"')+profileList('contact_channels','Contact channels')+profileList('lines_of_business','Lines of business')+profileList('regions_supported','Countries and regions supported')+'</div><div class="profile-schedule"><h3>Operating hours and shifts</h3><p class="hint">Descriptive schedule only. It does not exclude observations or change analysis dates.</p><div class="profile-schedule-heading"><div class="field"><label class="f" for="profile-hours-mode">Operating hours</label><select id="profile-hours-mode" data-profile-hours>'+[['','Not specified'],['24_7','24/7'],['weekly','Weekly hours']].map(function(v){return '<option value="'+v[0]+'"'+((p.hours||{}).mode===v[0]?' selected':'')+'>'+v[1]+'</option>';}).join('')+'</select></div><button type="button" class="btn secondary" id="profile-add-shift">Add shift</button></div>';
 if(p.hours&&p.hours.mode==='weekly')h+=operatingInterval('profile.hours',false);
 h+='<div id="w-profile-shift-error" tabindex="-1">'+(S.wiz.errors['profile.shift-error']?'<p role="alert">'+esc(S.wiz.errors['profile.shift-error'])+'</p>':'')+(p.shifts||[]).map(function(v,i){return '<fieldset class="vers"><legend>Shift '+(i+1)+'</legend>'+operatingInterval('profile.shifts.'+i,true)+'<button type="button" class="btn secondary" data-shift-remove="'+i+'">Remove shift</button></fieldset>';}).join('')+'</div></div>';
 return formSection('profile-business','2. Operating business & schedule','Optional · Business context',h);}
function profileDeliveryHtml(){var p=S.wiz.m.profile;return formSection('profile-delivery','3. Delivery & support','Optional · Business context','<div class="profile-grid2">'+profileList('service_languages','Service languages')+profileList('delivery_sites','Delivery sites')+'</div><div class="profile-grid2">'+stageHtml()+'<div class="field"><label class="f" for="profile-contact-flow">Contact flow</label><select id="profile-contact-flow" data-w="profile.contact_flow">'+[['','Not specified'],['inbound','Inbound'],['outbound','Outbound'],['blended','Blended']].map(function(v){return '<option value="'+v[0]+'"'+(p.contact_flow===v[0]?' selected':'')+'>'+v[1]+'</option>';}).join('')+'</select></div>'+wText('profile.service_scope','text','Service and support scope','The services this team handles for the client.', ' maxlength="2000" placeholder="e.g. Order changes, billing questions, returns"')+wText('profile.support_notes','text','Support tiers and handoffs','The team levels and how contacts escalate between them.', ' maxlength="2000" placeholder="e.g. Tier 1 to Tier 2 for refunds over a set amount"')+'</div><div class="field"><label class="f" for="profile-background">Account background / project purpose</label><textarea id="profile-background" data-w="profile.account_background" maxlength="8000" rows="4" placeholder="e.g. Why this analysis is being done and what the account does">'+esc(p.account_background||'')+'</textarea></div>');}
document.addEventListener('input',function(e){var t=e.target;if(S.wiz&&t.dataset.profileChip){var k=t.dataset.profileChip;S.wiz.m.chip_pending=S.wiz.m.chip_pending||{};S.wiz.m.chip_pending[k]=t.value;saveWiz();if(k==='regions_supported'&&e.inputType==='insertReplacementText'&&countryNames().includes(t.value))commitProfileChip(k);}});
document.addEventListener('change',function(e){var t=e.target;if(!S.wiz||t.dataset.profileStage===undefined)return;var p=S.wiz.m.profile;if(t.value==='__other'){if(STAGES.includes(p.current_phase))delete p.current_phase;stageOther=true;}else{stageOther=false;if(t.value)p.current_phase=t.value;else delete p.current_phase;}S.wizFocus='profile-stage';wizRender();});
document.addEventListener('keydown',function(e){var t=e.target;if(!S.wiz||!t.dataset.profileChip||e.isComposing)return;var k=t.dataset.profileChip;if(e.key==='Enter'||e.key===','){e.preventDefault();commitProfileChip(k);}else if(e.key==='Backspace'&&!t.value){var buttons=t.parentElement.querySelectorAll('[data-chip-remove]');if(buttons.length){e.preventDefault();buttons[buttons.length-1].focus();}}});
document.addEventListener('paste',function(e){var t=e.target;if(!S.wiz||!t.dataset.profileChip)return;var text=e.clipboardData.getData('text');if(!/[,\r\n]/.test(text))return;e.preventDefault();var k=t.dataset.profileChip,next=t.value.slice(0,t.selectionStart)+text+t.value.slice(t.selectionEnd);if(next.length>8192){chipError(k,'Add at most 8192 characters at a time.');S.wizFocus='profile-'+k;wizRender();return;}S.wiz.m.chip_pending=S.wiz.m.chip_pending||{};S.wiz.m.chip_pending[k]=next;saveWiz();commitProfileChip(k);});
document.addEventListener('click',function(e){var t=e.target.closest('button');if(!t||!S.wiz)return;if(t.dataset.chipAdd)commitProfileChip(t.dataset.chipAdd);if(t.dataset.chipRemove){var k=t.dataset.chipRemove;S.wiz.m.profile[k].splice(Number(t.dataset.chipIndex),1);S.wizFocus='profile-'+k;wizRender();}if(t.dataset.profileJump){var el=document.getElementById(t.dataset.profileJump),pane=el.closest('.g-modal-scroll-pane');var scale=pane.getBoundingClientRect().height/pane.offsetHeight||1;pane.scrollTo({top:pane.scrollTop+(el.getBoundingClientRect().top-pane.getBoundingClientRect().top)/scale-8,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});el.focus({preventScroll:true});}});
document.addEventListener('change',function(e){if(!S.wiz)return;var t=e.target;if(t.dataset.profileHours!==undefined){if(t.value)S.wiz.m.profile.hours=t.value==='24_7'?{mode:'24_7'}:{mode:'weekly',days:[],start:'',end:'',ends_next_day:false};else delete S.wiz.m.profile.hours;wizRender();}if(t.dataset.profileDay){var value=wGet(t.dataset.profileDay);value.days=Array.from(t.closest('fieldset').querySelectorAll('input:checked')).map(v=>Number(v.value));saveWiz();}if(t.dataset.profileOvernight){wGet(t.dataset.profileOvernight).ends_next_day=t.checked;saveWiz();}if(t.dataset.w==='profile.contact_flow'){wSet(t.dataset.w,t.value);saveWiz();}});
document.addEventListener('click',function(e){if(!S.wiz)return;var t=e.target.closest('button');if(!t)return;if(t.id==='profile-add-shift'){var p=S.wiz.m.profile;p.shifts=p.shifts||[];if(p.shifts.length<50)p.shifts.push({name:'',days:[],start:'',end:'',ends_next_day:false});wizRender();}if(t.dataset.shiftRemove!==undefined){S.wiz.m.profile.shifts.splice(Number(t.dataset.shiftRemove),1);wizRender();}});
function wizardHtml(){
  if(S.shell==='sidebar'){var p=S.wiz.m.profile,notice=p.account_name&&p.account_name!==S.wiz.m.acc.id?'<p class="hint">An earlier display name ('+esc(p.account_name)+') is retained in the imported configuration.</p>':'';return '<div class="wiz single-form">'+formSection('profile-account','1. Account & coverage','Core setup','<p class="muted">Fields marked Required must be completed.</p><div class="profile-grid2">'+wText('acc.id','text','Account name','', ' maxlength="128" placeholder="e.g. Contoso Retail"')+wTz()+profileIdentityHtml()+'</div>'+notice+tzOptions()+wDateFormat()+'<div class="profile-grid2">'+wText('acc.covFrom','date','Covered from','', '')+wText('acc.covLast','date','Covered until (last included day)','', '')+'</div><p class="muted">Account coverage is separate from analysis scope. Leave these dates empty when not specified.</p>')+profileHtml()+profileDeliveryHtml()+(S.wiz.errors.general?'<p role="alert">'+esc(S.wiz.errors.general)+'</p>':'')+'</div>';}

  var w=S.wiz,h='<div class="wiz"><nav aria-label="Configuration steps"><ol class="stepper">'+WSTEPS.map(function(t,i){var n=i+1;
    return '<li><button type="button" data-wstep="'+n+'"'+(w.step===n?' aria-current="step"':'')+(n>w.furthest?' disabled':'')+'>'+n+'. '+esc(t)+'</button></li>';}).join("")+'</ol></nav>';
  if(w.errors.general&&w.attempted[w.step])h+='<div class="notice" role="alert">'+esc(w.errors.general)+'</div>';
  h+=[wStep1,wStep2,wStep3,wStep4][w.step-1]();
  h+='<div class="actions wiz-nav">'+(w.step>1?'<button type="button" class="btn secondary" id="w-back">Back</button>':'')+(w.step<4?'<button type="button" class="btn" id="w-next">'+(w.step===3?'Review':'Next')+'</button>':'')
    +'<button type="button" class="btn secondary" id="w-close">Save and close</button></div></div>';
  return h;
}
function settingsCurrentSetup(summary,action,draftNote){
  var profile=summary.operating_profile||{},coverage=summary.coverage||{};
  var start=coverage.start,end=coverage.end?dayBefore(coverage.end):null;
  var coverageText=start&&end?'From '+start+' Until '+end:start?'From '+start:end?'Until '+end:'';
  var core=setupFactCells([
    ['Account name',summary.account_id],['Project or analysis title',profile.project_name],
    ['Operating hours time zone',summary.business_timezone],['Date format',dateFormatText(summary.date_format)]
  ]);
  var detail=setupFactCells([...profileDetailRows(profile),['Account coverage',coverageText],['Delivery sites',(profile.delivery_sites||[]).join(', ')]]);
  return '<section class="panel g-current-setup" aria-labelledby="g-current-setup-title"><div class="workspace-setup-heading"><h2 id="g-current-setup-title">Current setup</h2>'+action+'</div>'
    +'<div class="workspace-setup-core">'+core+'</div>'+draftNote
    +(detail?'<details class="g-current-profile"><summary>Business profile</summary><div class="workspace-setup-core">'+detail+'</div></details>':'')+'</section>';
}
function configLandingHtml(inSettings=false){
  var action=S.wizDraft?'<button class="btn" id="w-resume">Continue configuration</button>':S.newWizDraft?'<button class="btn" id="w-resume-new">Continue configuration</button>':S.config?'<button class="btn" id="w-edit">Edit configuration</button>':'<button class="btn" id="w-create">Create a configuration</button>';
  var secondary=(S.config||S.wizDraft||S.newWizDraft)?'<button class="btn secondary" id="w-create">'+(S.newWizDraft?'Continue new configuration':'Create a configuration')+'</button>':'';
  if(S.config&&(S.wizDraft||S.newWizDraft))secondary+='<button class="btn secondary" id="w-edit">Edit configuration</button>';
  var draftNote=S.wizDraft||S.newWizDraft?'<p class="muted g-current-setup-note">A configuration draft is available for this session.</p>':'';
  var h=inSettings&&S.config&&S.configSummary?settingsCurrentSetup(S.configSummary,action,draftNote):
    '<section class="panel"><div class="workspace-setup-heading"><h2>'+(S.config?'Current setup':S.wizDraft||S.newWizDraft?'Configuration draft':'Set up your account')+'</h2>'+action+'</div>'
    +(S.config&&S.configSummary?cfgSummaryDl(S.configSummary):'<p class="muted">Add your account and operating time zone to begin.</p>')
    +draftNote+'</section>';
  if(S.cfgNotice)h+='<p class="notice info">'+esc(S.cfgNotice)+'</p>';
  if(S.cfgIssues&&S.cfgIssues.length)h+=cfgIssuesHtml(S.cfgIssues);
  return h+stagedConfigHtml()+'<div class="actions">'+secondary+'<label class="btn secondary" for="acctfile">Import a configuration</label><input class="sr" id="acctfile" type="file" accept=".json,application/json">'
    +(S.config?'<button class="btn secondary" id="w-dl-active">Download configuration</button>':'<a class="btn secondary" href="/api/account-template" download>Download configuration template</a>')+'</div>';
}
function wizAddItem(name){
  var el=document.getElementById("w-add-"+name),v=((el&&el.value)||"").trim();if(!v)return;
  var arr=S.wiz.m.acc[name];if(arr.indexOf(v)<0)arr.push(v);delete S.wiz.errors["acc."+name];S.wizFocus="w-add-"+name;wizRender();
}
function wizDelItem(name,val){
  var m=S.wiz.m;m.acc[name]=m.acc[name].filter(function(x){return x!==val;});
  var kind=name==="lines_of_business"?"lines_of_business":"types";m.versions.forEach(function(v){if(v.scopeKind===kind)v.scopeVals=v.scopeVals.filter(function(x){return x!==val;});});
  S.wizFocus="w-add-"+name;wizRender();
}
document.addEventListener("input",function(e){
  var t=e.target;if(!S.wiz||!t.dataset||t.dataset.w===undefined||t.type==="radio")return;
  wSet(t.dataset.w,t.value);delete S.wiz.errors[t.dataset.w];
  var er=document.getElementById(ctlId(t.dataset.w)+"-e");if(er)er.remove();t.removeAttribute("aria-invalid");saveWiz();
});
document.addEventListener("change",function(e){
  var t=e.target;
  if(!S.wiz||!t.dataset)return;
  if(t.dataset.w!==undefined&&t.type==="radio"){
    var k=t.dataset.w;wSet(k,t.value);
    if(/scopeKind$/.test(k)){var i=/^v(\d+)/.exec(k)[1];S.wiz.m.versions[i].scopeVals=[];delete S.wiz.errors["v"+i+".scope"];}
    delete S.wiz.errors[k];S.wizFocus=t.id||null;wizRender();return;}
  if(t.dataset.wval!==undefined){
    var p=t.dataset.wval.split("|"),v=S.wiz.m.versions[+p[0].slice(1)],val=p.slice(1).join("|"),ix=v.scopeVals.indexOf(val);
    if(t.checked&&ix<0)v.scopeVals.push(val);if(!t.checked&&ix>=0)v.scopeVals.splice(ix,1);delete S.wiz.errors[p[0]+".scope"];saveWiz();}
});
document.addEventListener("keydown",function(e){
  var t=e.target;if(S.wiz&&t.dataset&&t.dataset.waddInput&&e.key==="Enter"){e.preventDefault();wizAddItem(t.dataset.waddInput);}
});
document.addEventListener('click',function(e){if(e.target.id==='reset-recovery'){if(S.draftRecovery){clearDraft();S.draftNote=null;}if(S.wizRecovery){clearWiz();S.cfgNotice=null;}render();}});
document.addEventListener("click",function(e){
  var t=e.target.closest("button");if(!t)return;
  if(t.id==="w-create"||t.id==="w-resume-new"){if(S.shell==="sidebar")gStartAnalysis(t);else openWizard(blankModel(),1);return;}
  if(t.id==="w-edit"&&S.config){if(S.wizDraft)resumeWizard();else openWizard(modelFromConfig(S.config),1);return;}
  if(t.id==="w-edit-staged"&&S.staged){var c=S.staged.configuration;clearStagedConfig();if(S.modal)S.modal.tab="wizard";openWizard(modelFromConfig(c),1);return;}
  if(t.id==="w-resume"&&S.wizDraft){resumeWizard();return;}
  if(t.id==="w-discard"){clearWiz();render();return;}
  if(t.id==="w-dl-active"&&S.config){downloadConfig(S.config);return;}
  if(!S.wiz)return;
  if(t.id==="w-next"){wizNext();return;}
  if(t.id==="w-back"){wizBack();return;}
  if(t.id==="w-close"){closeWizard();return;}
  if(t.id==="w-use"){wizUse();return;}
  if(t.id==="w-dl"&&S.wiz.result&&S.wiz.result.ok){downloadConfig(S.wiz.result.configuration);return;}
  if(t.id==="w-vadd"){S.wiz.m.versions.push(blankVersion());S.wizFocus="w-v"+(S.wiz.m.versions.length-1)+"-start";wizRender();return;}
  if(t.id==="w-now"){var n=new Date();S.wiz.m.conf.authorizedAt=n.getFullYear()+"-"+p2(n.getMonth()+1)+"-"+p2(n.getDate())+"T"+p2(n.getHours())+":"+p2(n.getMinutes())+":"+p2(n.getSeconds());delete S.wiz.errors["conf.authorizedAt"];S.wizFocus="w-conf-authorizedAt";wizRender();return;}
  if(t.dataset.wvdel!==undefined){S.wiz.m.versions.splice(+t.dataset.wvdel,1);if(!S.wiz.m.versions.length)S.wiz.m.versions.push(blankVersion());S.wizFocus="w-vadd";wizRender();return;}
  if(t.dataset.wadd){wizAddItem(t.dataset.wadd);return;}
  if(t.dataset.wdel){var q=t.dataset.wdel.split("|");wizDelItem(q[0],q.slice(1).join("|"));return;}
  if(t.dataset.wstep){var n2=+t.dataset.wstep;if(n2<=S.wiz.furthest&&n2!==S.wiz.step){S.wiz.step=n2;saveWiz();wizEnter();}return;}
});
/* ---- timezone combobox: search, keyboard and mouse selection ---- */
document.addEventListener("focusin",function(e){
  if(!S.wiz||!e.target||e.target.id!=="w-acc-tz")return;
  tzFilter(e.target);
});
document.addEventListener("input",function(e){
  if(!S.wiz||!e.target||e.target.id!=="w-acc-tz")return;
  tzFilter(e.target);
});
document.addEventListener("keydown",function(e){
  if(!S.wiz||!e.target||e.target.id!=="w-acc-tz")return;
  var pop=document.getElementById("w-tzpop");
  if(e.key==="Escape"){if(pop&&!pop.hidden){e.preventDefault();tzRestore(e.target);}}
  else if(e.key==="ArrowDown"){e.preventDefault();if(pop&&pop.hidden)tzFilter(e.target);tzMove(e.target,1);}
  else if(e.key==="ArrowUp"){e.preventDefault();if(pop&&pop.hidden)tzFilter(e.target);tzMove(e.target,-1);}
  else if(e.key==="Enter"){if(pop&&!pop.hidden&&tzShown.length){e.preventDefault();tzPick(e.target,tzShown[Math.max(tzActive,0)].z);}}
});
document.addEventListener("mousedown",function(e){
  if(!S.wiz)return;
  if(e.target.closest&&e.target.closest("#w-tzpop li[role=option]"))e.preventDefault();
});
document.addEventListener("click",function(e){
  if(!S.wiz)return;
  var inp=document.getElementById("w-acc-tz");if(!inp)return;
  if(e.target.closest&&e.target.closest("#w-tzpop li[role=option]")){tzPick(inp,e.target.closest("#w-tzpop li[role=option]").getAttribute("data-tz"));return;}
  if(e.target.closest&&e.target.closest("#w-tzopen")){var pop=document.getElementById("w-tzpop");if(pop.hidden)tzFilter(inp);else tzClose(inp);return;}
  if(!e.target.closest||!e.target.closest("#w-tzcomb"))tzClose(inp);
});

function endSession(){
  // Even an unusable file receives a temporary inspection handle. End Session
  // must clear that handle too, rather than only a file that reached analysis.
  var endingUploadId=S.upload&&S.upload.upload_id;clearOptionalInputs();S.pendingNew=null;S.selectorFilters={};
  uploadGeneration++;invalidateResult();planGeneration++;updateGeneration++;wizardGeneration++;configStageGeneration++;S.cockpit=false;S.modal=null;S.updSnap=null;S.analysisMapping=null;S.analysisSetup=null;S.displayUnit='seconds';S.cockpitChosen=false;S.mappingIssues=null;S.workflowStart=false;
  try{sessionStorage.removeItem("athena.configuration");}catch(e){}
  clearDraft();S.draftNote=null;clearWiz();clearNewWizardDraft();clearStagedConfig();S.wiz=null;
  S.sampleSet=null;try{sessionStorage.removeItem(SAMPLE_CHOICE_KEY);}catch(e){}
  S.config=null;S.configSummary=null;S.staged=null;S.cfgIssues=null;S.cfgNotice=null;S.bq=null;S.answers={};S.upload=null;S.plan=null;S.updateFailed=null;S.updateBusy=false;S.busy=false;
  // Local session state has already been cleared above.  The server cleanup is
  // best-effort: an unavailable local server must not strand the operator on a
  // page that still looks like an active analysis.
  var finish=function(){go(S.shell==="sidebar"?"home":"start");};
  return api("/api/end-session",{upload_id:endingUploadId}).then(finish,finish);
}
function restoreConfig(){
  var raw=null;try{raw=sessionStorage.getItem("athena.configuration");}catch(e){}
  if(!raw||S.cfg.configuration_storage!=="session")return Promise.resolve();
  return api("/api/configuration/validate",raw,{raw:true,headers:{"Content-Type":"application/json"}}).then(function(r){
    if(r.body.ok){S.config=r.body.configuration;S.configSummary=r.body.summary;}
    else{S.cfgNotice=(r.body.issues&&r.body.issues[0]?r.body.issues[0].problem+" ":"")+"Upload it again to continue.";try{sessionStorage.removeItem("athena.configuration");}catch(e){}}
  });
}
function stageConfig(file){
  var generation=++configStageGeneration;
  busy(1);var fin=function(){setTimeout(function(){busy(-1);},0);};
  var p=stageConfig2(file,generation);p.then(fin,fin);return p;
}
var STAGED_CONFIG_KEY="athena.configuration.pending";
function clearStagedConfig(){
  S.staged=null;
  try{sessionStorage.removeItem(STAGED_CONFIG_KEY);}catch(e){}
}
function retainStagedConfig(staged){
  S.staged=staged;
  try{sessionStorage.setItem(STAGED_CONFIG_KEY,JSON.stringify(staged.configuration));}catch(e){}
}
function restoreStagedConfig(){
  var raw=null;
  try{raw=sessionStorage.getItem(STAGED_CONFIG_KEY);}catch(e){}
  if(!raw||S.shell!=="sidebar")return Promise.resolve();
  return api("/api/configuration/validate",raw,{raw:true,headers:{"Content-Type":"application/json"}}).then(function(r){
    if(!r.body.ok){clearStagedConfig();S.cfgIssues=r.body.issues;return;}
    return prepareStagedConfig(r.body);
  });
}
function prepareStagedConfig(result,generation){
  var staged={configuration:result.configuration,summary:result.summary,warnings:result.warnings,changes:[]};
  if(!S.configSummary){retainStagedConfig(staged);return Promise.resolve();}
  return api("/api/configuration/diff",{active:S.configSummary,staged:result.summary}).then(function(d){
    if(generation!==undefined&&generation!==configStageGeneration)return;
    staged.changes=d.body.lines||[];
    retainStagedConfig(staged);
  });
}
function stageConfig2(file,generation){
  S.cfgIssues=null;clearStagedConfig();
  return file.arrayBuffer().then(function(b){return api("/api/configuration/validate",b,{raw:true,headers:{"Content-Type":"application/json"}});}).then(function(r){
    if(generation!==configStageGeneration)return;
    if(!r.body.ok){S.cfgIssues=r.body.issues;render();return;}
    return prepareStagedConfig(r.body,generation).then(function(){if(generation===configStageGeneration)render();});
  });
}
function useStaged(){var staged=S.staged;if(!staged)return Promise.resolve();var unchanged=S.config&&JSON.stringify(S.config)===JSON.stringify(staged.configuration);
 clearStagedConfig();
 if(unchanged){var configOpener=S.modal?.from;S.cfgIssues=null;S.cfgNotice=null;S.modal=null;S.workflowStart=false;if(S.updSnap){var sn=S.updSnap;S.answers=sn.answers;S.analysisMapping=sn.analysisMapping;S.analysisSetup=sn.analysisSetup;S.displayUnit=sn.displayUnit||'seconds';S.cockpitChosen=sn.cockpitChosen;S.plan=sn.plan;S.result=sn.result;S.updSnap=null;}render();if(configOpener)document.getElementById(configOpener)?.focus({preventScroll:true});return Promise.resolve(S.plan);}
 if(S.updSnap){S.updSnap=null;S.updateFailed=null;S.updateBusy=false;updateGeneration++;}
 invalidateResult();S.config=staged.configuration;S.configSummary=staged.summary;S.staged=null;S.cfgIssues=null;S.cfgNotice=null;
 try{sessionStorage.setItem('athena.configuration',JSON.stringify(S.config));}catch(e){}
 // Run-local choices belong to the analysis, not to account metadata. Replan
 // them against changed inputs and keep invalid choices editable with feedback.
 S.mappingIssues=null;
 if(S.shell==='sidebar'){S.workflowStart=false;S.modal=null;S.cockpit=false;S.page='data';if(!S.bq)S.bq=S.cfg.business_questions[0].id;}
 if(S.plan||S.bq)return replan().then(function(plan){
   if(S.shell==="sidebar"&&S.page==="data"&&!S.modal&&!S.cockpit)workspaceFocus();
   return plan;
 });
 render();return Promise.resolve();}
function cardsHtml(){
  var h='<div class="cards">';
  S.cfg.business_questions.forEach(function(q){h+='<button class="card" data-bq="'+esc(q.id)+'"><strong>'+esc(q.title)+'</strong><span class="muted">'+esc(q.summary)+'</span></button>';});
  return h+'</div>';
}
function legacyConfigHtml(){
  var h='';
  h+='<h2>Account configuration</h2><p class="muted">Athena reads the contractual target, the scope and what handling time includes from a saved configuration, so you do not retype them for every run.</p>';
  if(S.cfg.profiles.length){
    h+='<div class="panel scroll"><table><thead><tr><th>Configuration</th><th>Account</th><th>Lines of Business</th><th class="n">Target</th><th>Confirmed by</th></tr></thead><tbody>'
      +S.cfg.profiles.map(function(p){return '<tr><td>'+esc(p.profile_id)+' '+esc(p.profile_version)+'</td><td>'+esc(p.account_id)+'</td><td>'+esc(p.line_of_business_ids.join(", "))+'</td><td class="n">'+(p.target_value===null||p.target_value===undefined?"—":n0(p.target_value)+" sec")+'</td><td>'+esc(p.confirmed_by)+'</td></tr>';}).join("")
      +'</tbody></table></div>';
  }else{
    h+='<div class="panel">No account configuration is saved yet. Add one and Athena will match it to your uploads.</div>';
  }
  h+='<div class="actions"><a class="btn secondary" href="/api/account-template" download>Download the blank configuration</a>'
    +'<label class="btn secondary" for="acctfile">Upload a configuration</label><input class="sr" id="acctfile" type="file" accept=".json,application/json"></div>';
  if(S.acctIssues&&S.acctIssues.length)h+=issuesHtml(S.acctIssues,false);
  return h;
}

/* ---- application shell (sidebar) ---- */
var TITLES={home:"Home",new:"New Analysis",data:"Data Workspace",insights:"Insights","full-insights":"Full-detail Insights",config:"Session Configuration",guides:"Templates & Guides"};
var DRAFT_KEY="athena.draft";
function questionTitle(){var q=S.cfg.business_questions.filter(function(x){return x.id===S.bq;})[0];return q?q.title:"";}
function pageNew(){return '<h1>New Analysis</h1><p class="muted">Pick a question to begin.</p>'+cardsHtml();}
function pageConfigDestination(){
  if(S.cfg.configuration_storage!=="session")return '<h1>Session Configuration</h1>'+legacyConfigHtml();
  return '<h1>Session Configuration</h1>'+(S.wiz?wizardHtml():configLandingHtml());
}
function homeState(){
  if(S.cfgNotice&&!S.config)return "unrestorable";
  if(S.result)return "results";
  if(S.bq)return "draft";
  if(S.config)return "configured";
  return "empty";
}
function pageHome(){
  var st=homeState(),h='<h1>Welcome to Athena</h1><p class="muted">Start a new analysis, or pick up where you left off.</p>';
  if(S.cfgNotice)h+='<div class="notice info"><b>The configuration saved for this tab was not restored.</b>'+esc(S.cfgNotice)+'</div>';
  if(S.draftNote)h+='<div class="notice info"><b>Part of your analysis was not restored.</b>'+esc(S.draftNote)+'</div>';
  if(st==="results"){
    var R=S.result;
    h+='<div class="panel"><strong>Results available for this session</strong><p style="margin:6px 0 0">'+esc(headlineText(R))+'</p><dl style="margin-top:10px"><dt>Scope</dt><dd>'+esc(R.scope.account)+' · '+esc(R.scope.lines_of_business.join(", "))+' · '+esc(R.scope.start)+' to '+esc(R.scope.end)+'</dd></dl></div>'
      +'<div class="actions"><button class="btn" id="h-view">View Insights</button><button class="btn secondary" id="h-new" data-go="new">New Analysis</button></div>';
  }else if(st==="draft"){
    var pl=S.plan||{},answered=!!(S.answers&&S.answers.goal),checked=!!(S.upload&&S.upload.ok),scoped=checked&&!!pl.complete;
    h+='<div class="panel"><strong>Analysis in progress</strong><dl style="margin-top:10px"><dt>Question</dt><dd>'+esc(questionTitle())+'</dd></dl>'
      +'<ul class="steps"><li class="'+(answered?'done':'todo')+'">'+(answered?'Questions answered':'Questions not yet answered')+'</li>'
      +'<li class="'+(checked?'done':'todo')+'">'+(checked?'File checked':'File not uploaded')+'</li>'
      +'<li class="'+(scoped?'done':'todo')+'">'+(scoped?'Scope chosen':'Scope not yet chosen')+'</li></ul></div>'
      +'<div class="actions"><button class="btn" id="h-continue">Continue analysis</button><button class="btn secondary" id="h-discard">Start over</button></div>';
  }else if(st==="configured"){
    h+='<div class="panel"><strong>Active configuration</strong>'+cfgSummaryDl(S.configSummary)+targetsTable(S.configSummary.targets)+'</div>'
      +'<div class="actions"><button class="btn" id="h-new" data-go="new">New Analysis</button><button class="btn secondary" id="h-config" data-go="config">Change the configuration</button></div>';
  }else if(st==="unrestorable"){
    h+='<div class="actions"><button class="btn" id="h-config" data-go="config">Upload a configuration</button><button class="btn secondary" id="h-new" data-go="new">New Analysis</button></div>';
  }else{
    h+='<div class="panel">No configuration is active for this session. Add one to apply your targets and scope, or start an analysis without one.</div>'
      +'<div class="actions"><button class="btn" id="h-new" data-go="new">New Analysis</button><button class="btn secondary" id="h-config" data-go="config">Add a configuration</button></div>';
  }
  return h;
}
function pageGuides(){
  var G=S.cfg.guides,h='<h1>Templates &amp; Guides</h1><p class="muted">Templates and plain explanations for the files Athena reads.</p><h2>Data templates</h2>';
  G.layouts.forEach(function(l){
    h+='<div class="panel"><strong>'+esc(l.label)+'</strong> · <a href="'+esc(l.template)+'" download>Download the template</a><div class="scroll"><table><thead><tr><th>Column</th><th>What it holds</th></tr></thead><tbody>'
      +l.columns.map(function(c){return '<tr><td>'+esc(c.name)+(c.optional?' <span class="muted">(optional)</span>':'')+'</td><td>'+esc(c.meaning)+'</td></tr>';}).join('')+'</tbody></table></div></div>';
  });
  h+='<h2>Account configuration</h2><div class="panel">'+(S.cfg.configuration_storage==="session"?'<p style="margin:0 0 10px">A configuration holds your targets, limits, scope and approval, so you do not retype them. It stays in this browser tab, and nothing is stored on the server.</p>':'')
    +'<a class="btn secondary" href="/api/account-template" download>Download the blank configuration</a><div class="scroll" style="margin-top:12px"><table><thead><tr><th>Field</th><th>What it holds</th></tr></thead><tbody>'
    +Object.keys(S.cfg.field_help).map(function(k){return '<tr><td>'+esc(k)+'</td><td>'+esc(S.cfg.field_help[k])+'</td></tr>';}).join('')+'</tbody></table></div></div>';
  h+='<h2>What happens to rows with problems</h2><div class="panel scroll"><table><thead><tr><th>What Athena finds</th><th>What happens</th><th>Why</th><th>What to do</th></tr></thead><tbody>'
    +G.problems.map(function(x){return '<tr><td>'+esc(x.problem)+'</td><td><strong>'+esc(x.kind)+'.</strong> '+esc(x.effect)+'</td><td>'+esc(x.why)+'</td><td>'+esc(x.remedy)+'</td></tr>';}).join('')+'</tbody></table></div>';
  return h;
}
/* ---- draft: kept for this tab session only. It holds identifiers and answers, never a dataset, a result or a confirmation. ---- */
function saveDraft(){try{if(!S.bq||S.draftRecovery)return;sessionStorage.setItem(DRAFT_KEY,JSON.stringify({v:4,displayUnit:S.displayUnit,bq:S.bq,answers:S.answers,analysisMapping:S.analysisMapping||null,analysisSetup:S.analysisSetup||null,upload:(S.upload&&S.upload.ok&&S.upload.restore_token)?{id:S.upload.upload_id,token:S.upload.restore_token}:null,cockpitChosen:!!S.cockpitChosen,optionalOwner:S.optionalOwner||null,optionals:optionalReferences()}));}catch(e){}}
function clearDraft(){S.draftRecovery=false;try{sessionStorage.removeItem(DRAFT_KEY);}catch(e){}}
function discardDraft(){clearOptionalInputs();S.selectorFilters={};invalidateResult();planGeneration++;abandonUpload();clearDraft();S.bq=null;S.answers={};S.plan=null;S.draftNote=null;S.analysisMapping=null;S.analysisSetup=null;S.displayUnit='seconds';S.cockpitChosen=false;S.mappingIssues=null;S.cockpit=false;render();}
function plainObject(x){return !!x&&typeof x==='object'&&!Array.isArray(x);}
function validAnswersDraft(a){if(!keysOnly(a,['goal','report_questions','scope_lines_of_business','scope_contact_types','scope_period','group_dimension','target','target_override']))return false;
 if(['goal','report_questions','scope_lines_of_business','scope_contact_types'].some(function(k){return k in a&&!validStringList(a[k]);}))return false;
 if('scope_period' in a&&(!keysOnly(a.scope_period,['start','end'])||!draftDate(a.scope_period.start)||!draftDate(a.scope_period.end)))return false;
 if('group_dimension' in a&&!['line_of_business','contact_type'].includes(a.group_dimension))return false;
 return ['target','target_override'].every(function(k){var v=a[k];return v===undefined||keysOnly(v,['value','unit','confirmed'])&&(!('value' in v)||finiteDraftNumber(v.value))&&(!('unit' in v)||['seconds','minutes',''].includes(v.unit))&&(!('confirmed' in v)||typeof v.confirmed==='boolean');});}
function validAnalysisDraft(d){return plainObject(d)&&[1,2,3,4].includes(d.v)&&(d.v===1||keysOnly(d,d.v===4?['v','bq','answers','analysisMapping','analysisSetup','upload','cockpitChosen','displayUnit','optionalOwner','optionals']:['v','bq','answers','analysisMapping','analysisSetup','upload','cockpitChosen','displayUnit']))&&S.cfg.business_questions.some(function(q){return q.id===d.bq;})&&(d.v<3||typeof d.displayUnit==='string'&&Object.prototype.hasOwnProperty.call(S.cfg.duration_units,d.displayUnit))&&validAnswersDraft(d.answers)&&(d.analysisMapping==null||validMappingDraft(d.analysisMapping))&&(d.v===1||(d.analysisSetup===null||validSetupDraft(d.analysisSetup))&&typeof d.cockpitChosen==='boolean')&&(d.upload===null||keysOnly(d.upload,['id','token'])&&typeof d.upload.id==='string'&&/^[0-9a-f]{16}$/.test(d.upload.id)&&typeof d.upload.token==='string'&&d.upload.token.length>0&&d.upload.token.length<=256)&&(d.v!==4||validOptionalDraft(d));}
function restoreDraft(){var raw=null;try{raw=sessionStorage.getItem(DRAFT_KEY);}catch(e){}if(!raw||S.shell!=="sidebar")return Promise.resolve();var d=null;try{d=JSON.parse(raw);}catch(e){}if(!validAnalysisDraft(d)){S.draftRecovery=true;S.draftNote='A saved analysis draft could not be restored. It is kept until you choose Reset saved draft.';return Promise.resolve();}
 var generation=++uploadGeneration,optionalRestoreEpoch=optionalEpoch;S.bq=d.bq;S.answers=d.answers;S.analysisMapping=d.analysisMapping||null;S.analysisSetup=d.analysisSetup||null;S.cockpitChosen=d.v>=2&&d.cockpitChosen;S.displayUnit=d.v>=3?d.displayUnit:'seconds';
 var p=Promise.resolve();if(d.upload)p=api('/api/upload/restore',{upload_id:d.upload.id,token:d.upload.token}).then(function(r){if(generation!==uploadGeneration)return;if(r.status===200)S.upload=r.body;else S.draftNote='Your file is no longer available. Upload it again to continue.';});return p.then(function(){return restoreOptionalDraft(d,optionalRestoreEpoch);}).then(function(){if(generation===uploadGeneration)return replan();});}
function pageStart(){
  var h='<h1>What would you like to understand?</h1><p class="muted">Pick a question to begin.</p>'+cardsHtml();
  if(S.cfg.configuration_storage==='session')return h+sessionConfigHtml();
  return h+legacyConfigHtml();
}

function dataConfigNotices(p){
  var h='',r=p.scope_restrictions,cs=p.configuration_status;
  if(cs&&!cs.applied)h+='<div class="notice info"><b>The active configuration is not applied.</b>'+esc(cs.text)+'</div>';
  if(r){
    var q=r.lines_of_business_not_covered||[],ct=r.contact_types_not_covered||[];
    if(q.length)h+='<div class="notice info"><b>Your saved configuration covers '+esc((r.lines_of_business_covered||[]).join(", ")||"none of these Lines of Business")+'.</b>'+esc(q.join(", "))+' in your file '+(q.length===1?'is':'are')+' left out until the configuration includes '+(q.length===1?'it':'them')+'.</div>';
    if(ct.length)h+='<div class="notice info"><b>Your configuration does not cover every contact type in your file.</b>'+esc(ct.join(", "))+' '+(ct.length===1?'is':'are')+' left out until the configuration includes '+(ct.length===1?'it':'them')+'.</div>';
  }

  return h;
}

function pageData(){
  var p=S.plan,h='<h1>'+(S.shell==="sidebar"?"Data Workspace":"Your data")+'</h1>';
  h+=phaseQs("before_upload").map(qHtml).join("");
  if(!p||!p.ready_for_upload)return h;
  h+='<h2>What to upload</h2>';
  p.dataset_requests.forEach(function(r){
    h+='<div class="panel"><strong>'+esc(r.label)+'</strong><p class="muted" style="margin:4px 0 8px">Upload a CSV in one of these layouts.</p><ul class="plain">'
      +r.accepted.map(function(g){return '<li><strong>'+esc(g.label)+'</strong>'+(r.preferred_grain===g.grain?' (preferred)':'')+' — columns: '+esc(g.columns.join(", "))+'. <a href="/templates/'+esc(g.template)+'" download>Template</a></li>';}).join("")
      +'</ul>'+(r.why?'<p class="muted" style="margin:10px 0 0">'+esc(r.why)+'</p>':'')+'</div>';
  });
  h+='<div class="drop" id="drop"><p style="margin:0 0 10px">Drop your CSV here or</p><label class="btn secondary" for="file">Choose a file</label><input class="sr" id="file" type="file" accept=".csv,text/csv"></div>';
  if(S.busy)h+='<p class="muted" role="status">'+busyLabel('Adding and checking '+(S.uploadingFile||'your file')+'\u2026')+'</p>';
  if(S.failed)h+='<div class="notice" role="alert"><b>The file could not be checked.</b>'+esc(S.failed)+'</div>';
  if(S.upload&&!S.upload.ok)h+=issuesHtml(S.upload.issues,!(S.upload.notices&&S.upload.notices.length))+setAsideHtml();
  if(S.upload&&S.upload.ok){
    var u=S.upload.summary;
    h+='<h2>What we found</h2><div class="panel"><dl><dt>File</dt><dd>'+esc(u.file)+'</dd><dt>Layout</dt><dd>'+(u.grain==="contact"?"One row per contact":"One row per agent per day")
      +'</dd><dt>Rows</dt><dd>'+n0(u.rows)+'</dd><dt>Account name</dt><dd>'+esc(u.accounts[0])+'</dd><dt>Dates</dt><dd>'+esc(u.date_min)+' to '+esc(u.date_max)
      +'</dd><dt>Agents</dt><dd>'+n0(u.agents)+'</dd><dt>Time unit</dt><dd>Seconds</dd>'
      +'<dt>Configuration</dt><dd>'+(S.upload.profile?esc(S.upload.profile.profile_id)+' '+esc(S.upload.profile.profile_version):(S.cfg.configuration_storage==="session"?(S.plan&&S.plan.configuration_status?(S.plan.configuration_status.applied?esc(activeConfigName()):"Not applied: a different account"):"None active for this session"):"None saved for this account"))+'</dd></dl></div>';
    if(S.upload.notices&&S.upload.notices.length)h+=setAsideHtml();
    else if(S.upload.exclusions)h+='<div class="notice info"><b>'+n0(S.upload.exclusions.excluded_row_count)+' rows were left out of this analysis.</b>They are listed in the evidence for this run.</div>'
      +(S.upload.manifest_url?'<div class="actions"><a class="btn secondary" href="'+esc(S.upload.manifest_url)+'" download>Download the rows to correct</a></div>':'');
    h+=dataConfigNotices(p);
    h+=phaseQs("after_upload").map(qHtml).join("");
    p.derived.forEach(function(d){h+='<p class="muted">Groups are based on '+esc(d.label==='Line of Business'?d.label:d.label.toLowerCase())+'.</p>';});
    if(p.complete){
      h+='<h2>Confirm scope and target</h2><div class="panel"><ul class="plain">'
        +'<li>Account '+esc(u.accounts[0])+', Lines of Business '+esc(p.answers.scope_lines_of_business.join(", "))+', '+esc(p.answers.scope_period.start)+' to '+esc(p.answers.scope_period.end)+'.</li>'
        +p.assumptions.map(function(x){return '<li>'+esc(x)+'</li>';}).join("")
        +'<li>Time values in the file are in seconds.</li></ul>'
        +'<label class="opt"><input type="checkbox" id="confirm"'+(S.confirmed?" checked":"")+'><span>These details are correct for this run.</span></label></div>'
        +'<div class="actions"><button class="btn" id="analyze"'+(S.confirmed?"":" disabled")+'>Show insights</button></div>';
    }
  }
  return h;
}

function lineChart(series,target,stepFn){
  var tv=stepFn?series.map(function(p){return stepFn(p.key);}).filter(function(v){return v!==null&&v!==undefined;}):(target===null?[]:[target]);
  var W=640,H=240,m={l:48,r:14,t:12,b:30},vals=series.map(function(s){return s.value;}).concat(tv);
  var lo=Math.min.apply(null,vals)-20,hi=Math.max.apply(null,vals)+20;
  function x(i){return m.l+(W-m.l-m.r)*(series.length===1?.5:i/(series.length-1));}
  function y(v){return m.t+(H-m.t-m.b)*(1-(v-lo)/(hi-lo));}
  var s='<svg class="chart" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+ML()+' by day">';
  [lo,(lo+hi)/2,hi].forEach(function(v){s+='<line x1="'+m.l+'" x2="'+(W-m.r)+'" y1="'+y(v)+'" y2="'+y(v)+'" stroke="var(--line)"/><text x="'+(m.l-6)+'" y="'+(y(v)+4)+'" text-anchor="end">'+Math.round(v)+'</text>';});
  if(stepFn){
    var segs=[],cur=[],last=null;series.forEach(function(p,i){var v=stepFn(p.key);if(v===null||v===undefined){if(cur.length)segs.push(cur);cur=[];}else{cur.push(x(i)+','+y(v));last=v;}});if(cur.length)segs.push(cur);
    segs.forEach(function(g){s+='<polyline fill="none" stroke="var(--accent)" stroke-dasharray="5 4" points="'+g.join(' ')+'"/>';});
    if(last!==null)s+='<text x="'+(W-m.r)+'" y="'+(y(last)-5)+'" text-anchor="end">Target '+durationNumber(last,true)+'</text>';
  }else if(target!==null)s+='<line x1="'+m.l+'" x2="'+(W-m.r)+'" y1="'+y(target)+'" y2="'+y(target)+'" stroke="var(--accent)" stroke-dasharray="5 4"/><text x="'+(W-m.r)+'" y="'+(y(target)-5)+'" text-anchor="end">Target '+durationNumber(target,true)+'</text>';
  s+='<polyline fill="none" stroke="var(--ink)" stroke-width="2" points="'+series.map(function(p,i){return x(i)+','+y(p.value);}).join(' ')+'"/>';
  series.forEach(function(p,i){s+='<circle cx="'+x(i)+'" cy="'+y(p.value)+'" r="3.5" fill="var(--ink)"><title>'+esc(p.key)+': '+durationNumber(p.value,false)+' '+durationUnitSymbol()+'</title></circle>';if(i%2===0||series.length<6)s+='<text x="'+x(i)+'" y="'+(H-8)+'" text-anchor="middle">'+esc(p.key.slice(5))+'</text>';});
  return s+'</svg>';
}
function comparisonBarScale(values,reference,zeroBaseline=false){
  var lowest=Math.min.apply(null,values),start=zeroBaseline?Math.min(0,lowest):lowest-Math.abs(lowest)*0.15;
  var highest=Math.max.apply(null,values),span=(Number.isFinite(reference)?Math.max(highest,reference):highest)-start;
  return {start:start,share:function(value){return span?(value-start)/span:0;}};
}
function comparisonBars(rows, format, scaleFormat, label, zeroBaseline=false){
  if(!rows.length)return '';
  var scale=comparisonBarScale(rows.map(function(row){return row.value;}),null,zeroBaseline);
  return '<p class="muted">Bars start at '+esc(scaleFormat(scale.start))+'.</p><div class="bars" role="group" aria-label="'+esc(label)+'">'+rows.map(function(row){
    return '<div class="barrow"><span>'+esc(row.key)+'</span><i aria-hidden="true" style="width:'+scale.share(row.value)*100+'%"></i><span>'+esc(format(row))+'</span></div>';
  }).join("")+'</div>';
}
function barChart(groups,target){
  if(!groups.length)return '';
  var W=640,rowH=38,H=groups.length*rowH+14,l=110,hasTarget=Number.isFinite(target);
  var scale=comparisonBarScale(groups.map(function(g){return g.value;}),target);
  function w(v){return (W-l-60)*scale.share(v)/1.1;}
  var s='<svg class="chart" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+ML()+' by group">';
  groups.forEach(function(g,i){var y=i*rowH+8;s+='<text x="'+(l-8)+'" y="'+(y+19)+'" text-anchor="end">'+esc(g.key)+'</text><rect x="'+l+'" y="'+y+'" width="'+w(g.value)+'" height="26" rx="4" fill="var(--bar)"/><text x="'+(l+w(g.value)+8)+'" y="'+(y+19)+'">'+durationNumber(g.value,false)+' '+durationUnitSymbol()+'</text>';});
  if(hasTarget&&target>=scale.start)s+='<line x1="'+(l+w(target))+'" x2="'+(l+w(target))+'" y1="0" y2="'+H+'" stroke="var(--accent)" stroke-dasharray="5 4"/>';
  var note=hasTarget&&target<scale.start?' The '+fcValue(target)+' target is below this scale.':'';
  return '<p class="muted">Bars start at '+fcValue(scale.start)+'.'+note+'</p>'+s+'</svg>';
}
function gapText(g){if(g===null)return "";return g===0?"on target":durationNumber(Math.abs(g),false)+" "+durationUnitSymbol()+" "+(g>0?"above":"below")+" target";}
function gapCls(g){return g===null?"":g>0.05?"over":g<-0.05?"under":"";}
function limits(view){if(S.shell==="sidebar")return '';var r=S.result.restrictions.filter(function(x){return x.view===view;});return r.length?'<h2>Limits of this view</h2>'+r.map(function(x){return '<p class="muted">'+esc(x.text)+'</p>';}).join(""):"";}

function resultText(p){if(p.target_met===null||p.target===null||p.target===undefined)return "—";return p.target_met?"Meets":"Misses by "+durationNumber(Math.abs(p.gap),false)+" "+durationUnitSymbol()+"";}
function limitText(p){var sp=p.specification;if(sp.conforms===null)return "—";return sp.conforms?"Within":(sp.above_upper?"Above upper limit":"Below lower limit");}
function periodLabel(p){return esc(p.first_date)+(p.last_date!==p.first_date?' to '+esc(p.last_date):'');}
function headlineText(R){
  var A=R.target_assessment,t=R.target_value,x=''+ML()+' is '+durationNumber(R.value,false)+' '+durationUnitSymbol()+'';
  if(A){
    if(A.status==="published"){
      if(A.overall&&A.overall.classified&&A.overall.target!==null&&A.overall.target!==undefined&&A.overall.target_met!==null)
        x+=A.overall.target_met?', which meets the '+durationNumber(A.overall.target,true)+' '+durationUnitSymbol()+' target':', which misses the '+durationNumber(A.overall.target,true)+' '+durationUnitSymbol()+' target by '+durationNumber(Math.abs(A.overall.gap),false)+' '+durationUnitSymbol()+'';
      else if(A.multiple_targets)x+='. The target changed during this period, so each period is compared with its own target';
    }
  }else if(R.gap!==null&&R.target_kind==="entered")x+=', '+(R.gap===0?"on target":durationNumber(Math.abs(R.gap),false)+' '+durationUnitSymbol()+' '+(R.gap>0?"above":"below")+' the '+durationNumber(t,true)+' '+durationUnitSymbol()+' target');
  return x+'.';
}
function targetSectionHtml(R){
  var A=R.target_assessment;if(!A)return "";
  if(S.shell==="sidebar"&&A.status==="published"){
    var periods=A.periods,hasTarget=periods.some(function(p){return p.target!==null&&p.target!==undefined;}),hasLower=periods.some(function(p){return p.specification.lower!==null;}),hasUpper=periods.some(function(p){return p.specification.upper!==null;});
    if(!hasTarget&&!hasLower&&!hasUpper)return '';
    var h='<h2>Performance requirements</h2><div class="scroll"><table><thead><tr><th>Period</th><th>'+gCountLabel()+'</th><th>'+ML()+' ('+durationUnitSymbol()+')</th>'+(hasTarget?'<th>Target ('+durationUnitSymbol()+')</th><th>Target result</th>':'')+(hasLower?'<th>Lower limit ('+durationUnitSymbol()+')</th>':'')+(hasUpper?'<th>Upper limit ('+durationUnitSymbol()+')</th>':'')+(hasLower||hasUpper?'<th>Limit result</th>':'')+'</tr></thead><tbody>';
    h+=periods.map(function(p){return '<tr><td>'+periodLabel(p)+'</td><td>'+n0(p.count)+'</td><td>'+durationNumber(p.value,false)+'</td>'+(hasTarget?'<td>'+num(p.target)+'</td><td>'+esc(resultText(p))+'</td>':'')+(hasLower?'<td>'+num(p.specification.lower)+'</td>':'')+(hasUpper?'<td>'+num(p.specification.upper)+'</td>':'')+(hasLower||hasUpper?'<td>'+esc(limitText(p))+'</td>':'')+'</tr>';}).join('')+'</tbody></table></div>';
    if(A.overall&&A.overall.note)h+='<p>'+esc(A.overall.note)+'</p>';
    return h;
  }
  if(A.status!=="published"){var parts=A.reason.split(". ");return '<div class="notice info"><b>'+esc(parts[0])+'.</b>'+esc(parts.slice(1).join(". "))+'</div>';}
  var h='<h2>Against your targets</h2><div class="scroll"><table><thead><tr><th>Period</th><th class="n">Contacts</th><th class="n">Average ('+durationUnitSymbol()+')</th><th class="n">Target ('+durationUnitSymbol()+')</th><th>Target result</th><th class="n">Lower limit ('+durationUnitSymbol()+')</th><th class="n">Upper limit ('+durationUnitSymbol()+')</th><th>Limit result</th></tr></thead><tbody>'
   +A.periods.map(function(p){return '<tr><td class="nw">'+periodLabel(p)+(p.has_target?'':' (no target)')+'</td><td class="n">'+n0(p.count)+'</td><td class="n">'+durationNumber(p.value,false)+'</td><td class="n">'+num(p.target)+'</td><td class="nw '+(p.target_met===false?'over':p.target_met?'under':'')+'">'+esc(resultText(p))+'</td><td class="n">'+num(p.specification.lower)+'</td><td class="n">'+num(p.specification.upper)+'</td><td class="nw '+(p.specification.conforms===false?'over':p.specification.conforms?'under':'')+'">'+esc(limitText(p))+'</td></tr>';}).join("")
   +'</tbody></table></div>';
  if(A.overall&&A.overall.note)h+='<p class="muted">'+esc(A.overall.note)+'</p>';
  h+='<p class="muted">Meeting the target and staying within a specification limit are separate results.</p>';
  A.limitations.forEach(function(l){h+='<p class="muted">'+esc(l.replace('Dates are worked out in UTC until account-local business dates are applied.','Dates use UTC.'))+'</p>';});
  return h;
}
function conditionalHtml(R){
  if(!R.conditional)return "";
  return '<div class="panel" style="border-style:dashed"><strong>'+esc(R.conditional.label)+'</strong><p style="margin:6px 0 0">With a what-if target of '+durationNumber(R.conditional.target_value,true)+' '+durationUnitSymbol()+', the average of '+durationNumber(R.value,false)+' '+durationUnitSymbol()+' is '+gapText(R.conditional.gap)+'. Your official targets are unchanged.</p></div>';
}
function targetFor(R){
  var A=R.target_assessment;if(!A||A.status!=="published")return null;
  return function(d){for(var i=0;i<A.periods.length;i++){var p=A.periods[i];if(p.has_target&&p.effective_start<=d&&(!p.effective_end||d<p.effective_end))return p.target;}return null;};
}
function targetEvidenceHtml(R){
  var A=R.target_assessment,h='';
  if(S.shell==="sidebar"&&A&&A.status==="published"&&!A.periods.some(function(p){return p.has_target||p.specification.lower!==null||p.specification.upper!==null;}))return '';
  if(R.target_kind==="conditional_override")h+='<h3>What-if target</h3><p>'+durationNumber(R.target_value,true)+' '+durationUnitSymbol()+', entered for this session. It is not official target compliance, and your approved targets are unchanged.</p>';
  if(!A)return h;
  h+='<h3>Targets and limits applied</h3>';
  if(A.status!=="published")return h+'<p>'+esc(A.reason)+'</p>';
  h+='<ul class="plain">'+A.periods.map(function(p){var parts=['average '+durationNumber(p.value,false)+' '+durationUnitSymbol()+''];if(p.has_target)parts.push('target '+durationNumber(p.target,true)+' '+durationUnitSymbol()+', '+esc(resultText(p).toLowerCase()));if(p.specification.lower!==null)parts.push('lower limit '+n0(p.specification.lower)+' '+durationUnitSymbol()+'');if(p.specification.upper!==null)parts.push('upper limit '+n0(p.specification.upper)+' '+durationUnitSymbol()+'');if(p.specification.lower!==null||p.specification.upper!==null)parts.push(esc(limitText(p).toLowerCase()));return '<li>'+periodLabel(p)+': '+parts.join('; ')+'.</li>';}).join("")+'</ul>';
  A.limitations.forEach(function(l){h+='<p class="muted">'+esc(l.replace('Dates are worked out in UTC until account-local business dates are applied.','Dates use UTC.'))+'</p>';});
  var ev=R.evidence&&R.evidence[0]&&R.evidence[0].numerical_outputs.configuration_provenance;
  if(R.target_mapping_source==="analysis_setup")h+='<p class="muted">Target mapping supplied during this analysis setup.</p>';
  if(R.configuration&&ev)h+='<p class="muted">Account definitions and coverage: configuration '+esc(R.configuration.configuration_id)+' '+esc(R.configuration.configuration_version)+(R.configuration.confirmed_by?', confirmed by '+esc(R.configuration.confirmed_by):'')+'. Built from '+ev.inputs.map(function(i){return esc(i.kind.replace(/_/g," "))+' ('+esc(i.sha256.slice(0,12))+')';}).join(", ")+'; '+ev.transformations.length+' recorded transformation'+(ev.transformations.length===1?'':'s')+'.</p>';
  return h;
}

function pageInsights(){
  var R=S.result,sc=R.scope,t=R.target_value;
  var h='<h1>'+ML()+'</h1><p class="muted">'+esc(sc.account)+' · '+esc(sc.lines_of_business.join(", "))+' · '+esc(sc.start)+' to '+esc(sc.end)+'</p>';
  if(R.value===null)return h+'<p class="notice" role="alert"><b>No average to show.</b>There are no handled contacts in this selection, so '+ml()+' cannot be calculated.</p><div class="actions"><button class="btn secondary" id="change">Change selection</button></div>';
  h+='<p class="headline">'+headlineText(R)+'</p>';
  h+='<div class="actions"><button class="btn secondary" id="show-evidence">How this was calculated</button><button class="btn secondary" id="show-data">About the data</button><button class="btn secondary" id="change">Change selection</button></div>';
  if(R.population_statement){if(R.population_statement.partial)h+='<div class="notice info"><b>Based on the eligible records.</b>'+esc(R.population_statement.text)+'</div>';}
  else if(R.exclusions)h+='<div class="notice info"><b>'+n0(R.exclusions.excluded_row_count)+' rows were left out of this analysis.</b>Their reasons are in the calculation details.</div>';
  var tabs=[["overview","Overview"]];if(R.views.indexOf("group")!==-1&&R.by_group)tabs.push(["group","By group"]);if(R.views.indexOf("time")!==-1)tabs.push(["time","Over time"]);
  if(!tabs.some(function(x){return x[0]===S.view;}))S.view="overview";
  h+='<div role="tablist" aria-label="Views">'+tabs.map(function(x){return '<button role="tab" data-view="'+x[0]+'" aria-selected="'+(S.view===x[0])+'">'+x[1]+'</button>';}).join("")+'</div><div role="tabpanel">';
  if(S.view==="overview"){
    h+='<div class="kpis"><div class="kpi"><b>'+durationNumber(R.value,false)+' '+durationUnitSymbol()+'</b><span>'+ML()+'</span></div>'
      +(R.target_kind==="entered"&&t!==null?'<div class="kpi"><b>'+durationNumber(t,true)+' '+durationUnitSymbol()+'</b><span>Target</span></div><div class="kpi"><b class="'+gapCls(R.gap)+'">'+(R.gap>0?"+":"")+durationNumber(R.gap,false)+' '+durationUnitSymbol()+'</b><span>Gap to target</span></div>':'')
      +((R.target_assessment&&R.target_assessment.status==="published"&&R.target_assessment.overall&&R.target_assessment.overall.classified&&R.target_assessment.overall.target!==null&&R.target_assessment.overall.target!==undefined)?'<div class="kpi"><b>'+durationNumber(R.target_assessment.overall.target,true)+' '+durationUnitSymbol()+'</b><span>Target</span></div><div class="kpi"><b class="'+(R.target_assessment.overall.target_met?"under":"over")+'">'+(R.target_assessment.overall.gap>0?"+":"")+durationNumber(R.target_assessment.overall.gap,false)+' '+durationUnitSymbol()+'</b><span>Gap to target</span></div>':'')
      +'<div class="kpi"><b>'+n0(R.count)+'</b><span>Handled contacts</span></div></div>'+targetSectionHtml(R)+conditionalHtml(R)+limits("overview");
  }else if(S.view==="group"){
    var g=R.by_group.slice().filter(function(x){return x.value!==null;}).sort(function(a,b){return b.value-a.value;});
    var GA=R.group_assessments?R.group_assessments:null;
    var gaOf=function(k){return GA?GA.filter(function(x){return x.key===k;})[0]:null;};
    var gaCell=function(k){var a=gaOf(k);if(!a)return '—';if(a.status==="no_target_applies")return 'No target applies';if(a.status!=="published")return esc(a.reason.split(". ")[0]);return a.periods.map(function(p){return esc(resultText(p))+(p.has_target?' ('+num(p.target)+' '+durationUnitSymbol()+''+(a.multiple_targets?' from '+esc(p.first_date):'')+')':'');}).join('; ');};
    h+=barChart(g,t)+'<div class="scroll"><table><thead><tr><th>'+esc(sc.group_by==="line_of_business"?"Line of Business":"Contact type")+'</th><th class="n">Average ('+durationUnitSymbol()+')</th><th class="n">Contacts</th>'+(t!==null?'<th class="n">'+(R.target_kind==="conditional_override"?"Versus what-if target":"Versus target")+'</th>':'')+(GA?'<th>Target that applies</th>':'')+'</tr></thead><tbody>'
      +g.map(function(r){return '<tr><td>'+esc(r.key)+'</td><td class="n">'+durationNumber(r.value,false)+'</td><td class="n">'+n0(r.count)+'</td>'+(t!==null?'<td class="n '+gapCls(r.gap)+'">'+gapText(r.gap)+'</td>':'')+(GA?'<td>'+gaCell(r.key)+'</td>':'')+'</tr>';}).join("")+'</tbody></table></div>'+(GA?'<p class="muted">A target applies to a group only when your configuration names that group.</p>':'')+limits("group");
  }else{
    h+=lineChart(R.by_day.filter(function(x){return x.value!==null;}),R.target_kind==="entered"||R.target_kind==="conditional_override"?t:null,targetFor(R))+limits("time");
  }
  return h+'</div>';
}

function evidenceHtml(){
  var R=S.result,sc=R.scope,w=R.weighting_proof;
  var h='<h2>How this was calculated</h2><dl><dt>Calculation</dt><dd>'+(metricKind()==='seconds'?durationNumber(R.total,true)+' '+durationUnitSymbol()+' ÷ '+n0(R.count)+' contacts = '+durationNumber(R.value,false)+' '+durationUnitSymbol():esc(calcText(R)))+'</dd>'
   +'<dt>Scope</dt><dd>'+esc(sc.account)+' · '+esc(sc.lines_of_business.join(", "))+'</dd><dt>Period</dt><dd>'+esc(sc.start)+' to '+esc(sc.end)+'</dd>'
   +(R.target_kind==="entered"&&R.target_value!==null?'<dt>Target</dt><dd>'+durationNumber(R.target_value,true)+' '+durationUnitSymbol()+''+(R.profile?' from '+esc(R.profile.profile_id)+' '+esc(R.profile.profile_version):'')+'</dd>':'')+'</dl>'+targetEvidenceHtml(R)+scopedTargetsHtml(R);
  if(R.population_statement)h+='<h3>Contacts used</h3><p>'+esc(R.population_statement.text)+'</p>';
  if(!w&&R.weighting_proof_unavailable)h+='<h3>Comparison with an average of agent averages</h3><p>'+esc(R.weighting_proof_unavailable.reason)+'</p>';
  if(w){
    h+='<h3>Why this differs from an average of agent averages</h3><div class="scroll"><table><thead><tr><th></th><th>'+esc(w.contact_weighted.label)+'</th><th>'+esc(w.unweighted_agent_mean.label)+'</th></tr></thead><tbody>'
     +'<tr><td class="muted">Result</td><td><strong>'+durationNumber(w.contact_weighted.value,false)+' '+durationUnitSymbol()+'</strong></td><td>'+durationNumber(w.unweighted_agent_mean.value,false)+' '+durationUnitSymbol()+'</td></tr>'
     +'<tr><td class="muted">How</td><td>'+esc(weightingFormula(false))+'</td><td>'+esc(weightingFormula(true))+'</td></tr>'
     +'<tr><td class="muted">Figures</td><td>'+durationNumber(w.contact_weighted.total_handling_seconds,true)+' '+durationUnitSymbol()+' ÷ '+n0(w.contact_weighted.handled_contacts)+'</td><td>'+n0(w.unweighted_agent_mean.agents)+' agent averages</td></tr>'
     +'<tr><td class="muted">What it weighs</td><td>Every contact handled</td><td>Every agent, whatever their volume</td></tr></tbody></table></div>'
     +'<p>'+esc(weightingNarrative(w))+'</p>';
    var top=w.agents.slice(0,8).map(function(a){return {key:a.agent_id,value:a.count,metric:a.value};});
    h+='<h3>Where the contacts went</h3>'+(S.shell==="sidebar"?'':'')+comparisonBars(top,function(a){return n0(a.value)+' · '+fcValue(a.metric);},
      function(v){return v.toLocaleString('en-US',{maximumFractionDigits:2})+' contacts';},"Contact volume by agent")
     +(w.agents.length>top.length?'<p class="muted">Showing the '+top.length+' highest-volume agents of '+n0(w.agents.length)+'.</p>':'');
  }
  var dq=R.data_quality;
  if(dq&&dq.reconciliation){
    var rc=dq.reconciliation;
    h+='<h3>Every row in the file</h3>'+(S.shell==="sidebar"?dsTiles({counts:{source:rc.source_rows,invalid:rc.quarantined,
      identical:rc.collapsed_copies,held:rc.held,valid:rc.canonical_valid}},true):
      '<dl><dt>In the file</dt><dd>'+n0(rc.source_rows)+'</dd><dt>Counted</dt><dd>'+n0(rc.canonical_valid)+'</dd>'
      +'<dt>Repeats counted once</dt><dd>'+n0(rc.collapsed_copies)+'</dd><dt>Set aside as invalid</dt><dd>'+n0(rc.quarantined)+'</dd><dt>Held for a conflict</dt><dd>'+n0(rc.held)+'</dd></dl>');
    if(dq.notices.length)h+='<div class="scroll"><table><thead><tr><th>What happened</th><th class="n">Rows</th></tr></thead><tbody>'
      +dq.notices.map(function(n){return '<tr><td>'+esc(n.problem)+' '+esc(n.effect)+'</td><td class="n">'+n0(n.row_count)+'</td></tr>';}).join("")+'</tbody></table></div>';
    if(dq.groups.length)h+='<p class="muted">'+n0(dq.groups.length)+' group'+(dq.groups.length===1?'':'s')+' of records share an identifier; each is listed in the downloadable file.</p>';
    if(dq.manifest_url)h+='<div class="actions"><a class="btn secondary" href="'+esc(dq.manifest_url)+'" download>Download the rows to correct</a></div>';
  }else if(R.exclusions&&R.exclusions.entries[0]&&R.exclusions.entries[0].problem){
    h+='<h3>Rows left out</h3><div class="scroll"><table><thead><tr><th>Reason</th><th class="n">Rows</th></tr></thead><tbody>'
     +R.exclusions.entries.map(function(e){return '<tr><td>'+esc(e.problem)+' '+esc(e.remedy)+'</td><td class="n">'+n0(e.row_count)+'</td></tr>';}).join("")
     +'</tbody></table></div>'+(S.upload&&S.upload.manifest_url?'<div class="actions"><a class="btn secondary" href="'+esc(S.upload.manifest_url)+'" download>Download the rows to correct</a></div>':'');
  }
  return h;
}
function dataHtml(){
  var u=S.result.summary;
  return '<h2>About the data</h2><dl><dt>File</dt><dd>'+esc(u.file)+'</dd><dt>Rows</dt><dd>'+n0(u.rows)+'</dd><dt>Layout</dt><dd>'+(u.grain==="contact"?"One row per contact":"One row per agent per day")
   +'</dd><dt>Agents</dt><dd>'+n0(u.agents)+'</dd><dt>Time unit</dt><dd>Seconds</dd>'
   +(u.longest_contact_seconds!==null?'<dt>Longest contact</dt><dd>'+n0(u.longest_contact_seconds)+' sec, included in all figures</dd>':'')
   +(u.eligible_records!==undefined?'<dt>Records used</dt><dd>'+n0(u.eligible_records)+' of '+n0(u.rows)+'</dd>':'')
   +'<dt>Missing values</dt><dd>None estimated or filled in</dd><dt>File fingerprint</dt><dd>'+esc(u.fingerprint)+'</dd></dl>';
}

function render(){
  if(S.shell==="sidebar"){renderShell();return;}
  ["start","data","insights"].forEach(function(p){var b=document.getElementById("n-"+p);b.removeAttribute("aria-current");if(S.page===p)b.setAttribute("aria-current","page");
    b.disabled=(p==="data"&&!S.bq)||(p==="insights"&&!S.result);});
  main.innerHTML=S.page==="start"?pageStart():S.page==="data"?pageData():pageInsights();
}
/* ---- carried helpers (report data, preview record, source states) ---- */
var XSTATE={calc:["calculated","Calculated from your data"],na:["unavailable","Planned analytics · not calculated"]};
function xR(){return S.result||(S.updSnap&&S.updSnap.result)||null;}
function withR(R,fn){var s=S.result;S.result=R;try{return fn();}finally{S.result=s;}}
function xb(label,state){S.xblocks.push([label,state]);return ' data-source="'+XSTATE[state][0]+'"';}
function xH(h){return h.replace(/<h2>/g,"<h3>").replace(/<\/h2>/g,"</h3>");}
function xPanel(R,view){return withR(R,function(){var sv=S.view;S.view=view;try{var d=document.createElement("div");d.innerHTML=pageInsights();var p=d.querySelector("[role=tabpanel]");return p?xH(p.innerHTML):"";}finally{S.view=sv;}});}
function xGroups(R){return (R.by_group||[]).filter(function(g){return g.value!==null;}).slice().sort(function(a,b){return b.value-a.value;});}
function xHasTarget(R){var A=R.target_assessment;if(A&&A.status==="published"&&A.overall&&A.overall.classified&&A.overall.target!==null&&A.overall.target!==undefined)return A.overall.target;if(!A&&R.target_kind==="entered"&&R.target_value!==null)return R.target_value;return null;}
function xTitle(R){
  var A=R.target_assessment;
  if(A&&A.status==="published"){
    if(A.overall&&A.overall.classified&&A.overall.target!==null&&A.overall.target!==undefined&&A.overall.target_met!==null)
      return A.overall.target_met?""+ML()+" meets the account target.":(A.overall.gap>0?""+ML()+" is above the account target.":""+ML()+" is below the account target.");
    if(A.multiple_targets)return "The account target changed during this period.";
  }else if(!A&&R.gap!==null&&R.target_kind==="entered"){
    var g=R.gap;return g===0?""+ML()+" is on the account target.":(g>0?""+ML()+" is above the account target.":""+ML()+" is below the account target.");
  }
  return ""+ML()+" is "+durationNumber(R.value,false)+" "+durationUnitName(false)+".";
}
function xFindings(R){
  var f=[],A=R.target_assessment,gs=xGroups(R),views=R.views||[];
  if(A&&A.status==="published"){
    if(A.overall&&A.overall.classified&&A.overall.target!==null&&A.overall.target!==undefined&&A.overall.target_met!==null)
      f.push({h:""+ML()+" "+(A.overall.target_met?"meets":"misses")+" the target.",p:"The average is "+durationNumber(R.value,false)+" "+durationUnitSymbol()+" against a "+durationNumber(A.overall.target,true)+" "+durationUnitSymbol()+" target"+(A.overall.target_met?".":", a gap of "+durationNumber(Math.abs(A.overall.gap),false)+" "+durationUnitSymbol()+".")});
    else if(A.multiple_targets)f.push({h:"The target changed during this period.",p:"Each period is compared with its own target. The periods are listed under Against your targets in chapter 01."});
    var ps=A.periods.filter(function(p){return p.specification&&p.specification.conforms!==null;});
    if(ps.length){var out=ps.filter(function(p){return !p.specification.conforms;}).length;f.push({h:out?"Some periods are outside the specification limits.":"Every period is within the specification limits.",p:out?(out+" of "+ps.length+" period"+(ps.length===1?"":"s")+" fall outside the limits. Meeting the target and staying within limits are separate results."):("All "+ps.length+" period"+(ps.length===1?"":"s")+" with limits are within them. Meeting the target is a separate result.")});}
  }else if(!A&&R.target_kind==="entered"&&R.gap!==null){
    f.push({h:""+ML()+" is "+(R.gap===0?"on":durationNumber(Math.abs(R.gap),false)+" "+durationUnitSymbol()+" "+(R.gap>0?"above":"below"))+" the "+durationNumber(R.target_value,true)+" "+durationUnitSymbol()+" target.",p:"The average is "+durationNumber(R.value,false)+" "+durationUnitSymbol()+" across "+n0(R.count)+" handled contacts. The target is the one entered for this session."});
  }
  if(gs.length>=2){var hi=gs[0],lo=gs[gs.length-1];f.push({h:hi.key+" has the highest "+ml()+".",p:hi.key+" averages "+durationNumber(hi.value,false)+" "+durationUnitSymbol()+" per contact, against "+durationNumber(lo.value,false)+" "+durationUnitSymbol()+" for "+lo.key+"."+(R.target_value!==null&&gapText(hi.gap)?" "+hi.key+" is "+gapText(hi.gap)+".":"")});}
  if(views.indexOf("time")!==-1){var days=(R.by_day||[]).filter(function(d){return d.value!==null;});if(days.length>=7){var mx=days.reduce(function(a,b){return b.value>a.value?b:a;});f.push({h:"Highest day: "+mx.key+".",p:""+ML()+" was "+durationNumber(mx.value,false)+" "+durationUnitSymbol()+" across "+n0(mx.count)+" contacts. This is a description of the day, not a test of whether it is unusual."});}}
  if(R.population_statement&&R.population_statement.partial)f.push({h:"Based on the eligible records.",p:R.population_statement.text});
  else if(R.exclusions&&R.exclusions.excluded_row_count)f.push({h:n0(R.exclusions.excluded_row_count)+" rows were left out.",p:"Their reasons are in the technical evidence."});
  return f;
}
function xSourceTable(){
  var rows=S.xblocks.map(function(b){return '<tr><td>'+esc(b[0])+'</td><td>'+esc(XSTATE[b[1]][1])+'</td></tr>';}).join("");
  return '<h3>Source of each part of this report</h3><div class="scroll"><table><thead><tr><th>Part</th><th>Source</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
}
function xEvidence(){return '<p class="muted">Display: '+esc(durationUnitName())+'.'+(metricKind()==='seconds'?' API numerical evidence remains in canonical seconds.':'')+'</p>'+withR(xR(),function(){return xH(evidenceHtml());})+xSourceTable();}
function xData(){return withR(xR(),function(){return dataHtml();});}
function xCloseDrawer(){var from=S.drawerFrom;closeDrawer();S.drawerFrom=null;if(from&&document.contains(from))from.focus();}
function xFaq(items){return '<div class="x-faq"><h3>Questions you may have</h3>'+items.map(function(q){return '<details open><summary>'+esc(q[0])+'</summary><p>'+esc(q[1])+'</p></details>';}).join("")+'</div>';}
function xUnavail(text){return '<div class="x-card x-unavail" role="note"><span class="g-kpi-badge g-neutral">Planned · Not calculated</span><h3>Pending analytics</h3><p>'+esc(text)+'</p></div>';}
/* ===== Athena executive MVP: Gemini 01.05 shell (sidebar mode) ===== */
/* Owner-supplied light/dark logo assets. */
function gLogo(c){return '<span class="g-logo '+c+'" aria-hidden="true"><picture><source media="(prefers-color-scheme: dark)" srcset="./assets/athena-dark-02.svg"><img src="./assets/athena-light-02.svg" alt="" style="width:100%;height:100%;object-fit:contain"></picture></span>';}
function gIcon(d,w,extra){return '<svg width="'+(w||18)+'" height="'+(w||18)+'" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="'+d+'"/>'+(extra||'')+'</svg>';}
function gChevron(direction,size){return gIcon(direction<0?'m15 6-6 6 6 6':'m9 6 6 6-6 6',size);}
const RETURN_TO_SLIDE_ICON='m9 6-5 5 5 5M4 11h11a5 5 0 0 1 0 10h-2';
var GI={
 home:"M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
 data:"M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7M4 7c0-2 1-3 3-3h10c2 0 3 1 3 3M4 7h16m-7 4v6m-3-3h6",
 insights:"M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
 settings:"M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z",
 plus:"M12 4v16m8-8H4",up:"M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12",dl:"M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4",
 cloud:"M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12",list:"M4 6h16M4 12h16M4 18h7"};
S.displayUnit='seconds';S.cockpit=false;S.modal=null;S.grain=null;S.updSnap=null;S.modalFresh=false;S.analysisMapping=null;S.analysisSetup=null;S.displayUnit='seconds';S.cockpitChosen=false;S.mappingIssues=null;S.workflowStart=false;
function gRoute(p){
 if(p==="cockpit"){S.page="home";S.modal=null;S.cockpit=true;render();window.scrollTo(0,0);(document.getElementById('g-ck-h')||main).focus({preventScroll:true});return true;}
  if(p==="full-insights"&&!canOpenFullInsights())return true;
  if(p==="new"){gStartAnalysis();return true;}
  if(p==="config"){gOpenSettings("wizard");return true;}
  if(p==="guides"){gOpenSettings("guides");return true;}
  if(p==="data"&&!S.config){S.workflowStart=true;gOpenSettings("wizard");return true;}
  return false;
}
function gStartAnalysis(opener){
  if(S.pendingNew)return;
  var model=S.newWizDraft?wJ(S.newWizDraft.m):blankModel();
  S.pendingNew={wizDraft:S.wizDraft,workflowStart:S.workflowStart,initial:JSON.stringify(model)};
  S.workflowStart=true;
  if(!S.modal)gOpenSettings('wizard',opener);
  openWizard(model,1);
}
function closeNewDraft(){
  var old=S.pendingNew,from=S.modal?.from;
  saveWiz();wizardGeneration++;stageOther=false;
  S.newWizDraft=readNewWizardDraft();S.wiz=null;S.wizDraft=old.wizDraft;S.workflowStart=old.workflowStart;S.pendingNew=null;S.modal=null;
  render();(document.getElementById(from)||main).focus({preventScroll:true});
}
function commitNew(){if(!S.pendingNew)return;S.pendingNew=null;S.selectorFilters={};clearOptionalInputs();invalidateResult();planGeneration++;updateGeneration++;S.updSnap=null;abandonUpload();S.answers={};S.plan=null;S.analysisMapping=null;S.analysisSetup=null;S.displayUnit='seconds';S.cockpitChosen=false;S.mappingIssues=null;S.bq=S.cfg.business_questions[0].id;clearDraft();}
function beginModification(page){if(!S.updSnap)S.updSnap={answers:wJ(S.answers||{}),analysisSetup:S.analysisSetup?wJ(S.analysisSetup):null,displayUnit:S.displayUnit,cockpitChosen:!!S.cockpitChosen,analysisMapping:S.analysisMapping?wJ(S.analysisMapping):null,plan:S.plan,result:S.result,confirmed:S.confirmed};S.modal=null;S.cockpit=page==='cockpit';S.page=page==='cockpit'?'home':'data';render();}
function cancelModification(){var sn=S.updSnap;if(!sn)return;invalidateResult();planGeneration++;updateGeneration++;S.answers=sn.answers;S.analysisSetup=sn.analysisSetup;S.displayUnit=sn.displayUnit||'seconds';S.analysisMapping=sn.analysisMapping;S.cockpitChosen=sn.cockpitChosen;S.plan=sn.plan;S.result=sn.result;S.confirmed=sn.confirmed;S.updSnap=null;S.mappingIssues=null;S.failed=null;go(S.result?'insights':'data');}
function modificationButton(kind){return '<button type="button" class="g-modify-icon" data-modify="'+kind+'" aria-label="'+(kind==='data'?'Change analyzed datasets':'Change analysis scope')+'" title="'+(kind==='data'?'Change analyzed datasets':'Change analysis scope')+'">'+gIcon('M14.7 6.3a5 5 0 00-6.4 6.4L3 18l3 3 5.3-5.3a5 5 0 006.4-6.4l-3 3-3-3z',18)+'</button>';}

function renderSide(){
  var items=[["home","Home"],["data","Data Workspace"],["cockpit","Analysis Cockpit"],["insights","Insights"]];
  document.getElementById("side").innerHTML='<div class="g-brand-header">'+gLogo("g-logo-sm")+'<div><div class="g-brand-title">Athena</div><div class="g-brand-sub">Intelligence</div></div></div>'
   +'<nav aria-label="Primary"><ul class="g-nav-list">'+items.map(function(x){var dis=(x[0]==="data"&&!S.bq)||(x[0]==="cockpit"&&!(S.upload&&S.upload.ok))||(x[0]==="insights"&&!S.result&&!(S.updSnap&&S.updSnap.result));
      return '<li><button class="g-nav-btn" type="button" id="s-'+x[0]+'" data-go="'+x[0]+'"'+((S.cockpit?x[0]==='cockpit':(S.page==='full-insights'?'insights':S.page)===x[0])?' aria-current="page"':'')+(dis?' disabled':'')+'>'+gIcon(GI[x[0]]||GI.data)+'<span>'+esc(x[1])+'</span></button>'+((x[0]==='data'&&S.upload&&S.upload.ok)?modificationButton('data'):'')+((x[0]==='cockpit'&&S.cockpitChosen)?modificationButton('cockpit'):'')+(x[0]==='insights'?'<ul id="g-insights-nav" hidden></ul>':'')+'</li>'+((x[0]==='insights'&&(S.result||(S.updSnap&&S.updSnap.result)))?'<li class="g-nav-sub"><button class="g-nav-btn g-nav-sub-btn" type="button" id="s-datasum" aria-haspopup="dialog" aria-expanded="'+(S.modal&&S.modal.tab==='datasum'?'true':'false')+'">'+gIcon('M5 4h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5a1 1 0 011-1zM4 10h16M10 10v10',16)+'<span>Data analyzed</span></button></li>':'');}).join('')
   +'<li><button class="g-nav-btn" type="button" id="s-settings" aria-haspopup="dialog"'+(S.modal?' aria-expanded="true"':' aria-expanded="false"')+'>'+gIcon(GI.settings,18,'<circle cx="12" cy="12" r="3"/>')+'<span>Settings</span></button></li></ul></nav>'
   +'<div class="g-sidebar-footer"><span>Session only</span>'+((S.config||S.bq||S.wiz||S.wizDraft||S.newWizDraft||S.staged||S.sampleSet)?'<button class="g-linkbtn" id="s-end" type="button">End session</button>':'')+'</div>';
}
function gDirText(d){return {lower_is_better:"Lower is better",higher_is_better:"Higher is better",within_bounds:"Within bounds",monitor_only:"Monitor only"}[d]||"";}
/* One-word journey status. Exported will be added when an export exists. */
function journeyStatus(){
  if(S.result)return 'Insights';
  if(S.upload&&S.upload.ok)return S.cockpitChosen&&S.plan&&S.plan.complete?'Scoped':'Data added';
  return S.config?'Configured':'Start';
}
function renderTop(){
  var cap='<span class="g-session-badge" id="g-status" role="status"><span class="g-badge-dot"></span><span>'+esc(journeyStatus())+'</span></span>';
  document.getElementById("topbar").innerHTML='<button class="btn secondary" id="menu-toggle" aria-controls="side" aria-expanded="'+document.body.classList.contains("menu-open")+'">Menu</button>'
   +'<div class="g-breadcrumbs"><span>Athena</span><span aria-hidden="true">/</span><strong>'+esc(S.cockpit?'Analysis Cockpit':TITLES[S.page]||"Home")+'</strong></div>'+cap;
}
function gStatusCard(){
  var c=S.configSummary;if(!S.config||!c)return '';
  var ts=(c.targets||[]).filter(function(t){return t.target!==null&&t.target!==undefined;}),tt=ts.length===0?"No target set":(ts.length===1?durationNumber(ts[0].target,true)+" "+durationUnitSymbol()+""+(gDirText(ts[0].direction)?" ("+gDirText(ts[0].direction).toLowerCase()+")":""):"Varies by period");
  return '<section class="g-session-status-card" aria-labelledby="g-st-h"><div class="g-status-card-header"><h2 class="g-status-title" id="g-st-h">Active session configuration</h2><button class="g-status-edit-link" id="g-edit-cfg" type="button">Edit in Settings &rarr;</button></div>'
   +'<div class="g-meta-quad"><div class="g-meta-box"><span class="g-lbl">Account</span><span class="g-val">'+esc(c.account_id)+'</span></div><div class="g-meta-box"><span class="g-lbl">Target</span><span class="g-val">'+esc(tt)+'</span></div>'
   +'<div class="g-meta-box"><span class="g-lbl">Covered Lines of Business</span><span class="g-val">'+esc(c.line_of_business_ids.join(", "))+' ('+c.line_of_business_ids.length+')</span></div><div class="g-meta-box"><span class="g-lbl">Time zone</span><span class="g-val">'+esc(c.business_timezone)+'</span></div></div></section>';
}
function gHome(){
  if(S.cockpit)return '<div class="g-home-wrap">'+gCockpit()+'</div>';
  var st=homeState(),h='<div class="g-home-wrap g-home-landing">';
  if(S.cfgNotice)h+='<div class="notice" role="alert">'+esc(S.cfgNotice)+'</div>';
  if(S.draftNote)h+='<div class="notice" role="alert">'+esc(S.draftNote)+'</div>';if(S.draftRecovery||S.wizRecovery)h+='<button class="btn secondary" id="reset-recovery">Reset saved draft</button>';
  h+='<div class="g-hero-center">'+gLogo("g-logo-hero")+'<h1>Welcome to Athena</h1><p>Understand performance. Find your next step.</p></div>';
  if(st==="results")h+='<section class="g-resume g-resume-panel"><div><strong>Analysis results</strong><p>'+esc(headlineText(S.result))+'</p></div><button class="btn" id="h-view">View Insights</button></section>';
  else if(st==="draft")h+='<section class="g-resume g-resume-panel" aria-label="Analysis in progress"><div><strong>Analysis in progress</strong>'+(S.upload&&S.upload.ok?'<p>'+esc(S.upload.summary.file)+'</p>':'')+'</div><div class="actions"><button class="btn" id="h-continue">Continue analysis</button><button class="btn secondary" id="h-discard">Start over</button></div></section>';
  h+='<div class="g-pathways-grid"><button class="g-path-card'+(st==="results"||st==="draft"?'':' g-path-primary')+'" type="button" id="h-new" data-go="new"><span class="g-path-top"><span class="g-path-icon">'+gIcon(GI.plus,24)+'</span><span><h3>Start New Analysis</h3><p>Set up your account and choose your data.</p></span></span><span class="g-path-cta">Get started &rarr;</span></button>'
    +'<button class="g-path-card" type="button" id="h-file"><span class="g-path-top"><span class="g-path-icon">'+gIcon(GI.up,24)+'</span><span><h3>Continue from a File</h3><p>Import a configuration or download the template.</p></span></span><span class="g-path-cta">File options &rarr;</span></button></div>';
  return h+'</div>';
}
function setupFactCells(rows){return rows.filter(v=>v[1]).map(v=>'<dl><dt>'+esc(v[0])+'</dt><dd>'+(v[2]?v[1]:esc(v[1]))+'</dd></dl>').join('');}
function workspaceReviewHtml(id,title,action,rows,detail){return '<section class="workspace-setup" aria-labelledby="'+id+'"><div class="workspace-setup-heading"><h2 id="'+id+'">'+esc(title)+'</h2>'+action+'</div><div class="workspace-setup-core">'+setupFactCells(rows)+'</div>'+(detail&&detail!=='<dl></dl>'?'<details class="workspace-setup-detail"><summary>Business profile</summary>'+detail+'</details>':'')+'</section>';}
function cockpitReviewHtml(){
 var c=S.configSummary||{};
 var datasets=loadedDatasets(),primary=datasets.find(d=>d.primary),optional=datasets.filter(d=>!d.primary);
 var files=(primary?'<strong>'+esc(primary.code+' · '+primary.file)+'</strong>':'')+(optional.length?'<details class="cockpit-loaded-files"><summary>'+optional.length+' optional '+(optional.length===1?'file':'files')+'</summary><ul class="dataset-review-list">'+optional.map(d=>'<li>'+esc(d.code+' · '+d.file)+'</li>').join('')+'</ul></details>':'<div class="muted">No optional files</div>');
 return workspaceReviewHtml('cockpit-review-h','Setup and dataset review','<button type="button" class="selector-utility" id="g-ck-cancel">Edit datasets &rarr;</button>',[['Account name',c.account_id],['Time zone',c.business_timezone],['Date format',dateFormatText(c.date_format)],['Loaded datasets',files,true]]);
}
function cockpitReportQuestions(){
  var selected=new Set(S.answers.report_questions||[]);
  var groups=S.plan.cockpit_report_questions||[];
  return '<section aria-labelledby="cockpit-report-questions"><div class="cockpit-question-heading"><div><h3 id="cockpit-report-questions">What do you want to find out?</h3><p class="muted">Your performance summary is always included.</p></div>'
    +'<div class="cockpit-question-actions" role="group" aria-label="Question selection"><button type="button" class="selector-utility" id="cockpit-select-questions" aria-label="Select all questions" data-report-bulk="all">Select all</button><button type="button" class="selector-utility" id="cockpit-clear-questions" aria-label="Clear all questions" data-report-bulk="none">Clear all</button></div></div>'
    +'<div class="cockpit-report-groups">'+groups.map((group,index)=>'<div role="group"'+(group.title==='What operational areas should we improve in?'?' class="cockpit-improvement-group"':'')+' aria-labelledby="cockpit-topic-'+index+'"><h4 id="cockpit-topic-'+index+'">'+esc(group.title)+'</h4>'
      +group.options.map(option=>'<label class="opt"><input type="checkbox" data-report-question value="'+esc(option.id)+'"'
        +(selected.has(option.id)?' checked':'')+'><span>'+esc(option.label)+'</span></label>').join('')
      +'</div>').join('')+'</div></section>';
}
function updateCockpitQuestions(form,bulk,selection){
 if(S.analysisBusy||S.updateBusy||!form)return;
 var choices=Array.from(form.querySelectorAll('[data-report-question]'));
 if(bulk)choices.forEach(input=>{input.checked=bulk==='all';});
 var selected=choices.filter(input=>selection?.has(input.value)??input.checked).map(input=>input.value);
 if(selection)selected.push(...Array.from(selection).filter(id=>!choices.some(input=>input.value===id)));
 var previous=S.answers.report_questions;
 if(previous&&previous.length===selected.length&&previous.every((id,i)=>id===selected[i]))return;
 S.answers.report_questions=selected;
 S.cockpitChosen=true;invalidateResult();saveDraft();
 if(bulk)document.getElementById('live').textContent=bulk==='all'?'All questions selected.':'All question selections cleared.';
}
document.addEventListener('click',function(e){var button=e.target.closest('button[data-report-bulk]');if(button)updateCockpitQuestions(button.closest('#cockpit-form'),button.dataset.reportBulk);});

// Preview in the existing controls. Their owners receive a single change on release.
var cockpitDrag=null, cockpitDragClick=null;
var cockpitDragScopes='[data-selector-box="scope_lines_of_business"],[data-selector-box="scope_contact_types"]';

function cockpitDragAvailable(control){
 if(control?.dataset.dailyChoice)return chartFilter?.panel.contains(control)&&!chartFilter.pending;
 return S.shell==='sidebar'&&S.cockpit&&!S.modal&&!S.analysisBusy&&!S.updateBusy;
}

function cockpitDragOption(control,target){
 var option=control.dataset.selectorBox
   ?target?.closest('button[data-selector][data-value]')
   :control.dataset.dailyChoice?target?.closest('label')?.querySelector('input[type=checkbox]')
   :target?.closest('label.opt')?.querySelector('input[data-report-question]');
 return option&&control.contains(option)&&!option.matches(':disabled')&&!option.closest('[hidden]')?option:null;
}

function paintCockpitDragOption(option,checked){
 if(option.matches('input')){option.checked=checked;return;}
 option.setAttribute('aria-checked',String(checked));
 option.setAttribute('aria-pressed',String(checked));
 option.querySelector('.selection-check').textContent=checked?'✓':'';
}

function previewCockpitDragAt(drag,x,y){
 var option=cockpitDragOption(drag.control,document.elementFromPoint(x,y));
 if(!option||drag.changed.has(option))return;
 var id=option.dataset.value??option.value;
 if(drag.initial.has(id)===drag.checked)return;
 drag.changed.set(option,id);
 paintCockpitDragOption(option,drag.checked);
}

function moveCockpitDrag(drag,x,y){
 // Sample the path so a fast sweep across small controls still reaches the intervening options.
 var steps=Math.max(1,Math.ceil(Math.hypot(x-drag.x,y-drag.y)/12));
 for(var step=1;step<=steps;step++){
   previewCockpitDragAt(drag,drag.x+(x-drag.x)*step/steps,drag.y+(y-drag.y)*step/steps);
 }
 drag.x=x;drag.y=y;
}

function cockpitDragScrollStep(y,top,bottom){
 var edge=Math.min(32,(bottom-top)/3);
 if(edge<=0||y<top||y>bottom)return 0;
 if(y<top+edge)return -Math.ceil(12*(top+edge-y)/edge);
 if(y>bottom-edge)return Math.ceil(12*(y-bottom+edge)/edge);
 return 0;
}

function scrollCockpitDrag(drag){
 if(!cockpitDragAvailable(drag.control)||!drag.control.isConnected){finishCockpitDrag(false);return;}
 var box=drag.control.getBoundingClientRect(), form=drag.control.closest('#cockpit-form');
 if(drag.control.dataset.dailyChoice){
   var limits=chartFilter.panel.getBoundingClientRect();
   if(drag.x>=box.left&&drag.x<=box.right){
     drag.control.scrollTop+=cockpitDragScrollStep(drag.y,Math.max(box.top,limits.top),Math.min(box.bottom,limits.bottom));
     previewCockpitDragAt(drag,drag.x,drag.y);
   }
   drag.frame=requestAnimationFrame(()=>scrollCockpitDrag(drag));
   return;
 }
 var top=form.querySelector('.cockpit-jumps').getBoundingClientRect().bottom;
 var bottom=Math.min(window.innerHeight,form.querySelector('.cockpit-actionbar').getBoundingClientRect().top);
 if(drag.x>=box.left&&drag.x<=box.right&&drag.y>=box.top&&drag.y<=box.bottom){
   var previous=drag.control.scrollTop;
   if(drag.control.dataset.selectorBox){
     drag.control.scrollTop+=cockpitDragScrollStep(drag.y,Math.max(box.top,top),Math.min(box.bottom,bottom));
   }
   if(drag.control.scrollTop===previous)document.scrollingElement.scrollTop+=cockpitDragScrollStep(drag.y,top,bottom);
   previewCockpitDragAt(drag,drag.x,drag.y);
 }
 drag.frame=requestAnimationFrame(()=>scrollCockpitDrag(drag));
}

function finishCockpitDrag(commit){
 var drag=cockpitDrag;
 if(!drag)return;
 cockpitDrag=null;
 cancelAnimationFrame(drag.frame);
 if(drag.control.hasPointerCapture(drag.pointer))drag.control.releasePointerCapture(drag.pointer);
 if(!commit||!cockpitDragAvailable(drag.control)||!drag.control.isConnected){
   drag.changed.forEach((id,option)=>paintCockpitDragOption(option,drag.initial.has(id)));
   return;
 }
 if(!drag.changed.size)return;
 if(drag.control.dataset.dailyChoice){readDailyChoices(drag.control);return;}
 var selected=new Set(drag.initial);
 drag.changed.forEach(id=>{if(drag.checked)selected.add(id);else selected.delete(id);});
 if(drag.control.dataset.selectorBox)setAnswer(drag.control.dataset.selectorBox,Array.from(selected));
 else updateCockpitQuestions(drag.control.closest('#cockpit-form'),null,selected);
}

document.addEventListener('pointerdown',function(e){
 if(e.pointerType!=='mouse'||!e.isPrimary||e.button!==0)return;
 finishCockpitDrag(false);
 cockpitDragClick=null;
 var control=e.target.closest('[data-daily-choice],.cockpit-report-groups,'+cockpitDragScopes);
 if(!control||!cockpitDragAvailable(control)||(!control.dataset.dailyChoice&&!control.closest('#cockpit-form')))return;
 var option=cockpitDragOption(control,e.target);
 if(!option)return;
 var scope=control.dataset.selectorBox, question=scope&&S.plan?.questions.find(q=>q.id===scope);
 if(scope&&!question)return;
 var selected=new Set(control.dataset.dailyChoice?chartFilter.draft[control.dataset.dailyChoice]
   :scope?(S.answers[scope]||question.options.map(o=>o.id)):(S.answers.report_questions||[]));
 cockpitDrag={control,pointer:e.pointerId,x:e.clientX,y:e.clientY,initial:selected,
   checked:!selected.has(option.dataset.value??option.value),start:option,changed:new Map(),active:false,frame:0};
},true);

document.addEventListener('pointermove',function(e){
 var drag=cockpitDrag;
 if(!drag||e.pointerId!==drag.pointer)return;
 if(e.buttons!==1||!cockpitDragAvailable(drag.control)||!drag.control.isConnected){finishCockpitDrag(false);return;}
 if(!drag.active){
   if(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)<5)return;
   if(!cockpitDragOption(drag.control,drag.start)){finishCockpitDrag(false);return;}
   drag.active=true;
   cockpitDragClick=drag.pointer;
   drag.control.setPointerCapture(drag.pointer);
   var id=drag.start.dataset.value??drag.start.value;
   drag.changed.set(drag.start,id);
   paintCockpitDragOption(drag.start,drag.checked);
   drag.frame=requestAnimationFrame(()=>scrollCockpitDrag(drag));
 }
 e.preventDefault();
 moveCockpitDrag(drag,e.clientX,e.clientY);
},true);

document.addEventListener('pointerup',function(e){
 var drag=cockpitDrag;
 if(!drag||e.pointerId!==drag.pointer)return;
 var commit=drag.active&&e.button===0;
 if(commit&&cockpitDragAvailable(drag.control)&&drag.control.isConnected)moveCockpitDrag(drag,e.clientX,e.clientY);
 finishCockpitDrag(commit);
},true);
document.addEventListener('pointercancel',e=>{if(e.pointerId===cockpitDrag?.pointer)finishCockpitDrag(false);},true);
document.addEventListener('lostpointercapture',e=>{
 if(e.target===cockpitDrag?.control&&e.pointerId===cockpitDrag.pointer)finishCockpitDrag(false);
},true);
window.addEventListener('blur',()=>finishCockpitDrag(false));
document.addEventListener('selectstart',e=>{if(cockpitDrag)e.preventDefault();});
document.addEventListener('keydown',function(e){
 if(!cockpitDrag)return;
 if(e.key==='Escape'){
   cockpitDragClick=cockpitDrag.pointer;
   e.preventDefault();
   e.stopImmediatePropagation();
 }
 finishCockpitDrag(false);
},true);
document.addEventListener('click',function(e){
 if(cockpitDragClick===null||!e.detail||(e.pointerType&&e.pointerType!=='mouse'))return;
 if(e.pointerId!==undefined&&e.pointerId!==cockpitDragClick)return;
 cockpitDragClick=null;
 e.preventDefault();
 e.stopImmediatePropagation();
},true);

function cockpitReadinessMessage(targetsReady,stale){
 if(stale)return 'The date format or time zone changed. Add the files again to read them with the new setting.';
 if(S.mappingIssues)return 'Review the setup error in section 1.';
 if(!S.plan)return 'Preparing analysis setup.';
 if(!targetsReady){
   var a=S.analysisSetup;
   if(a&&a.metric_id!=='aht'&&!scoringValid(a.scoring))return 'Complete the scoring in section 1.';
   if(a&&dirRequires(a.direction).includes('lower_specification_limit'))return 'Set both specification limits in section 1.';
   return 'Set a target in section 1.';
 }
 var missing=S.plan.missing||[];
 if(missing.includes('scope_period'))return 'Choose a valid date range in section 3.';
 if(missing.includes('scope_lines_of_business'))return 'Select at least one Line of Business in section 3.';
 if(missing.includes('scope_contact_types'))return 'Select at least one contact driver in section 3.';
 return 'Complete the required choices above.';
}
function gCockpit(){
 if(!S.upload||!S.upload.ok)return '<h1>Analysis Cockpit</h1><button type="button" class="btn" data-go="data">Choose your data</button>';
 var h='<form class="g-cockpit-panel" id="cockpit-form" aria-labelledby="g-ck-h"><div class="g-cockpit-header"><h1 id="g-ck-h" tabindex="-1">Analysis Cockpit</h1><p class="muted">Choose what to review, set any requirements, then run your analysis.</p></div>'+cockpitReviewHtml()+'<div class="cockpit-surface"><nav class="cockpit-jumps" aria-label="Analysis sections">'+[['cockpit-metric','1. Metric &amp; target'],['cockpit-questions','2. Questions'],['cockpit-scope','3. Dates &amp; groups']].map(v=>'<button type="button" class="selector-utility" data-cockpit-jump="'+v[0]+'"'+((S.cockpitJump||'cockpit-metric')===v[0]?' aria-current="true"':'')+'>'+v[1]+'</button>').join('')+'</nav><section class="cockpit-section" id="cockpit-metric"><div class="cockpit-section-title"><h2 id="cockpit-metric-h" tabindex="-1">1. Metric and target</h2></div><div class="cockpit-metric-grid">'+selectorBox('metric','Metric for analysis',metricOptions(),[metricId()],true)+'</div><div class="cockpit-requirements" id="cockpit-targets"><h3>Target and specification limits</h3>'+targetMappingHtml()+(S.mappingIssues?'<div class="notice" role="alert" id="cockpit-errors" tabindex="-1">'+esc(S.mappingIssues)+'</div>':'')+'</div>'+constraintCard()+'</section><section class="cockpit-section cockpit-questions" id="cockpit-questions"><div class="cockpit-section-title"><h2 id="cockpit-questions-h" tabindex="-1">2. Questions</h2></div>'+(S.plan?cockpitReportQuestions()+phaseQs('before_upload').filter(q=>q.id!=='goal').map(qHtml).join(''):'<p role="status">Preparing analysis setup.</p>')+'</section><section class="cockpit-section" id="cockpit-scope"><div class="cockpit-section-title"><h2 id="cockpit-scope-h" tabindex="-1">3. Dates, Lines of Business and contact drivers</h2></div>';
 if(S.plan){var scope=phaseQs('after_upload');h+=dataConfigNotices(S.plan)+scope.filter(q=>q.id==='scope_period').map(qHtml).join('')+'<div class="cockpit-group-grid">'+scope.filter(q=>q.id!=='scope_period').sort((a,b)=>['scope_lines_of_business','scope_contact_types'].indexOf(a.id)-['scope_lines_of_business','scope_contact_types'].indexOf(b.id)).map(qHtml).join('')+'</div>';}
 var tReady=targetReady(),stale=datesStale(),ready=!!(S.plan&&S.plan.complete&&tReady&&!stale&&!S.mappingIssues&&S.plan.configuration_status&&S.plan.configuration_status.applied),busy=S.analysisBusy||S.updateBusy;
 var missing=S.plan?.missing||[],correction=stale?'':(S.mappingIssues||S.plan&&!tReady)?'cockpit-metric':missing.some(id=>['scope_period','scope_lines_of_business','scope_contact_types'].includes(id))?'cockpit-scope':'';
 var readiness=esc(cockpitReadinessMessage(tReady,stale));
 if(correction)readiness='<button type="button" class="selector-utility" data-cockpit-jump="'+correction+'">'+readiness+'</button>';
 h+='</section></div><footer class="cockpit-actionbar"><div><button type="button" class="btn secondary" id="g-ck-cancel2">Back to Data Workspace</button>'+(S.updSnap?' <button type="button" class="btn secondary" id="g-upd-cancel">Cancel changes</button>':'')+'</div><div class="actions">'+(S.analysisBusy?'<span role="status"><span class="analysis-spinner" aria-hidden="true"></span>Analysing your data…</span>':!ready?'<span class="muted" role="status" id="cockpit-readiness">'+readiness+'</span>':'')+'<button type="button" class="btn" id="analyze"'+(!ready&&!S.analysisBusy?' aria-describedby="cockpit-readiness"':'')+(!ready||busy?' disabled':'')+'>Perform analysis &rarr;</button></div>'+(S.failed?'<div class="notice" role="alert">'+esc(S.failed)+'</div>':'')+'</footer></form>';
 return busy?h.replace(/<(input|select|button)\b/g,'<$1 disabled'):h;
}
function cockpitGeometry(){var form=document.getElementById('cockpit-form');if(!form)return;var scale=document.documentElement.getBoundingClientRect().width/document.documentElement.offsetWidth||1;form.style.setProperty('--cockpit-header-clearance',document.getElementById('topbar').getBoundingClientRect().height/scale+'px');form.style.setProperty('--cockpit-footer-clearance',form.querySelector('.cockpit-actionbar').getBoundingClientRect().height/scale+'px');form.style.setProperty('--cockpit-jump-clearance',form.querySelector('.cockpit-jumps').getBoundingClientRect().height/scale+'px');}
document.addEventListener('submit',function(e){if(e.target.id==='cockpit-form')e.preventDefault();});
document.addEventListener('click',function(e){var t=e.target.closest('[data-cockpit-jump]');if(!t||t.disabled)return;var form=document.getElementById('cockpit-form'),el=document.getElementById(t.dataset.cockpitJump+'-h');if(!form||!el)return;S.cockpitJump=t.dataset.cockpitJump;form.querySelectorAll('.cockpit-jumps button').forEach(button=>{if(button.dataset.cockpitJump===S.cockpitJump)button.setAttribute('aria-current','true');else button.removeAttribute('aria-current');});var scale=document.documentElement.getBoundingClientRect().width/document.documentElement.offsetWidth||1,offset=document.getElementById('topbar').getBoundingClientRect().height+form.querySelector('.cockpit-jumps').getBoundingClientRect().height+16;el.style.scrollMarginTop=offset/scale+'px';el.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});el.focus({preventScroll:true});});
document.addEventListener('focusin',function(e){if(!S.cockpit||S.modal)return;var form=document.getElementById('cockpit-form'),el=e.target;if(!form||!form.contains(el)||el.closest('.cockpit-actionbar,.cockpit-jumps,.g-cockpit-header,.workspace-setup')||el.hasAttribute('data-cockpit-jump')||el.tagName==='H2')return;var r=el.getBoundingClientRect(),top=document.getElementById('topbar').getBoundingClientRect().bottom+form.querySelector('.cockpit-jumps').getBoundingClientRect().height+10,bottom=form.querySelector('.cockpit-actionbar').getBoundingClientRect().top-12;if(r.top<top)window.scrollBy(0,r.top-top);else if(r.bottom>bottom)window.scrollBy(0,r.bottom-bottom);});
window.addEventListener('resize',cockpitGeometry);
var G_DESC={contact:"One row for every handled contact, with its time and handling seconds. Supports account, Line of Business, agent and day results.",agent_day:"One row for each agent on each working day, with handled contacts and total handling seconds. Supports account, Line of Business and day results."};
function sourceColumnsHtml(u,expanded){if(!u||!Array.isArray(u.source_columns))return '<p class="muted">Column information is unavailable.</p>';var list=u.source_columns,n=u.source_column_count,show=expanded?list:list.slice(0,4);return '<p class="dataset-columns">Columns: '+show.map(esc).join(', ')+(n>show.length?' <span class="muted">+ '+(n-show.length)+' more</span>':'')+'</p>'+(u.source_columns_truncated?'<p class="muted">Column names are shortened or limited for display.</p>':'');}
function gData(){var h='<div class="g-workspace-wrap"><div class="g-workspace-header"><h1>Data Workspace</h1></div>';
 if(S.configSummary){var c=S.configSummary,p=c.operating_profile||{},detail=profileSummaryHtml(Object.assign({},p,{project_name:undefined}));h+=workspaceReviewHtml('workspace-setup-h','Setup review','<button type="button" class="selector-utility" id="workspace-edit-setup">Edit setup &rarr;</button>',[['Account name',c.account_id],['Project or analysis title',p.project_name],['Operating hours time zone',c.business_timezone],['Date format',dateFormatText(c.date_format)]],detail);}
 h+='<section class="workspace-primary" aria-labelledby="workspace-primary-h"><h2 id="workspace-primary-h">Primary dataset</h2><p class="muted">Choose one of these two layouts.</p>';
 if(S.busy)h+='<p class="notice info" role="status">'+busyLabel('Checking '+(S.uploadingFile||'your file')+'…')+'</p>';
 else if(S.uploadingFile&&(!S.upload||!S.upload.ok)){
   if(S.failed||S.upload)h+='<p class="notice" role="alert"><strong>'+esc(S.uploadingFile)+'</strong> could not be loaded.'+(S.failed?' '+esc(S.failed):'')+'</p>';
   if(S.upload)h+=issuesHtml(S.upload.issues,true);
 }
 h+='<div class="g-grain-cards-grid">'+S.cfg.guides.layouts.map(function(l){var v=dsPrimary(l),u=v.u;return '<section class="g-grain-card dataset-card'+(u?' g-selected':'')+'" aria-labelledby="dataset-'+v.code+'"><div class="dataset-card-header"><span class="g-grain-badge">'+dsNum(v.code)+'</span>'+dsState(v)+'</div><h3 id="dataset-'+v.code+'">'+esc(v.label)+'</h3><p>'+esc(v.desc)+'</p>'+dsFile(v)+(v.busy||v.invalid||v.error?'<p class="dataset-attempt"><strong>'+esc(v.pendingFile||'')+'</strong></p>':'')+'<div class="dataset-card-footer">'+(u?'<button type="button" class="selector-utility" id="workspace-details-'+v.code+'" data-dataset-details="'+v.grain+'">Details / remove</button><button type="button" class="btn secondary" id="workspace-upload-'+v.code+'" data-grain="'+v.grain+'">Replace file</button>':'<button type="button" class="btn secondary" id="workspace-upload-'+v.code+'" data-grain="'+v.grain+'"'+(S.busy?' disabled':'')+'>Upload dataset</button>')+'</div></section>';}).join('')+'</div>';
 if(S.upload&&S.upload.ok){if(S.upload.notices?.length&&S.upload.reconciliation){var accepted=dsPrimary(S.cfg.guides.layouts.find(l=>l.grain===S.upload.grain));h+='<div class="notice info"><strong>File checks</strong><p>'+esc(dsSummary(accepted))+'</p><button type="button" class="selector-utility" id="workspace-review-record-details" data-dataset-details="'+accepted.grain+'">Review record details</button></div>';}if(S.plan)h+=(S.plan.dataset_notices||[]).filter(n=>n.code!=='DATASET-ACCOUNT-DIFFERENT').map(function(n){return '<p class="notice info" role="note">'+esc(n.text)+'</p>';}).join('');}
 h+='</section>'+optionalTierHtml();var primaryOk=S.upload&&S.upload.ok;if(S.updSnap||primaryOk)h+='<footer class="cockpit-actionbar workspace-actionbar"><div>'+(S.config?'<button type="button" class="btn secondary" id="workspace-back-config">Back to configuration</button>':'')+(S.updSnap?' <button type="button" class="btn secondary" id="g-upd-cancel">Cancel changes</button>':'')+'</div><div class="actions">'+(primaryOk?'<button type="button" class="btn" id="g-open-ck">Return to Analysis Cockpit &rarr;</button>':'')+'</div></footer>';return h+'</div>';}
function dsPrimary(l){var u=S.upload&&S.upload.ok&&S.upload.grain===l.grain?S.upload:null,rc=u&&u.reconciliation;
 var attempted=S.uploadingGrain===l.grain;
 return {tier:'primary',grain:l.grain,code:l.grain==='contact'?'D01':'D02',label:l.label,desc:G_DESC[l.grain],template:l.template,columns:l.columns,u:u,ok:!!u,file:u&&u.summary.file,rows:u&&u.summary.rows,ncols:u&&u.source_column_count,source:(u&&u.source_columns)||[],truncated:!!(u&&u.source_columns_truncated),
  counts:rc?{source:rc.source_rows,invalid:rc.quarantined,identical:rc.collapsed_copies,held:rc.held,valid:rc.canonical_valid}:null,busy:attempted&&S.busy,pendingFile:S.uploadingFile,invalid:attempted&&!!(S.upload&&!S.upload.ok),error:attempted&&!u&&S.uploadingFile?S.failed:null,input:'file',drop:'drop',browse:'dataset-replace'};}
function dsOptional(m){var slot=optionalSlot(m.id),u=slot.upload,c=u&&u.counts;
 return {tier:'optional',id:m.id,code:m.id,label:m.label,desc:m.description,template:m.template,columns:m.columns,u:u,ok:!!(u&&u.ok),file:u&&u.summary.file,rows:u&&u.summary.rows,ncols:u&&u.summary.columns,source:(u&&u.source_columns)||[],truncated:false,
  counts:c?{source:c.source,invalid:c.invalid,identical:c.identical_copies,held:c.held_conflicts,valid:c.usable}:null,busy:slot.busy,pendingFile:slot.pendingFile,error:slot.error,input:'optional-file',drop:'optional-drop',browse:'optional-browse'};}
function dsNum(code){return String(code).replace(/^D0*/,'')||String(code);}
function loadedDatasets(){var out=[];
 if(S.upload&&S.upload.ok){var l=S.cfg.guides.layouts.find(function(x){return x.grain===S.upload.grain;});if(l){var p=dsPrimary(l);out.push({code:p.code,label:p.label,file:p.file,rows:p.rows,primary:true});}}
 (S.cfg.guides.optional||[]).forEach(function(m){var v=dsOptional(m);if(v.ok)out.push({code:m.id,label:m.label,file:v.file,rows:v.rows,primary:false});});
 return out.sort(function(a,b){return parseInt(dsNum(a.code),10)-parseInt(dsNum(b.code),10)||String(a.code).localeCompare(String(b.code));});}
function dataSummaryHtml(){var R=xR(),datasets=gReportDatasets(R)||loadedDatasets();
 var rows=datasets.map(function(d){
  var definition=d.primary?S.cfg.guides.layouts.find(function(l){return l.grain===(d.code==='D01'?'contact':'agent_day');}):optionalDefinition(d.code);
  var label=(definition&&definition.label)||d.label||d.code;
  var uses=d.uses?.length?d.uses.join(', '):R?'Loaded. No contribution to the displayed results.':'—';
  return '<tr'+(d.primary?' class="is-primary"':'')+'><td>'+esc(dsNum(d.code))+'</td><td>'+esc(label)+'</td><td>'+esc(d.file)+'</td><td>'+n0(d.rows)+'</td><td>'+esc(uses)+'</td></tr>';
 }).join('');
 return '<p class="muted">Files included in this analysis and how they were used.</p><div class="scroll"><table class="ds-sum"><thead><tr><th>No.</th><th>Dataset</th><th>File</th><th>Source rows</th><th>Used in</th></tr></thead><tbody>'+rows+'</tbody></table></div>';}
function dsSummary(v){return n0(v.rows)+' rows · '+v.ncols+' columns'+(v.counts&&v.counts.invalid?' · '+n0(v.counts.invalid)+' invalid':'')+(v.counts&&v.counts.held?' · '+n0(v.counts.held)+' held':'');}
function dsState(v,showEmpty=false){
 var error=!!(v.error||v.invalid||(v.u&&!v.ok));
 if(!v.busy&&!v.ok&&!error&&!showEmpty)return '';
 var label=v.busy?'Checking file':v.ok?'Loaded':error?'File errors':'Not loaded';
 var state=v.busy?' dataset-file-pending':v.ok?'':error?' dataset-file-error':' dataset-file-pending';
 return '<span class="dataset-file-state'+state+'">'+label+'</span>';
}
function dsFile(v){return v.u?'<div class="dataset-file"><strong>'+esc(v.file)+'</strong><p>'+dsSummary(v)+'</p></div>':'';}
function dsTiles(v,includeZero=false){var c=v.counts;if(!c)return '';
 var T=[['Source records',c.source,''],['Passing checks',c.source-c.invalid,'is-healthy'],['Invalid records',c.invalid,'is-caution'],['Identical copies',c.identical,'is-note'],['Conflicting (held)',c.held,'is-caution'],['Distinct valid',c.valid,'is-healthy']];
 var KEEP={'Source records':1,'Passing checks':1,'Distinct valid':1};return '<ul class="ds-tiles" aria-label="File checks">'+T.filter(function(t){return includeZero||KEEP[t[0]]||t[1]>0;}).map(function(t){return '<li class="ds-tile'+(t[1]===0&&t[0]!=='Source records'?' is-zero':(t[2]?' '+t[2]:''))+'"><span class="ds-tile-label">'+t[0]+'</span><span class="ds-tile-value">'+n0(t[1])+'</span></li>';}).join('')+'</ul>';}
function dsFindings(u){var F=(u&&u.findings||[]).filter(function(f){return f.rows_affected>0;});if(!F.length)return '';
 return '<section class="ds-findings ds-types" aria-label="Findings by type"><h3>Findings by type</h3><ul class="ds-type-list">'+F.map(function(f){return '<li><span>'+esc(f.label)+'</span><span class="ds-type-n">'+n0(f.rows_affected)+(f.rows_affected===1?' row':' rows')+'</span></li>';}).join('')+'</ul><p class="muted">A row can appear under more than one type.</p></section>';}
function dsSchema(v){var names=v.columns.map(function(c){return c.name;}),loaded=!!v.u,have=function(n){return v.source.indexOf(n)>=0;},
  req=v.columns.filter(function(c){return !c.optional;}),opt=v.columns.filter(function(c){return c.optional;}),extra=loaded?v.source.filter(function(n){return names.indexOf(n)<0;}):[],
  matched=req.filter(function(c){return have(c.name);}).length,expanded=!!S.datasetExpanded,shown=expanded?extra:extra.slice(0,6);
 var h='<section class="ds-schema" aria-label="Baseline schema and detected columns"><div class="ds-schema-head"><div><h3>Baseline schema &amp; detected columns</h3><p class="muted">Required columns must be present. Optional columns may be omitted. Additional columns are accepted.</p></div><a class="btn secondary ds-template" href="'+esc(v.template)+'" download>Download CSV template</a></div>';
 h+='<div class="ds-group"><p class="ds-group-label">Required baseline'+(loaded?' ('+matched+' of '+req.length+' matched)':'')+'</p><div class="g-pill-cloud">'+req.map(function(c){return !loaded?'<span class="schema-pill is-req">'+esc(c.name)+'</span>':(have(c.name)?'<span class="schema-pill is-matched">✓ '+esc(c.name)+'</span>':'<span class="schema-pill is-missing">✕ '+esc(c.name)+' (missing)</span>');}).join('')+'</div></div>';
 if(opt.length)h+='<div class="ds-group"><p class="ds-group-label">Optional baseline</p><div class="g-pill-cloud">'+opt.map(function(c){return '<span class="schema-pill '+(loaded&&have(c.name)?'is-present':'is-optional')+'">'+(loaded&&have(c.name)?'✓ ':'')+esc(c.name)+'</span>';}).join('')+'</div></div>';
 if(extra.length)h+='<div class="ds-group"><p class="ds-group-label">Additional columns · loaded</p><div class="g-pill-cloud">'+shown.map(function(n){return '<span class="schema-pill is-extra">+ '+esc(n)+'</span>';}).join('')+(extra.length>6?'<button type="button" class="schema-pill is-more" id="dataset-more" aria-expanded="'+expanded+'">'+(expanded?'Show fewer':'+ '+(extra.length-6)+' more columns')+'</button>':'')+'</div></div>';
 if(v.truncated)h+='<p class="muted">Column names are shortened or limited for display.</p>';
 return h+'<p class="ds-pii" role="note"><strong>PII warning:</strong> include columns with personal information only if needed.</p></section>';}
function dsRemoveBtn(v){return v.tier==='primary'?'<button type="button" class="ds-remove" id="dataset-remove">Remove dataset</button>':'<button type="button" class="ds-remove" id="optional-dialog-remove" data-optional-remove="'+v.id+'">Remove dataset</button>';}
function dsFileInput(v){return '<input class="sr" id="'+v.input+'" type="file" accept=".csv,text/csv"'+(v.tier==='optional'?' tabindex="-1" aria-label="Choose '+esc(v.label)+' CSV"':'')+'>';}
function dsDropzone(v){return '<div class="g-dropzone-container" id="'+v.drop+'"><h3>Drop your CSV here</h3>'+(v.tier==='primary'?'<label class="g-btn-browse-file" for="file">Choose a file</label>':'<button type="button" class="g-btn-browse-file" id="optional-browse"'+(v.busy?' disabled':'')+'>Choose a file</button>')+'</div>';}
function dsDialog(v){var u=v.u,h='';
 if(u){h+='<section class="ds-file-card"><div class="ds-file-top"><div class="ds-file-id"><strong class="ds-filename">'+esc(v.file)+'</strong></div><div class="ds-file-actions"><button type="button" class="ds-replace" id="'+v.browse+'"'+(v.busy?' disabled':'')+'>Replace file</button>'+dsRemoveBtn(v)+'</div></div>'+dsTiles(v)+'</section>'+dsFindings(u);
  if(v.tier==='optional'&&u.diagnostic_count)h+='<section class="ds-findings"><h3>File findings</h3><p class="muted">Showing '+u.diagnostics.length+' of '+n0(u.diagnostic_count)+' findings.'+(u.remaining_examples?' '+n0(u.remaining_examples)+' more are not shown.':'')+'</p><ol class="optional-findings">'+u.diagnostics.map(function(f){return '<li>Record '+n0(f.source_row)+' · '+esc(f.field)+': '+esc(f.message)+'</li>';}).join('')+'</ol></section>';
  if(v.tier==='optional')h+=(u.issues||[]).map(function(i){return '<p class="notice" role="alert">'+esc(i.message)+'</p>';}).join('');}
 else h+=dsDropzone(v);
 h+=dsSchema(v)+dsFileInput(v);
 if(v.busy)h+='<p role="status">'+busyLabel('Adding and checking '+(v.pendingFile||'your file')+'\u2026')+'</p>';
 if(v.error)h+='<p class="notice'+(v.tier==='optional'?' optional-dialog-error':'')+'" role="alert">'+esc(v.error)+'</p>';
 return h;}
function dsHeader(v){return '<div class="g-modal-header-bar ds-header"><div class="ds-header-main"><div class="ds-header-row"><span class="ds-code'+(v.ok?' is-loaded':'')+'">'+esc(dsNum(v.code))+'</span><h3 id="g-modal-h" tabindex="-1">'+esc(v.label)+'</h3>'+dsState(v,true)+'</div><p class="ds-sub">'+esc(v.desc)+'</p></div><button class="g-modal-close-icon" id="g-modal-close" type="button" aria-label="Close dataset details">×</button></div>';}
function dsFooter(v){return '<div class="ds-footer"><button type="button" class="btn" id="dataset-done">Done</button></div>';}
function dsView(tab){return tab==='dataset'?dsPrimary(S.cfg.guides.layouts.find(function(l){return l.grain===(S.grain||'contact');})):dsOptional(optionalDefinition(S.optionalEditing));}
function datasetDialog(){var view=dsView('dataset'),h=dsDialog(view);if(view.invalid)h+=issuesHtml(S.upload.issues,!S.upload.notices?.length);if(view.invalid||view.ok)h+=setAsideHtml();return h;}


/* One optional-slot map; primary S.upload and its result owners stay independent. */
function optionalDefinition(id){return (S.cfg.guides.optional||[]).find(m=>m.id===id);}
function optionalSlot(id){if(!optionalDefinition(id))return null;return S.optionalUploads[id]||(S.optionalUploads[id]={generation:0,upload:null,retired:null,busy:false,error:null,expanded:false});}
function optionalReferences(){var refs={};Object.keys(S.optionalUploads).forEach(id=>{var slot=S.optionalUploads[id],u=slot.upload;if(u&&u.upload_id&&u.restore_token)refs[id]={id:u.upload_id,token:u.restore_token};else if(slot.retired)refs[id]={id:slot.retired.id,token:slot.retired.token,retired:true};});return refs;}
function validOptionalOwner(o){return keysOnly(o,['owner_id','owner_token'])&&typeof o.owner_id==='string'&&/^[0-9a-f]{16}$/.test(o.owner_id)&&typeof o.owner_token==='string'&&/^[A-Za-z0-9_-]{32}$/.test(o.owner_token);}
function validOptionalDraft(d){if(!(d.optionalOwner===null||validOptionalOwner(d.optionalOwner))||!plainObject(d.optionals)||Object.keys(d.optionals).length>7)return false;return Object.keys(d.optionals).every(id=>{var r=d.optionals[id];return !!optionalDefinition(id)&&d.optionalOwner!==null&&keysOnly(r,['id','token','retired'])&&typeof r.id==='string'&&/^[0-9a-f]{16}$/.test(r.id)&&typeof r.token==='string'&&/^[A-Za-z0-9_-]{32}$/.test(r.token)&&(!('retired'in r)||typeof r.retired==='boolean');});}
function optionalCleanup(owner,refs,close){if(!owner)return Promise.resolve(true);return fetch('/api/end-session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({uploads:Object.values(refs||{}).map(r=>({id:r.id,token:r.token})),optional_owner:owner,close_optional_owner:!!close}),keepalive:true}).then(r=>r.status===200||r.status===404).catch(()=>false);}
function clearOptionalInputs(){var owner=S.optionalOwner,refs=optionalReferences();optionalEpoch++;Object.values(S.optionalUploads).forEach(slot=>{slot.generation++;slot.busy=false;});S.optionalUploads={};S.optionalOwner=null;S.optionalOwnerPending=null;optionalCleanup(owner,refs,true);}
function ensureOptionalOwner(){if(S.optionalOwner)return Promise.resolve(S.optionalOwner);if(S.optionalOwnerPending)return S.optionalOwnerPending;var epoch=optionalEpoch,promise=api('/api/upload/session',{}).then(r=>{if(r.status!==200||!validOptionalOwner(r.body))throw Error((r.body&&r.body.message)||'The optional-file session could not be opened. Try again.');if(epoch!==optionalEpoch){optionalCleanup(r.body,{},true);throw Error('This session has ended.');}S.optionalOwner=r.body;return r.body;});S.optionalOwnerPending=promise;promise.then(()=>{if(S.optionalOwnerPending===promise)S.optionalOwnerPending=null;},()=>{if(S.optionalOwnerPending===promise)S.optionalOwnerPending=null;});return promise;}
function expireOptionalOwner(owner){if(!S.optionalOwner||S.optionalOwner.owner_id!==owner.owner_id)return;S.optionalOwner=null;Object.values(S.optionalUploads).forEach(slot=>{slot.upload=null;slot.retired=null;if(!slot.busy)slot.error='That file is no longer available. Upload it again.';});}
function restoreOptionalDraft(d,epoch){if(d.v!==4||epoch!==optionalEpoch)return Promise.resolve();S.optionalOwner=d.optionalOwner;var owner=d.optionalOwner;return Promise.all(Object.entries(d.optionals).map(async function([id,ref]){var slot=optionalSlot(id),generation=++slot.generation;if(ref.retired){slot.retired={id:ref.id,token:ref.token};if(await optionalCleanup(owner,{[id]:ref},false))slot.retired=null;else slot.error='The previous file could not be released. Try again.';return;}try{var r=await api('/api/upload/restore',{upload_id:ref.id,token:ref.token,optional_owner:owner});if(epoch!==optionalEpoch||generation!==slot.generation)return;if(r.status===200&&r.body.role==='optional'&&r.body.module_id===id)slot.upload=r.body;else{slot.error='That file is no longer available. Upload it again.';if(r.body&&r.body.error_code==='OPTIONAL-SESSION')expireOptionalOwner(owner);}}catch(e){if(epoch===optionalEpoch&&generation===slot.generation){slot.retired={id:ref.id,token:ref.token};slot.error='The file could not be restored. Upload it again.';}}}));}
function optionalTierHtml(){
 var modules=S.cfg.guides.optional||[];if(!modules.length)return '';
 return '<section class="optional-tier" aria-labelledby="optional-tier-h"><h2 id="optional-tier-h">Optional datasets</h2><p class="muted">A primary dataset is enough to continue.</p><div class="optional-grid"><div class="optional-row-heading" aria-hidden="true"><span>Dataset</span><span>File</span><span>Status</span><span></span></div>'+modules.map(m=>{
  var v=dsOptional(m),u=v.u;
  return '<section class="optional-card'+(v.ok?' is-loaded':'')+'" data-optional-card="'+m.id+'" aria-labelledby="optional-'+m.id+'"><div class="optional-card-header"><span>'+esc(dsNum(m.id))+'</span><h3 id="optional-'+m.id+'">'+esc(m.label)+'</h3></div>'
   +'<div class="optional-file-meta">'+(u?dsFile(v):'<p class="muted">'+esc(v.pendingFile||m.description)+'</p>')+(v.busy?'<p role="status">'+busyLabel('Checking '+(v.pendingFile||'your file')+'…')+'</p>':'')+(v.error?'<p class="notice" role="alert">'+esc(v.error)+'</p>':'')+'</div>'
   +'<div>'+dsState(v,true)+'</div><div class="dataset-card-footer">'+(u?'<button type="button" class="selector-utility" id="optional-details-'+m.id+'" data-optional-open="'+m.id+'">Details / remove</button>':'')+'<button type="button" class="btn secondary" id="optional-upload-'+m.id+'" data-optional-open="'+m.id+'"'+(v.busy?' disabled':'')+'>'+(u?'Replace file':'Upload dataset')+'</button></div></section>';
 }).join('')+'</div></section>';
}
function optionalDatasetDialog(){return dsDialog(dsView('optional-dataset'));}
function openOptional(id){var slot=optionalSlot(id);if(!slot)return;S.optionalEditing=id;S.datasetExpanded=false;gOpenSettings('optional-dataset');}
function removeOptional(id){var slot=optionalSlot(id);if(!slot)return;slot.generation++;var ref=slot.upload?{id:slot.upload.upload_id,token:slot.upload.restore_token}:slot.retired;slot.upload=null;slot.retired=ref;slot.busy=false;slot.error=null;var owner=S.optionalOwner;render();optionalCleanup(owner,ref?{[id]:ref}:{},false).then(ok=>{if(slot.retired===ref){if(ok)slot.retired=null;else slot.error='The file could not be released. Try again.';saveDraft();render();}});var focus=document.getElementById(S.modal&&S.modal.tab==='optional-dataset'?'optional-browse':'optional-upload-'+id);if(focus)focus.focus({preventScroll:true});}
async function uploadOptional(id,file){
 var slot=optionalSlot(id);if(!slot)return;
 var generation=++slot.generation,epoch=optionalEpoch,owner=null,prior=slot.upload?{id:slot.upload.upload_id,token:slot.upload.restore_token}:slot.retired;
 slot.upload=null;slot.retired=prior;slot.busy=true;slot.pendingFile=file.name;slot.error=null;render();
 try{
  if(prior){if(!await optionalCleanup(S.optionalOwner,{[id]:prior},false))throw Error('The previous file could not be released. Try again.');if(slot.retired===prior)slot.retired=null;}
  if(file.size>S.cfg.guides.optional_max_bytes)throw Error('This optional file exceeds the supported '+Math.round(S.cfg.guides.optional_max_bytes/1048576)+' MiB size.');
  var buffer=await file.arrayBuffer();
  for(var attempt=0;attempt<2;attempt++){
   owner=await ensureOptionalOwner();if(epoch!==optionalEpoch||generation!==slot.generation)return;
   var r=await api('/api/inspect',buffer,{raw:true,headers:Object.assign({'Content-Type':'application/octet-stream','X-Filename':file.name,'X-Dataset-Module':id,'X-Optional-Owner':owner.owner_id,'X-Optional-Token':owner.owner_token},dateHeaders())});
   if(epoch!==optionalEpoch||generation!==slot.generation){if(r.status===200&&r.body.upload_id)optionalCleanup(owner,{[id]:{id:r.body.upload_id,token:r.body.restore_token}},false);return;}
   if(r.status!==200){if(r.body&&r.body.error_code==='OPTIONAL-SESSION'){expireOptionalOwner(owner);if(attempt===0)continue;}throw Error((r.body&&r.body.message)||'The file could not be checked. Try again.');}
   if(r.body.role!=='optional'||r.body.module_id!==id){if(r.body.upload_id)optionalCleanup(owner,{[id]:{id:r.body.upload_id,token:r.body.restore_token}},false);throw Error('The file response did not match this dataset. Try again.');}
   slot.upload=r.body;slot.error=r.body.ok?null:'Review the file findings and replace this file.';break;
  }
 }catch(e){if(epoch===optionalEpoch&&generation===slot.generation)slot.error=e.message||'The connection was lost. Try again.';}
 finally{if(epoch===optionalEpoch&&generation===slot.generation){slot.busy=false;saveDraft();render();}}
}
document.addEventListener('click',function(e){var t=e.target.closest('button');if(!t)return;if(t.dataset.optionalOpen)openOptional(t.dataset.optionalOpen);else if(t.dataset.optionalRemove)removeOptional(t.dataset.optionalRemove);else if(t.id==='optional-browse')document.getElementById('optional-file').click();});
/* No required value, no analysis. What a direction requires comes from the registry: a target (lower, higher), both limits (within bounds), nothing (monitor only). */
function targetReady(){
  if(S.analysisMapping)return ((S.configSummary&&S.configSummary.targets)||[]).some(function(t){return t.target!==null&&t.target!==undefined;});
  var a=S.analysisSetup;if(!a)return false;if(a.metric_id&&a.metric_id!=='aht'&&!scoringValid(a.scoring))return false;var need=dirRequires(a.direction);if(!need.length)return true;
  var has=function(v){return need.every(function(k){var x=v[k];return typeof x==='number'&&isFinite(x)&&(k==='target'?x>0:x>=0);});};
  return a.periods&&a.periods.length?a.periods.every(has):has(a);
}
function targetMappingHtml(){if(!S.config)return '';if(S.analysisMapping)return legacyMappingHtml();if(!S.analysisSetup&&(S.config.metrics||[]).length){S.analysisMapping=(S.config.metrics||[]).filter(function(m){return m.metric_id==="aht";}).map(wJ);return legacyMappingHtml();}if(!S.analysisSetup)S.analysisSetup={metric_id:'aht',direction:'lower_is_better'};var a=S.analysisSetup;
 var field=function(v,k,label,i,type){return '<label class="field">'+label+((type==='date'&&k==='effective_start')||dirRequires(a.direction).indexOf(k)>=0?requiredLabel():'')+'<input type="'+(type||'number')+'"'+((type==='date'&&k==='effective_start')?' required aria-required="true"':(dirRequires(a.direction).indexOf(k)>=0?' aria-required="true"':''))+' step="any" data-setup-field="'+k+'"'+(i===null?'':' data-period="'+i+'"')+' value="'+esc(v[k]===undefined?'':(k==='effective_end'?dayBefore(v[k]):type==='number'||!type?editableDuration(v[k],a.unit):v[k]))+'"></label>';};
 var values=function(v,i){return '<div class="cockpit-thresholds">'+(ruleFor(a.direction)?field(v,'target','Target ('+durationUnitName()+')',i):'')+field(v,'lower_specification_limit','Lower specification limit ('+durationUnitName()+')',i)+field(v,'upper_specification_limit','Upper specification limit ('+durationUnitName()+')',i)+'</div>';};
 var h='<div id="analysis-targets"><label class="field cockpit-direction">Direction'+requiredLabel()+'<select aria-required="true" data-setup-field="direction">'+WDIRS.filter(function(d){return metricInfo().directions.indexOf(d[0])>=0;}).map(function(d){return '<option value="'+d[0]+'"'+(a.direction===d[0]?' selected':'')+'>'+d[1]+'</option>';}).join('')+'</select></label>';
 if(!a.periods||!a.periods.length)h+='<p class="muted">Applies throughout this analysis.</p>'+values(a,null);
 else {h+='<p class="muted">Only these periods have a target or limit comparison. Other dates remain in the observed analysis.</p>';a.periods.forEach(function(p,i){h+='<section class="cockpit-period" aria-labelledby="target-period-'+i+'"><div class="cockpit-period-header"><h3 id="target-period-'+i+'">Target period '+(i+1)+'</h3><button type="button" class="period-remove" data-period-remove="'+i+'" aria-label="Remove target period '+(i+1)+'">Remove period</button></div><div class="cockpit-dates">'+field(p,'effective_start','From',i,'date')+field(p,'effective_end','Until (last included day)',i,'date')+'</div>'+values(p,i)+'</section>';});}
 return h+'<button type="button" class="btn secondary" id="target-period-add">Add target period coverage</button></div>';}
function legacyMappingHtml(){return '<section class="panel"><h2>Imported target periods</h2>'+targetsTable(S.configSummary.targets||[])+'<p class="muted">Imported dates and scopes are retained.</p><button class="btn secondary" id="target-replace">Edit targets for this analysis</button></section>';}
document.addEventListener('change',function(e){var t=e.target,k=t.dataset.setupField;if(!k||S.updateBusy)return;var a=S.analysisSetup,v=t.dataset.period===undefined?a:a.periods[+t.dataset.period];if(t.value==='')delete v[k];else if(k==='effective_end'){if(t.value>='9999-12-31'){S.mappingIssues='Until must be before 9999-12-31.';render();return;}v[k]=nextDay(t.value);}else v[k]=t.type==='number'?(metricKind()!=='seconds'?Number(t.value):Number(t.value)*durationFactor()/durationFactor(a.unit||'seconds')):t.value;if(k==='direction'&&!ruleFor(a.direction)){delete a.target;(a.periods||[]).forEach(function(p){delete p.target;});}S.cockpitChosen=true;invalidateResult();replan();});
document.addEventListener('click',function(e){var t=e.target.closest('button');if(!t||S.updateBusy)return;if(t.id==='target-replace'){S.analysisMapping=null;S.analysisSetup={metric_id:'aht',direction:'lower_is_better'};invalidateResult();replan();}if(t.id==='target-period-add'){var a=S.analysisSetup;a.periods=a.periods||[];a.periods.push({});S.cockpitChosen=true;invalidateResult();replan();}if(t.dataset.periodRemove!==undefined){S.analysisSetup.periods.splice(+t.dataset.periodRemove,1);S.cockpitChosen=true;invalidateResult();replan();}});
/* ---- Insights ---- */
function chartMetricAxis(){return ML()+' ('+durationUnitName(true)+')';}
function chartScopeText(R,type,selection={}){
  var scope=R?.scope||{};
  var parts=[selection.line?'Line of Business '+selection.line:null,
    selection.driver?'Contact driver '+selection.driver:null,selection.agentGroup].filter(Boolean);
  var start=selection.start||scope.start,end=selection.end||scope.end;
  var dates=selection.dates||(start&&end?'From '+start+' Until '+end:'');
  if(dates)parts.push(dates);
  return parts.join(' · ');
}
function chartScopeTitle(R,type,selection={}){
  return '<p class="g-chart-scope">'+esc(chartScopeText(R,type,selection))+'</p>';
}
function presentationScopeText(R,selection={}){
  var changed=selection.start&&selection.end&&(selection.start!==R.scope?.start||selection.end!==R.scope?.end);
  var dates=selection.dates||(changed?'From '+selection.start+' Until '+selection.end:'');
  return [selection.line?'Line of Business '+selection.line:'',selection.driver?'Contact driver '+selection.driver:'',selection.agentGroup,dates].filter(Boolean).join(' · ');
}
function presentationScopeTitle(R,selection){
  var text=presentationScopeText(R,selection);
  return text?'<p class="g-chart-scope">'+esc(text)+'</p>':'';
}
function chartLegend(items){
  return '<ul class="g-chart-legend" aria-label="Chart legend">'+items.map(function(item){
    var [mark,label,glyph]=item;
    return '<li>'+(glyph||(['actual','target'].includes(mark)?insightMark(mark):'<i class="g-legend-mark g-legend-'+mark+'" aria-hidden="true"></i>'))+esc(label)+'</li>';
  }).join("")+'</ul>';
}
function insightMark(role){
  return '<i class="g-insight-'+role+'" aria-hidden="true"></i>';
}
function eventBadge(event,x,left,right,laneEnds){
  var labels=event.labels,id=event.id;
  var shortName=labels[0].length>20?labels[0].slice(0,19)+'…':labels[0];
  var longLabel=id+' '+(labels.length===1?shortName:n0(labels.length)+' events');
  for(var label of [longLabel,id]){
    var width=12+label.length*9,start=Math.max(left,Math.min(x-width/2,right-width));
    var lane=laneEnds.findIndex(function(end){return start>=end;});
    if(lane===-1)continue;
    var y=5+lane*22;
    laneEnds[lane]=start+width+4;
    return {bottom:y+18,html:'<g class="gc-event-badge"><title>'+esc(event.date+' · '+labels.join(' · '))+'</title>'
      +'<rect x="'+start+'" y="'+y+'" width="'+width+'" height="18" rx="4"/><text x="'+(start+width/2)+'" y="'+(y+13)+'" text-anchor="middle">'+esc(label)+'</text></g>'};
  }
  return null;
}
function gLine(R,events=[]){
  var days=(R.by_day||[]).filter(function(d){return d.value!==null;}),t=xHasTarget(R),datedTarget=targetFor(R);
  if(!days.length)return '<p>No daily values are available for the selected dates.</p>';
  var direction=R.analysis_setup?.direction||R.metric?.direction;
  var cue={lower_is_better:["↓","Lower values are favorable"],higher_is_better:["↑","Higher values are favorable"],
    within_bounds:["↕","Values within the applicable range are favorable"]}[direction];
  var cueHtml=cue?'<p class="muted g-trend-direction"><span aria-hidden="true">'+cue[0]+'</span> '+esc(cue[1])+'.</p>':'';
  if(datedTarget&&days.some(function(d){return datedTarget(d.key)!==t;}))t=null;
  if(days.length===1)return cueHtml+'<p>One day has an observed value. '+esc(days[0].key)+' · '+durationNumber(days[0].value,false)+' '+durationUnitSymbol()
    +' ('+n0(days[0].count)+' eligible observations).</p>';
  var W=900,H=events.length?306:270,l=78,r=84,tp=events.length?52:16,b=44,vals=days.map(function(d){return d.value;}).concat(t!==null?[t]:[]);
  var bands=[],assessment=R.target_assessment,firstObserved=days[0].key,lastObserved=days[days.length-1].key;
  if(direction==="within_bounds"&&assessment?.status==="published"){
    assessment.periods.forEach(function(p){
      var spec=p.specification;
      if(!p.effective_start||!Number.isFinite(spec?.lower)||!Number.isFinite(spec?.upper))return;
      var from=p.effective_start>firstObserved?p.effective_start:firstObserved;
      var until=p.effective_end&&p.effective_end<lastObserved?p.effective_end:lastObserved;
      if(from>=until)return;
      bands.push({from:from,until:until,lower:spec.lower,upper:spec.upper});
      vals.push(spec.lower,spec.upper);
    });
  }
  var mn=Math.min.apply(null,vals),mx=Math.max.apply(null,vals),span=Math.max(mx-mn,1),steps=[1,2,5,10,20,25,50,100,200],st=steps[0];
  for(var i=0;i<steps.length;i++){st=steps[i];if(span/st<=5)break;}
  var lo=Math.floor((mn-span*.08)/st)*st,hi=Math.ceil((mx+span*.08)/st)*st;
  var scoring=R.metric?.scoring;
  var scale=scoring?.scoring_type==="scale"?[scoring.scale_start,scoring.scale_end]:metricKind()==="percent"?[0,100]:null;
  if(scale&&Number.isFinite(scale[0])&&Number.isFinite(scale[1])){
    if(mn>=scale[0])lo=Math.max(lo,scale[0]);
    if(mx<=scale[1])hi=Math.min(hi,scale[1]);
  }
  var start=days[0].key,end=days[days.length-1].key,eventDays=new Map();
  events.forEach(function(event){
    if(event.date<start)start=event.date;
    if(event.date>end)end=event.date;
    if(!eventDays.has(event.date))eventDays.set(event.date,{id:event.id,date:event.date,labels:[]});
    eventDays.get(event.date).labels.push(event.details||event.type);
  });
  var firstDay=Date.parse(start),daySpan=Date.parse(end)-firstDay;
  function sx(day){return l+(W-l-r)*(Date.parse(day)-firstDay)/daySpan;}function sy(v){return tp+(H-tp-b)*(hi-v)/(hi-lo);}
  var s='<svg class="g-chart" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Daily '+ml()+' in '+durationUnitName(false)+(t!==null?', with the target line':'')+'"><title>Daily '+ml()+'</title>';
  bands.forEach(function(band){
    s+='<rect class="gc-specification-band" x="'+sx(band.from)+'" y="'+sy(band.upper)+'" width="'+(sx(band.until)-sx(band.from))
      +'" height="'+(sy(band.lower)-sy(band.upper))+'" fill="var(--accent-soft)"/>';
  });
  for(var v=lo;v<=hi+1e-9;v+=st)s+='<line class="gc-grid" x1="'+l+'" x2="'+(W-r)+'" y1="'+sy(v).toFixed(1)+'" y2="'+sy(v).toFixed(1)+'"/><text class="gc-tick" x="'+(l-8)+'" y="'+(sy(v)+4).toFixed(1)+'" text-anchor="end">'+durationNumber(v,true)+'</text>';
  s+='<text class="gc-unit" transform="translate(14 '+((H-b+tp)/2)+') rotate(-90)" text-anchor="middle">'+esc(chartMetricAxis())+'</text>';
  var multipleYears=start.slice(0,4)!==end.slice(0,4);
  var maxLabels=Math.max(2,Math.floor((W-l-r)/(multipleYears?120:96))),step=Math.ceil(days.length/maxLabels);
  days.forEach(function(d,i){if(i%step===0)s+='<text class="gc-tick" x="'+sx(d.key).toFixed(1)+'" y="'+(H-b+20)+'" text-anchor="middle">'+esc(multipleYears?d.key:d.key.slice(5))+'</text>';});
  var badges=[],laneEnds=[l,l];
  eventDays.forEach(function(event){
    var x=sx(event.date),badge=eventBadge(event,x,l,W-r,laneEnds);
    if(badge)badges.push(badge.html);
    s+='<g class="gc-event-marker"><title>'+esc(event.id+' · '+event.date+' · '+event.labels.join(' · '))+'</title>'
      +'<line class="gc-event"'+(eventDays.size>20?' style="opacity:.22"':'')+' x1="'+x+'" x2="'+x+'" y1="'+(badge?badge.bottom:tp)+'" y2="'+(H-b)+'"/><circle class="gc-event-dot" cx="'+x+'" cy="'+tp+'" r="4"/></g>';
  });
  if(t!==null)s+='<line class="gc-target" x1="'+l+'" x2="'+(W-r)+'" y1="'+sy(t).toFixed(1)+'" y2="'+sy(t).toFixed(1)+'"/><text class="gc-tlabel" x="'+(W-r+6)+'" y="'+(sy(t)+4).toFixed(1)+'">Target '+durationNumber(t,true)+' '+durationUnitSymbol()+'</text>';
  s+='<path class="gc-line" d="M'+days.map(function(d){return sx(d.key).toFixed(1)+" "+sy(d.value).toFixed(1);}).join(" L")+'"/>';
  if(days.length<=40)days.forEach(function(d){s+='<circle class="gc-actual" cx="'+sx(d.key).toFixed(1)+'" cy="'+sy(d.value).toFixed(1)+'" r="6"><title>'+esc(d.key)+' · '+durationNumber(d.value,false)+' '+durationUnitSymbol()+'</title></circle>';});
  s+=badges.join("")+'</svg>';
  var legend=[["observed","Observed daily "+ml(),days.length<=40
    ?tracePointKey('<i class="dt-dot g-observed-point-key"></i>','g-observed-trace-key'):null]];
  if(t!==null)legend.push(["target","Target"]);
  if(bands.length)legend.push(["box","Applicable specification range"]);
  if(eventDays.size)legend.push(["event","Calendar event date"]);
  return cueHtml+chartLegend(legend)+s;
}
var OBSERVED_DIMENSIONS={line_of_business:"Line of Business",contact_type:"Contact driver"};
var observedChoices=new WeakMap();
function observedState(R){
  if(!observedChoices.has(R)){
    var questions=R.report_questions||[];
    var people=R.group_comparison?.find(item=>item.id===R.metric?.metric_id)?.groups;
    var distribution=questions.some(id=>id==='team-results'||id==='team-spread')&&people?.team_lead?.length?"team_lead"
      :questions.includes('contact-results')&&R.group_charts?.contact_type?.length?"contact_type":"line_of_business";
    observedChoices.set(R,{distribution,line:"",driver:"",start:R.scope.start,end:R.scope.end,histogram:"overall",events:true,eventType:"",component:"",baselineMovement:R.insights?.component_movement?.selection});
  }
  return observedChoices.get(R);
}
function observedSelect(id,label,options,selected,disabled=false){
  return '<label for="'+id+'">'+esc(label)+' <select id="'+id+'" data-observed-chart'+(disabled?' disabled':'')+'>'+options.map(function(o){
    return '<option value="'+esc(o[0])+'"'+(o[0]===selected?' selected':'')+'>'+esc(o[1])+'</option>';
  }).join("")+'</select></label>';
}
function observedDimensions(R){
  return Object.entries(OBSERVED_DIMENSIONS).filter(function(pair){return (R.group_charts[pair[0]]||[]).length;});
}
function trendFilterFields(R,state){
  var sc=R.scope,groups=R.group_charts||{};
  if(R.metric?.metric_id==="aht"){
    const choices=(key,label,values,format=String)=>'<fieldset class="g-daily-choices"><legend>'+esc(label)+'</legend>'
      +'<div class="g-daily-choice-list" data-daily-choice="'+key+'">'+values.map(value=>
        '<label title="'+esc(format(value))+'"><input type="checkbox" value="'+esc(value)+'"'+(state[key].includes(value)?' checked':'')
        +'><span>'+esc(format(value))+'</span></label>').join('')+'</div></fieldset>';
    const types=dailyEventTypes(dailyEventSourceCurrent(R)?R.calendar_events||[]:[]);
    return chartDateField('g-trend-start','From',state.start,sc.start,sc.end)
      +chartDateField('g-trend-end','Until',state.end,sc.start,sc.end)
      +choices('dailyLines','Lines of Business',sc.lines_of_business)
      +choices('dailyDrivers','Contact drivers',sc.contact_types)
      +(types.length?choices('eventTypes','Event types',types,dailyEventLabel)
        +'<label class="g-daily-marker-toggle"><input type="checkbox" id="g-trend-events"'+(state.events?' checked':'')+'> Show event markers on chart</label>':'');
  }
  var combinations=R.combined_daily;
  function groupSelect(id,dimension,all,selected){
    var options=groups[dimension]||[];
    var other=dimension==="line_of_business"?"contact_type":"line_of_business";
    var otherValue=dimension==="line_of_business"?state.driver:state.line;
    var available=otherValue&&combinations?new Set(combinations.filter(function(g){return g[other]===otherValue;}).map(function(g){return g[dimension];})):null;
    var choices=options.filter(function(g){return !available||available.has(g.key)||g.key===selected;});
    return options.length?observedSelect(id,OBSERVED_DIMENSIONS[dimension],[["",all]].concat(choices.map(function(g){return [g.key,g.key];})),selected):'';
  }
  function dateInput(key,label){
    return '<label for="g-trend-'+key+'">'+label+' <input type="date" id="g-trend-'+key+'" required min="'+esc(sc.start)+'" max="'+esc(sc.end)+'" value="'+esc(state[key])+'"></label>';
  }
  var filters=groupSelect("g-trend-line","line_of_business","All lines of business",state.line)
    +groupSelect("g-trend-driver","contact_type","All contact drivers",state.driver)+dateInput("start","From")+dateInput("end","Until");
  if(R.calendar_events?.length&&(R.metric?.metric_id!=="aht"||dailyEventSourceCurrent(R))){
    filters+='<label for="g-trend-events"><input type="checkbox" id="g-trend-events"'+(state.events?' checked':'')+'> '+(R.metric?.metric_id==="aht"?'Show event markers on chart':'Show calendar events')+'</label>';
    var types=[...new Set(R.calendar_events.map(event=>event.type))].sort();
    filters+=observedSelect("g-trend-event-type","Event type",[["","All event types"]]
      .concat(types.map(type=>[type,type.replace(/_/g," ")])),state.eventType,R.metric?.metric_id!=="aht"&&!state.events);
  }
  return filters;
}
function trendSelection(R,state){
  var groups=R.group_charts||{},view={...R},note='',combinations=R.combined_daily;
  var combined=state.line&&state.driver,selected;
  if(state.line||state.driver){
    var dimension=state.line?"line_of_business":"contact_type",key=state.line||state.driver;
    selected=combined?(combinations||[]).find(function(g){return g.line_of_business===state.line&&g.contact_type===state.driver;})
      :(groups[dimension]||[]).find(function(g){return g.key===key;});
    var assessment=combined?null:((R.group_assessments_by_dimension||{})[dimension]||[]).find(function(a){return a.key===key;})||null;
    view={...view,by_day:selected?selected.by_day:[],target_assessment:assessment,target_value:null,target_kind:null};
    var message=combined?"Targets and limits are assessed separately for each named group."
      :assessment?"Group assessment for the full report period. "+scopedAssessmentText(assessment):"No group target or specification limit applies.";
    note='<p class="muted">'+esc(message)+'</p>';
  }
  view.by_day=(view.by_day||[]).filter(function(d){return state.start<=d.key&&d.key<=state.end;});
  var events=trendEvents(R,state).filter(event=>
    (!state.line||event.lines_of_business.includes(state.line))&&(!state.eventType||event.type===state.eventType));
  return {view,events,note,missing:combined&&!selected,combinations};
}
function trendEvents(R,{start,end}){
  var eventIds=new Map();
  return (R.calendar_events||[]).map(function(event){
    if(!eventIds.has(event.date))eventIds.set(event.date,'E'+(eventIds.size+1));
    return {...event,id:eventIds.get(event.date)};
  }).filter(event=>start<=event.date&&event.date<=end);
}
function dailyTrendTable(view){
  var datedTarget=targetFor(view),rows=view.by_day.map(day=>({day,target:datedTarget?datedTarget(day.key):xHasTarget(view)}));
  var hasTarget=rows.some(row=>Number.isFinite(row.target));
  return '<div class="scroll" tabindex="0" aria-label="Daily results"><table><thead><tr><th scope="col">Business date</th><th scope="col">'+esc(ML())+'</th><th scope="col">'+esc(gCountLabel())+'</th>'
    +(hasTarget?'<th scope="col">Target</th><th scope="col">Gap to target</th>':'')+'</tr></thead><tbody>'
    +rows.map(({day:d,target})=>'<tr><th scope="row">'+esc(d.key)+'</th><td>'+esc(d.value===null?'—':fcValue(d.value))+'</td><td>'+n0(d.count)+'</td>'
      +(hasTarget?'<td>'+(Number.isFinite(target)?esc(fcValue(target)):'—')+'</td><td>'+(Number.isFinite(target)&&Number.isFinite(d.value)?esc(insSignedGap(d.value-target)):'—')+'</td>':'')+'</tr>').join('')+'</tbody></table></div>';
}
function trendWeekComparison(view,state){
  if(state.line||state.driver)return '';
  var weeks=(view.forecast?.history||[]).filter(week=>Number.isFinite(week.value)&&week.start>=state.start
    &&Date.parse(week.start)+6*86400000<=Date.parse(state.end));
  if(weeks.length<2)return '';
  var first=weeks[0],last=weeks.at(-1);
  return 'The first complete week ('+first.start+') averaged '+fcValue(first.value)+' across '+n0(first.count)+' '
    +gCountLabel(view).toLowerCase()+'. The final complete week ('+last.start+') averaged '+fcValue(last.value)
    +' across '+n0(last.count)+'.';
}
function dailyTrendTakeaway(days,details,weekly=''){
  var eligible=days.filter(day=>Number.isFinite(day.value)).sort((a,b)=>a.key.localeCompare(b.key));
  if(!eligible.length)return gSlideTakeaway('No daily '+ml()+' result is available for this selection.',details);
  var first=eligible[0],last=eligible.at(-1);
  if(first===last)return gSlideTakeaway('The only daily result in this selection was '+fcValue(first.value)+' on '+first.key+'.',details);
  var delta=last.value-first.value,factor=durationFactor();
  var from=first.value/factor,to=last.value/factor;
  var precision=durationUnit()==='minutes'||durationUnit()==='hours'?2:1;
  while(precision<5){
    var scale=10**precision;
    if(Math.abs(Math.round(to*scale)-Math.round(from*scale))===Math.round(Math.abs(delta/factor)*scale))break;
    precision++;
  }
  var difference=displayNumber(Math.abs(delta/factor),precision)+' '+(metricKind()==='percent'?'percentage points':durationUnitSymbol());
  var change=delta===0?'was unchanged':(delta>0?'was higher':'was lower')+' by '+difference;
  from=displayNumber(from,precision)+' '+durationUnitSymbol();
  to=displayNumber(to,precision)+' '+durationUnitSymbol();
  return gSlideTakeaway(ML()+' '+change+' on '+last.key+' ('+to+') compared with '+first.key+' ('+from+').',
    '<h4>Facts</h4><p>'+n0(eligible.length)+' business dates had eligible results.</p>'+(weekly?'<p>'+esc(weekly)+'</p>':'')
    +details);
}
function gObservedTrend(R){
  if(R.metric?.metric_id==="aht")return gDailyTrend(R);
  var state=observedState(R),{view,events,note,missing,combinations}=trendSelection(R,state);
  var tableMode=state.trendView==="table";
  var graph=tableMode?dailyTrendTable(view):gLine(view,state.events?events:[]);
  var calendar=R.calendar_events&&state.events?gCalendarEvents(events,state.eventType):'';
  if(missing)graph=combinations
    ?'<p>No eligible observations match this Line of Business and contact driver in the report period.</p>'
    :'<p>Run the analysis again to load the combined trend.</p>';
  var evidence='<button type="button" id="g-trend-evidence-link" class="g-linkbtn" data-chapter="g-trend-evidence">See daily results in Evidence</button>';
  var detailLinks=(gShowsPanel(R,"hourly")&&R.hourly_heatmap?'<button type="button" class="g-linkbtn" data-chapter="g-hourly-evidence">Day and hour grid</button>':'')
    +(Array.isArray(R.report_panels)&&gShowsPanel(R,"volume")?'<button type="button" class="g-linkbtn" data-chapter="g-volume-evidence">Busiest business dates</button>':'');
  var visual=presentationScopeTitle(R,state)
    +reportViewButton("trend",state)
    +'<h4 id="g-observed-trend" data-slide-content-title>Performance over time · '+esc(chartMetricAxis())+'</h4>'
    +'<div class="g-observed-filters">'+reportChartControls("trend",state,false)+'</div>'
    +graph+(calendar?'<div class="g-daily-details">'+calendar+'</div>':'')
    +(detailLinks?'<div class="g-daily-details">'+detailLinks+'</div>':'');
  return '<section id="g-observed-trend-panel" class="g-chart-container-box" aria-labelledby="g-observed-trend">'
    +gSlideResult(dailyTrendTakeaway(view.by_day,note+evidence,trendWeekComparison(view,state)),visual)+'</section>';
}
function trendEvidence(R){
  if(R.metric?.metric_id==="aht")return dailyAhtEvidence(R);
  var state=observedState(R),{view,events,note}=trendSelection(R,state);
  var weekly=trendWeekComparison(view,state);
  return '<h3>Daily performance evidence</h3>'+chartScopeTitle(R,'Daily results',state)
    +'<p>The takeaway compares the first and last eligible dates. The line shows the changes between them.</p>'
    +(weekly?'<p>'+esc(weekly)+'</p>':'')+dailyTrendTable(view)+note+(state.events&&R.calendar_events?gCalendarEvents(events,state.eventType,false):'');
}
const DAILY_EVENT_UNAVAILABLE='The relationship between recorded events and average handle time could not be assessed within the analysis period.';
const DAILY_TREND_UNASSESSED='A consistent trend could not be assessed for this selection.';
const dailyShortDate=new Intl.DateTimeFormat('en-US',{timeZone:'UTC',month:'short',day:'numeric'});
const dailyFullDate=new Intl.DateTimeFormat('en-US',{timeZone:'UTC',month:'short',day:'numeric',year:'numeric'});
const dailyEventLabel=type=>type.replace(/_/g,' ').replace(/^./,letter=>letter.toUpperCase());
const dailyEventDetail=events=>events.map(event=>dailyEventLabel(event.type)+(event.details?' · '+event.details:'')).join(' / ');
const dailyEventTypes=events=>[...new Set(events.map(event=>event.type))].sort();
const dailyAht=value=>durationNumber(value,false)+' '+durationUnitSymbol();
const DAILY_EVENT_COLORS=new Map([['operations','teal'],['systems','violet'],['training','ochre'],['type 2','rose']]);
const lockedDailyEventColor=type=>DAILY_EVENT_COLORS.get(type.toLowerCase().replace(/[_-]+/g,' '));
function dailyEventColor(type){
  const result=xR(), state=observedState(result);
  if(!state.eventColors){
    const types=dailyEventTypes(result.calendar_events||[]);
    const named=new Set(types.map(lockedDailyEventColor));
    const remaining=[...DAILY_EVENT_COLORS.values()].filter(color=>!named.has(color));
    let index=0;
    state.eventColors=new Map(types.map(name=>{
      const color=lockedDailyEventColor(name)||remaining[index++];
      return [name,color?'var(--daily-event-'+color+')':'hsl('+((index*137.5)%360)+' 54% var(--daily-event-lightness))'];
    }));
  }
  return state.eventColors.get(type)||'var(--aegean-700)';
}
function dailyWorkFilters(R,state){
  const lines=state.dailyLines??R.scope.lines_of_business,drivers=state.dailyDrivers??R.scope.contact_types;
  return {lines:lines.length===R.scope.lines_of_business.length?null:lines,
    drivers:drivers.length===R.scope.contact_types.length?null:drivers};
}
function dailyAhtScope(R,state){
  const {start,end}=state,{lines,drivers}=dailyWorkFilters(R,state);
  const pairs=lines||drivers?(R.combined_daily||[]).filter(pair=>
    (!lines||lines.includes(pair.line_of_business))&&(!drivers||drivers.includes(pair.contact_type))
    &&pair.by_day.some(row=>row.count>0)):null;
  return {start,end,pairs,lines_of_business:pairs?[...new Set(pairs.map(pair=>pair.line_of_business))].sort():R.scope.lines_of_business,
    contact_types:pairs?[...new Set(pairs.map(pair=>pair.contact_type))].sort():R.scope.contact_types};
}
function dailyEventSourceCurrent(R){
  const source=R.daily_event_comparison?.source;
  return !observedState(R).eventSourceInvalid&&(!source||source.upload_id===optionalUploadIds().D08);
}
function dailyAhtSelection(R,state){
  const recorded=trendEvents(R,state);
  const scope=dailyAhtScope(R,state),lines=new Set(scope.lines_of_business);
  const events=dailyEventSourceCurrent(R)?recorded.filter(event=>event.lines_of_business.some(line=>lines.has(line))):[];
  const references=R.daily_references;
  const work=dailyWorkFilters(R,state);
  const selected=!scope.pairs?references?.account
    :work.lines?.length===1&&!work.drivers?references?.line_of_business[work.lines[0]]
    :work.drivers?.length===1&&!work.lines?references?.contact_type[work.drivers[0]]:null;
  const refs=(selected?.intervals||[]).filter(ref=>ref.effective_start<=state.end&&(!ref.effective_end||ref.effective_end>state.start))
    .map(ref=>({start:ref.effective_start,end:ref.effective_end,target:ref.target,rule:ref.target_rule,
      lower:ref.lower_specification_limit,upper:ref.upper_specification_limit}));
  const readings=new Map(),days=[];
  const committed=state===observedState(R)&&dailyEventSourceCurrent(R)&&state.eventComparison;
  if(committed){
    for(const rows of Object.values(committed.weekdays))for(const row of rows)readings.set(row.key,row);
  }else if(scope.pairs){
    for(const pair of scope.pairs)for(const row of pair.by_day){
      if(row.key<state.start||row.key>state.end||!row.count)continue;
      const day=readings.get(row.key)||{key:row.key,count:0,total:0};
      day.count+=row.count;
      day.total+=row.total;
      readings.set(row.key,day);
    }
    for(const day of readings.values())day.value=day.total/day.count;
  }else for(const row of R.by_day)readings.set(row.key,row);
  let refIndex=0;
  for(let date=state.start;date<=state.end;date=nextDay(date)){
    while(refs[refIndex]?.end&&refs[refIndex].end<=date)refIndex++;
    const ref=refs[refIndex]?.start<=date?refs[refIndex]:null;
    days.push({...readings.get(date),date,ref,value:readings.get(date)?.value??null});
    if(date===state.end)break;
  }
  const displayEvents=events.filter(event=>!state.eventTypes||state.eventTypes.includes(event.type));
  return {refs,days,observed:days.filter(day=>Number.isFinite(day.value)),events,displayEvents,
    markers:state.events?displayEvents:[],referenceReason:selected?.reason,
    expectsTarget:selected?.intervals.some(ref=>Number.isFinite(ref.target))};
}
function dailyAhtCoverage({days,expectsTarget,referenceReason}){
  if(referenceReason)return '<p class="muted">'+esc(referenceReason)+'</p>';
  if(!expectsTarget)return '';
  const gaps=[];
  let gap=null;
  for(const {date,ref} of days){
    if(Number.isFinite(ref?.target)){gap=null;continue;}
    if(gap)gap[1]=date;
    else{gap=[date,date];gaps.push(gap);}
  }
  return gaps.length?'<p class="g-daily-coverage">Target coverage is incomplete. No target covers '
    +esc(gaps.map(([first,last])=>first===last?first:first+' to '+last).join(', '))
    +'. Add coverage for those dates or use Monitor only.</p>':'';
}
function dailySpecification(ref){
  if(Number.isFinite(ref?.lower)&&Number.isFinite(ref.upper))return durationNumber(ref.lower,false)+'–'+dailyAht(ref.upper);
  if(Number.isFinite(ref?.lower))return 'Lower limit '+dailyAht(ref.lower);
  if(Number.isFinite(ref?.upper))return 'Upper limit '+dailyAht(ref.upper);
  return '—';
}
function dailyEventsTable(result,evidence=false){
  const events=evidence?result.events:result.displayEvents;
  if(!events.length)return '<p>No recorded events match the selected dates and Lines of Business.</p>';
  const readings=new Map(result.days.map(day=>[day.date,day.value]));
  const dated=new Set();
  return '<section '+(evidence?'':'id="g-calendar-events" ')+'aria-label="Recorded account events"><div class="scroll g-event-table g-daily-event-table" role="region" aria-label="Recorded account events" tabindex="0">'
    +'<table><thead><tr>'+['Event ID','Business date','Event type','Event title','Scope','Daily AHT'].map(label=>'<th scope="col">'+label+'</th>').join('')
    +'</tr></thead><tbody>'+events.map(event=>{
      const first=!dated.has(event.date);
      dated.add(event.date);
      return '<tr'+(evidence&&first
      ?' id="g-trend-event-'+esc(event.date)+'" tabindex="-1"':'')+'>'
      +'<th scope="row"><span class="g-event-id">'+esc(event.id)+'</span></th>'
      +[event.date,dailyEventLabel(event.type),event.details||'—',(event.recorded_lines_of_business||event.lines_of_business).join(', '),
        Number.isFinite(readings.get(event.date))?dailyAht(readings.get(event.date)):'No eligible reading']
        .map(value=>'<td>'+esc(value)+'</td>').join('')+'</tr>';
    }).join('')+'</tbody></table></div></section>';
}
function dailyAhtEvidence(R){
  const state=observedState(R), result=dailyAhtSelection(R,state);
  const hasTarget=result.refs.some(ref=>Number.isFinite(ref.target));
  const hasBounds=result.refs.some(ref=>Number.isFinite(ref.lower)||Number.isFinite(ref.upper));
  const unit=durationUnitSymbol();
  const columns=['Business date','Actual ('+unit+')','Eligible contacts',...(hasTarget?['Target ('+unit+')','Gap ('+unit+')']:[]),
    ...(hasBounds?['Specification ('+unit+')']:[])];
  const rows=result.days.map(day=>{
    const target=day.ref?.target, gap=Number.isFinite(target)&&Number.isFinite(day.value)?day.value-target:null;
    const values=[day.value===null?'No reading':durationNumber(day.value,false),n0(day.count||0)];
    if(hasTarget)values.push(durationNumber(target,false),gap===null?'—':gap===0?'On target':insSignedGap(gap));
    if(hasBounds)values.push(dailySpecification(day.ref));
    return '<tr id="g-trend-day-'+day.date+'" tabindex="-1"><th scope="row">'+day.date+'</th>'
      +values.map(value=>'<td>'+esc(value)+'</td>').join('')+'</tr>';
  }).join('');
  return '<h3>Daily trend · Evidence</h3>'+chartAppliedScope(REPORT_CHART_CONTROLS.trend,R)
    +'<p>Daily AHT is eligible handling seconds divided by eligible handled contacts for each business date.</p>'
    +(dailyWorkFilters(R,state).drivers?'<p>Contact drivers filter AHT. Each event retains its recorded Lines of Business.</p>':'')
    +dailyAhtCoverage(result)+'<h4>Daily readings</h4><div class="scroll g-daily-readings" role="region" aria-label="Daily readings" tabindex="0"><table><thead><tr>'
    +columns.map(label=>'<th scope="col">'+esc(label)+'</th>').join('')+'</tr></thead><tbody>'+rows+'</tbody></table></div>'
    +'<h4>Recorded account events</h4>'+dailyEventsTable(result,true)
    +dailyComparisonEvidence(dailyComparison(R))
    +'<h4>Daily trend assessment</h4><p>'+DAILY_TREND_UNASSESSED+'</p>';
}
const dailyComparison=R=>dailyEventSourceCurrent(R)?observedState(R).eventComparison||R.daily_event_comparison:null;
const dailySeconds=value=>(value<0?'−':value>0?'+':'')+Math.abs(value).toFixed(1);
const dailyDateLabel=date=>dailyFullDate.format(new Date(date+'T00:00:00Z'));
const dailyTypeAnchor=index=>'g-trend-event-type-'+index;
const dailyComparisonReason=comparison=>({
  no_matching_events:'No recorded events match the selection.',
  no_weekday_comparison:'No event dates have an eligible same-weekday comparison in this selection.'
})[comparison?.reason]||'Event-log coverage is unknown for this selection.';
function dailyComparisonNarrative(comparison){
  const types=(comparison?.types||[]).filter(type=>type.mean!==null);
  const qualifying=types.filter(type=>type.tier), takeaway=[], next=[];
  const name=type=>dailyEventLabel(type.type);
  const scored=type=>({label:name(type),text:' · '+dailySeconds(type.mean)+' sec'});
  if(qualifying.length>1){
    for(const band of [...comparison.bands].reverse()){
      const group=qualifying.filter(type=>type.tier===band.band);
      if(group.length){
        const subject=group.length===1?'This event type ':'These event types ';
        const wording=group.length===1?band.wording.replace(/^were /,'was ').replace(/^appear /,'appears '):band.wording;
        takeaway.push({text:subject+wording+' with a difference in average handle time.',items:group.map(scored)});
      }
    }
    next.push({text:'Review these events for possible preventive or corrective actions to limit potential impact on performance.',
      items:qualifying.map(type=>({label:name(type)}))});
  }else if(qualifying.length===1){
    const [type]=qualifying, gap=dailySeconds(type.mean)+' seconds';
    const wording=comparison.bands.find(band=>band.band===type.tier).wording;
    takeaway.push(type.tier==='98%'?name(type)+' events may be associated with a difference in average handle time within the analysis period. The observed difference averaged '+gap+'.'
      :name(type)+' events '+wording+' with an average difference of '+gap+' in average handle time within the analysis period.');
    next.push('Review the '+name(type)+' events for possible preventive or corrective actions to limit potential impact on performance.');
  }
  if(!qualifying.length){
    takeaway.push(types.length?'No evaluated event type met the reporting threshold for average handle time within the analysis period.':DAILY_EVENT_UNAVAILABLE);
    if(types.length)next.push('Review the day-to-day process for inconsistencies and potential improvements.');
  }
  const facts=types.length?[{text:'Average handle time gaps from the same-weekday baseline',items:types.map(scored)}]:[];
  return {takeaway,facts,next};
}
function dailyComparisonTable(label,columns,rows){
  return '<div class="scroll" role="region" aria-label="'+esc(label)+'" tabindex="0"><table aria-label="'+esc(label)+'"><thead><tr>'
    +columns.map(name=>'<th scope="col">'+esc(name)+'</th>').join('')+'</tr></thead><tbody>'
    +rows.map(([first,...values])=>'<tr><th scope="row">'+esc(first)+'</th>'+values.map(value=>'<td>'+esc(value)+'</td>').join('')+'</tr>').join('')
    +'</tbody></table></div>';
}
function dailyComparisonEvidence(comparison){
  const heading='<section id="g-trend-comparison-evidence" tabindex="-1"><h4>Event comparison</h4>';
  const source=comparison?.source;
  const span=source?.first_date?'<p>Eligible D08 records for this account span '+dailyDateLabel(source.first_date)+' to '+dailyDateLabel(source.last_date)+'.</p>':'';
  const exclusions=source?.diagnostics?.withheld_rows?'<p>Records withheld for invalid Line of Business flags · '+n0(source.diagnostics.withheld_rows)+'</p>':'';
  if(!comparison?.types.length)return heading+span+exclusions+'<p>'+dailyComparisonReason(comparison)+'</p></section>';
  const rule='<p>Reporting wording uses a 10-second operational anchor and a fixed 95% reference half-width of 3 seconds. The highest cutoff reached applies, including equality, using unrounded values. 95% confidence intervals are unavailable.</p>'
    +dailyComparisonTable('Event Takeaway wording',['Reference band','Entry cutoff (rounded)','Wording'],comparison.bands.map(band=>[band.band,band.cutoff.toFixed(5)+' sec',band.wording]));
  const weekdays=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  const attribution={individual_title:'Individual title',shared_date:'Shared date',title_unavailable:'Title unavailable'};
  const names=events=>[...new Set(events.map(event=>event.details||dailyEventLabel(event.type)))].join(' · ')||'—';
  const recordedNames=Object.fromEntries(Object.entries(comparison.events_by_date).map(([date,events])=>[date,names(events)]));
  const types=comparison.types.map((type,index)=>{
    const {higher,lower,unchanged}=type.direction_counts;
    const heading='<section class="dt-comparison-evidence"><h5 id="'+dailyTypeAnchor(index)+'" tabindex="-1">'+esc(dailyEventLabel(type.type))+'</h5>';
    const gaps=type.gaps.map(gap=>[dailyDateLabel(gap.key),recordedNames[gap.key],gap.value.toFixed(1)+' sec',gap.benchmark.toFixed(1)+' sec',
      dailySeconds(gap.difference)+' sec',n0(gap.count),dailySeconds(gap.hours)+' hr · '+attribution[gap.attribution]]);
    const exposed=new Set([...type.gaps.map(gap=>gap.key),...type.omitted.map(gap=>gap.date)]);
    const references=Object.keys(type.benchmarks).flatMap(weekday=>comparison.weekdays[weekday].filter(ref=>!exposed.has(ref.key)).map(ref=>
      [dailyDateLabel(ref.key),weekdays[weekday],ref.value.toFixed(1)+' sec',n0(ref.count),recordedNames[ref.key]||'—']));
    const titles=type.titles.map(title=>[title.title,n0(title.dates),n0(title.contacts),dailySeconds(title.hours)+' hr']);
    const omitted=type.omitted.map(day=>[dailyDateLabel(day.date),day.reason==='no_eligible_aht'?'No eligible daily AHT.':'No comparison date on this weekday.']);
    const leader=type.leader?'<p>Largest same-direction title gap: '+esc(type.leader.title)+' · '+dailySeconds(type.leader.hours)+' handle hours across '+n0(type.leader.contacts)+' contacts.</p>':'';
    return heading+(gaps.length?'<p>Mean difference '+dailySeconds(type.mean)+' sec · Wording reference: '+(type.tier||'Below the wording cutoff')
      +' · '+higher+' higher · '+lower+' lower · '+unchanged+' unchanged</p>'
      +dailyComparisonTable('Compared event dates',['Event date','Recorded titles','Daily AHT','Weekday benchmark','AHT gap','Contacts','Handle-time gap'],gaps)
      +dailyComparisonTable('Weekday comparison dates',['Comparison date','Weekday','Daily AHT','Contacts','Other recorded events'],references):'<p>No comparable dates.</p>')
      +leader+(titles.length?dailyComparisonTable('Named event totals',['Event title','Dates','Contacts','Net handle-time gap'],titles):'')
      +(omitted.length?dailyComparisonTable('Excluded event dates',['Excluded event date','Reason'],omitted):'')+'</section>';
  }).join('');
  return heading+'<p>Daily AHT is compared with the average for the same weekday on eligible dates without a recorded event of that type. Daily AHT and contact volumes use the applied scope shown above.</p>'
    +span+exclusions+'<div class="dt-comparison-evidence">'+rule+'</div>'+types+'</section>';
}
function dailyComparisonGraphic(comparison,eventTypes){
  const types=(comparison?.types||[]).filter(type=>!eventTypes||eventTypes.includes(type.type)).map(type=>({type}));
  const values=types.flatMap(({type})=>type.gaps.length?[type.mean,...type.gaps.map(gap=>gap.difference)]:[]);
  if(!values.length)return '<p class="dt-empty muted">'+(types.length?'No event dates have an eligible same-weekday comparison in this selection.'
    :eventTypes&&comparison?.types.length?'No recorded events match the selection.':dailyComparisonReason(comparison))+'</p>';
  let low=0, high=0;
  for(const value of values){low=Math.min(low,value);high=Math.max(high,value);}
  low*=1.1;
  high*=1.1;
  if(low===high){low=-1;high=1;}
  const position=value=>100*(value-low)/(high-low), zero=position(0);
  const ticks=[...new Set([low,low/2,0,high/2,high])].filter(value=>value===0||Math.abs(position(value)-zero)>=9);
  const axis='<div class="dt-comparison-axis" aria-hidden="true">'+ticks.map(value=>
    `<span class="dt-axis-tick" data-edge="${value===low?'start':value===high?'end':''}" style="--tick-x:${position(value)}%"><span>${value>0?'+':''}${Number(value.toPrecision(3))}</span></span>`).join('')+'</div>';
  const key=(text,mark)=>'<li class="dt-key">'+text+mark+'</li>';
  const qualification='Meets reporting threshold';
  const legend='<ul class="dt-legend dt-comparison-legend">'+key('Favorable mean gap',arrowKey('favorable',-1))
    +key('Unfavorable mean gap',arrowKey('unfavorable',1))+key('Compared date','<i class="dt-dot" aria-hidden="true"></i>')
    +['favorable','unfavorable'].map(direction=>`<li class="dt-key" data-short-key="${direction}" hidden>${direction==='favorable'?'Favorable':'Unfavorable'} short mean gap<i class="dt-short-key" data-performance="${direction}" aria-hidden="true"></i></li>`).join('')
    +(types.some(({type})=>type.mean===0)?key('No mean gap','<i class="dt-gap-zero" aria-hidden="true"></i>'):'')
    +(types.some(({type})=>type.tier)?key(qualification,'<i class="dt-qualified-key" aria-hidden="true"></i>'):'')+'</ul>';
  const rows=types.map(({type})=>{
    const title=dailyEventLabel(type.type)+' events';
    const label='<div class="dt-comparison-heading" role="heading" aria-level="5"'
      +(type.gaps.length?' tabindex="0"':'')+' aria-label="'+esc(title+(type.tier?' · '+qualification:''))+'">'+esc(title)+'</div>';
    if(!type.gaps.length)return '<div class="dt-comparison-row">'+label+'<p class="dt-comparison-empty">No comparable dates</p></div>';
    const points=new Map();
    for(const gap of type.gaps){
      if(!points.has(gap.difference))points.set(gap.difference,[]);
      points.get(gap.difference).push(dailyDateLabel(gap.key)+' · AHT '+gap.value.toFixed(1)+' sec · Gap vs. weekday benchmark '+dailySeconds(gap.difference)+' sec');
    }
    const dots=[...points].map(([gap,labels])=>`<span class="dt-gap-point" role="img" tabindex="0" style="--gap-x:${position(gap)}%" ${readingDetailAttributes(labels.join('\n'))}><i class="dt-dot" aria-hidden="true"></i></span>`).join('');
    const end=position(type.mean), leftward=type.mean<0;
    const arrow=type.mean===0?'<span class="dt-gap-zero" aria-hidden="true"></span>'
      :`<span class="dt-gap-segment" data-performance="${leftward?'favorable':'unfavorable'}" style="--arrow-start:${Math.min(zero,end)}%;--arrow-length:${Math.abs(end-zero)}%;--arrow-direction:${leftward?-1:1}" aria-hidden="true"><i class="dt-gap-arrow"></i><i class="dt-gap-endpoint"></i></span>`;
    return `<div class="dt-comparison-row" style="--gap-mean:${end}%">${label}<div class="dt-gap-track"${type.tier?' data-qualifies':''} style="--gap-zero:${zero}%"><span class="dt-gap-mean-line" aria-hidden="true"></span>${arrow}${dots}</div><div class="dt-gap-callout"><span class="dt-gap-label">Mean gap ${dailySeconds(type.mean)} sec</span></div>${axis}</div>`;
  }).join('');
  return '<div class="dt-frame dt-comparison-frame">'+legend+rows
    +'<div class="dt-comparison-unit"><span>Lower AHT</span><span>Average handle time difference (seconds)</span><span>Higher AHT</span></div></div>';
}
const dailyEventDot=type=>`<i class="dt-dot dt-event-key" style="--event-color:${dailyEventColor(type)}" aria-hidden="true"></i>`;
const arrowKey=(performance,direction)=>`<i class="dt-gap-arrow" data-performance="${performance}" style="--arrow-direction:${direction}" aria-hidden="true"></i>`;
function dailySpecificationKey(refs){
 const range=refs.some(ref=>Number.isFinite(ref.lower)&&Number.isFinite(ref.upper));
 return '<svg class="dt-spec" viewBox="0 0 20 10" aria-hidden="true">'
  +(range?'<rect class="dt-band" x="0" y="1" width="20" height="8"/>':'')
  +'<path class="dt-spec-line" d="'+(range?'M0 1H20 M0 9H20':'M0 5H20')+'"/></svg>';
}
function dailyChartLegend(r){
 const key=(label,glyph)=>`<li class="dt-key">${esc(label)}${glyph}</li>`;
 const keys=[key('Actual',tracePointKey('<i class="dt-dot dt-actual-key"></i>'))];
 if(r.refs.some(ref=>ref.target!==undefined))keys.push(key('Target','<i class="dt-target" aria-hidden="true"></i>'));
 if(r.refs.some(ref=>Number.isFinite(ref.lower)||Number.isFinite(ref.upper)))keys.push(key('Business specification limits',dailySpecificationKey(r.refs)));
 for(const type of dailyEventTypes(r.markers)){
  keys.push(key(dailyEventLabel(type),tracePointKey(dailyEventDot(type))));
 }
 return `<ul class="dt-legend">${keys.join('')}</ul>`;
}
function tracePointKey(point,style=''){
 return '<span class="g-trace-point-key" aria-hidden="true"><i class="dt-actual-trace-key '+style+'"></i>'+point+'</span>';
}
function placeDailyPlotLabels(labels,left,right){
 const rows=[], counts={above:0,below:0};
 const positioned=labels.map(label=>({...label,center:Math.max(left+label.width/2,Math.min(right-label.width/2,label.x))}))
  .sort((a,b)=>a.center-a.width/2-(b.center-b.width/2)).map(label=>{
   let row=rows.find(candidate=>candidate.edge+6<=label.center-label.width/2);
   if(!row){
    const side=counts.below>counts.above?'above':'below';
    row={side,lane:counts[side]++};
    rows.push(row);
   }
   row.edge=label.center+label.width/2;
   return {...label,side:row.side,lane:row.lane};
  });
 return {counts,positioned};
}
const dailyTargetScaleColor=(hue,weight)=>'color-mix(in srgb,var(--'+hue+'-700) '+weight+'%,var(--surface))';
function businessScaleBands({target,rule,lower,upper},low,high){
 const start=lower??low,end=upper??high,inside=[],tails=[];
 const shade=(from,to,good,weights)=>{
  if(from>=to)return;
  weights.forEach((weight,i)=>inside.push({from:from+(to-from)*i/weights.length,
   to:i===weights.length-1?to:from+(to-from)*(i+1)/weights.length,good,color:dailyTargetScaleColor(good?'emerald':'coral',weight)}));
 };
 if(Number.isFinite(target)){
  const split=Math.max(start,Math.min(end,target)),leftGood=rule==='at_or_below';
  shade(start,split,leftGood,[90,60,30]);
  shade(split,end,!leftGood,[30,60,90]);
 }else if(lower!=null||upper!=null)shade(start,end,true,[60]);
 else inside.push({from:start,to:end,color:'var(--slate-400)'});
 const red=dailyTargetScaleColor('coral',30);
 if(start>low)tails.push({from:low,to:start,color:red});
 if(end<high)tails.push({from:end,to:high,color:red});
 return {start,end,inside,tails};
}
function runReferenceLayers(spans,{id,trace,left,right,top,bottom,low,high,y,width}){
 const defs=[],scales=[],overlays=[],washes=[];
 spans.forEach(({ref,x1,x2},i)=>{
  const gradient=id+'-gradient-'+i,clip=id+'-clip-'+i;
  const {start,end,inside,tails}=businessScaleBands(ref,low,high);
  const bands=[...inside,...tails].sort((a,b)=>b.from-a.from);
  const stops=bands.flatMap(({from,to,color})=>[to,from].map(value=>`<stop offset="${(high-value)/(high-low)}" style="stop-color:${color}"/>`)).join('');
  const upper=y(end),lower=y(start),head=Math.min(15,(lower-upper)/2);
  const arrow=upper===lower?`<path class="dt-spec-point" d="M8.5 ${upper}H27.5" stroke="var(--emerald-700)" stroke-width="2"/>`
   :`<path class="dt-direction-arrow" d="M18 ${upper} L32.5 ${upper+head} H27.5 V${lower-head} H32.5 L18 ${lower} L3.5 ${lower-head} H8.5 V${upper+head} H3.5 Z" fill="url(#${gradient})"/>`;
  const extensions=tails.map(({from,to,color})=>{
   const first=y(from)+(from===end?head:0),last=y(to)-(to===start?head:0);
   return `<path class="dt-spec-tail" d="M18 ${first}V${last}" stroke="${color}" stroke-width="12"/>`;
  }).join('');
  const target=Number.isFinite(ref.target)?`<rect class="dt-target-midpoint" x="0" y="${y(ref.target)-7}" width="36" height="14" rx="4"/><text class="dt-target-scale-label" x="18" y="${y(ref.target)+3}" text-anchor="middle">${esc(dailyAht(ref.target))}</text>`:'';
  defs.push(`<linearGradient id="${gradient}" gradientUnits="userSpaceOnUse" x1="0" x2="0" y1="${top}" y2="${bottom}">${stops}</linearGradient><clipPath id="${clip}"><rect x="${x1}" y="${top-2}" width="${x2-x1}" height="${bottom-top+4}"/></clipPath>`);
  const label=[Number.isFinite(ref.target)?'Target '+dailyAht(ref.target):'',dailySpecification(ref)==='—'?'':'Specification '+dailySpecification(ref)].filter(Boolean).join(' · ');
  scales.push(`<g class="dt-target-scale"${Number.isFinite(ref.target)?` data-target="${ref.target}"`:''} role="img" aria-label="${esc(label)}"${i===spans.length-1?'':' hidden'}>${extensions}${arrow}${target}</g>`);
  washes.push(`<g class="dt-context-wash" aria-hidden="true" hidden><rect x="${left}" y="${top}" width="${Math.max(0,x1-left)}" height="${bottom-top}"/><rect x="${x2}" y="${top}" width="${Math.max(0,right-x2)}" height="${bottom-top}"/></g>`);
  const levels=new Map();
  if(Number.isFinite(ref.lower))levels.set(ref.lower,inside[0]?.color||dailyTargetScaleColor('emerald',60));
  if(Number.isFinite(ref.upper))levels.set(ref.upper,inside.at(-1)?.color||dailyTargetScaleColor('emerald',60));
  if(Number.isFinite(ref.target)&&ref.target>=start&&ref.target<=end)levels.set(ref.target,dailyTargetScaleColor('emerald',30));
  const exact=[...levels].map(([level,color])=>trace(level,color)).join('');
  overlays.push(`<g class="dt-target-trace" style="--trace-width:${width}px" clip-path="url(#${clip})" hidden><use href="#${id}-trace" class="dt-actual" style="--trace-color:url(#${gradient})"/>${exact}</g>`);
 });
 if(spans.length)scales.push(`<g class="dt-target-scale" hidden><text class="dt-target-scale-label" transform="translate(18 ${(top+bottom)/2}) rotate(-90)" text-anchor="middle">No target or limits apply</text></g>`);
 return {defs:defs.join(''),scales:scales.join(''),overlays:overlays.join(''),washes:washes.join('')};
}
function bindRunReference(svg,owner,spans,{left,right,top,bottom,width}){
 const arrows=svg.querySelectorAll('.dt-target-scale');
 const overlays=svg.querySelectorAll('.dt-target-trace');
 const washes=svg.querySelectorAll('.dt-context-wash');
 const targetMarks=svg.querySelectorAll('[data-target-period]');
 let active=null;
 function select(index){
  if(index===active)return;
  active=index;
  const arrowIndex=index??spans.length-1;
  arrows.forEach((arrow,i)=>arrow.toggleAttribute('hidden',i!==(arrowIndex===-1?spans.length:arrowIndex)));
  overlays.forEach((overlay,i)=>overlay.toggleAttribute('hidden',i!==index));
  washes.forEach((wash,i)=>wash.toggleAttribute('hidden',i!==index));
  const hasActiveTarget=index!==null&&index>=0;
  svg.toggleAttribute('data-target-active',hasActiveTarget);
  svg.toggleAttribute('data-reference-inspected',index!==null);
  targetMarks.forEach(mark=>mark.toggleAttribute('data-dimmed',hasActiveTarget&&Number(mark.dataset.targetPeriod)!==index));
 }
 owner.runReferenceListeners?.abort();
 const controller=owner.runReferenceListeners=new AbortController();
 const options={signal:controller.signal};
 owner.addEventListener('pointermove',event=>{
  if(event.pointerType==='touch')return;
  const box=svg.getBoundingClientRect(), scale=width/box.width;
  const px=(event.clientX-box.left)*scale, py=(event.clientY-box.top)*scale;
  select(px>=left&&px<=right&&py>=top&&py<=bottom
   ?spans.findIndex(({x1,x2})=>px>=x1&&(px<x2||px===right&&x2===right)):null);
 },options);
 owner.addEventListener('pointerleave',()=>select(null),options);
 const focused=point=>{if(point.matches('[data-reference-index]:focus-visible'))select(Number(point.dataset.referenceIndex));};
 owner.addEventListener('focusin',event=>focused(event.target),options);
 owner.addEventListener('focusout',event=>{if(event.target.matches('[data-reference-index]'))select(null);},options);
 owner.addEventListener('keydown',event=>{if(event.key==='Escape')select(null);},options);
 owner.resetRunReference=()=>select(null);
 if(owner.contains(document.activeElement))focused(document.activeElement);
}
function runReadingRequirements(value,reference,missing='No target applies'){
 const target=reference?.target,lower=reference?.lower,upper=reference?.upper;
 const gap=Number.isFinite(target)?value-target:null;
 const targetStatus=gap===null?missing:'Target '+dailyAht(target)+' · '+(gap===0?'On target':
  ((reference.rule==='at_or_above'?gap>0:gap<0)?'Meets target':'Misses target')+' · Gap '+insSignedGap(gap));
 if(lower==null&&upper==null)return targetStatus;
 const outside=(lower!=null&&value<lower)||(upper!=null&&value>upper);
 return targetStatus+' · '+(outside?'Outside specification limits':'Within specification limits');
}
function drawDailyAht(plot,r){
 const W=plot.clientWidth;
 if(W<160||plot.dataset.width===String(W))return;
 plot.dataset.width=W;
 const figures=r.observed.map(d=>d.value).concat(r.refs.flatMap(ref=>[ref.lower,ref.upper,ref.target].filter(Number.isFinite)));
 const low=figures.length?Math.max(0,Math.min(...figures)-8):550, high=figures.length?Math.max(...figures)+8:670;
 const scale=10**Math.floor(Math.log10((high-low)/6));
  const tick=[1,2,2.5,5,10].map(n=>n*scale).find(n=>Math.ceil((high-Math.floor(low/n)*n)/n)<=6)||20*scale;
 const lo=Math.floor(low/tick)*tick, hi=lo+6*tick;
 const gutter=r.refs.length?40:0;
 const left=53+gutter, right=W-23, step=(right-left)/r.days.length;
 const x=i=>left+step*(i+.5);
 const spans=r.refs.map(ref=>{
  const offset=date=>Math.round((Date.parse(date)-Date.parse(r.days[0].date))/86400000);
    const x1=left+step*Math.max(0,offset(ref.start)), x2=left+step*Math.min(r.days.length,ref.end?offset(ref.end):r.days.length);
  return {ref,x1,x2};
 });
 const targets=spans.filter(({ref})=>ref.target!==undefined);
 const spec=[];
 for(const range of spans.filter(({ref})=>(Number.isFinite(ref.lower)||Number.isFinite(ref.upper)))){
  const previous=spec.at(-1);
  if(previous&&Math.abs(previous.x2-range.x1)<.01&&previous.ref.lower===range.ref.lower&&previous.ref.upper===range.ref.upper)previous.x2=range.x2;
  else spec.push({...range});
 }
 const eventsByDate=Object.groupBy(r.markers,event=>event.date);
 const eventLabels=Object.values(eventsByDate).map(group=>{
  const event=group[0], index=r.days.findIndex(d=>d.date===event.date);
  return {group,event,reading:r.days[index],x:x(index),width:26};
 });
 const {counts,positioned}=placeDailyPlotLabels([...eventLabels,...targets.map(({ref,x1,x2})=>({ref,x:(x1+x2)/2,width:70}))],left,right);
 const top=16+18*counts.above, bottom=top+204, axisY=bottom+18*counts.below+(counts.below?5:0);
 const y=v=>bottom-(v-lo)*(bottom-top)/(hi-lo);
 const periodIndex=new Map(spans.map(({ref},index)=>[ref,index]));
 const periodAttr=ref=>periodIndex.has(ref)?' data-target-period="'+periodIndex.get(ref)+'"':'';
 const line=(className,x1,x2,y1,y2,ref)=>`<line class="${className}" x1="${x1}" x2="${x2}" y1="${y1}" y2="${y2}"${periodAttr(ref)}/>`;
 const text=(value,x,y,anchor='middle',css='')=>`<text class="${css}" x="${x}" y="${y}" text-anchor="${anchor}">${value}</text>`;
 const rect=(css,x,y,w,h,rx=0)=>`<rect class="${css}" x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}"/>`;
 const mark=(css,kind,date,label,content,style='',refIndex=null)=>`<g class="${css}" role="img" tabindex="0" ${readingDetailAttributes(label)} data-${kind}-date="${date}"${refIndex===null?'':` data-reference-index="${refIndex}"`}${style?' style="'+style+'"':''}>${content}</g>`;
 const grid=Array.from({length:7},(_,i)=>{const v=lo+i*tick,yy=y(v);return line('dt-grid',left,right,yy,yy)+line('dt-axis',left-4,left,yy,yy)+text(chartValue(v,tick),left-8,yy+4,'end');}).join('');
 const fills=spec.filter(({ref})=>Number.isFinite(ref.lower)&&Number.isFinite(ref.upper)).map(({ref,x1,x2})=>rect('dt-band',x1,y(ref.upper),x2-x1,y(ref.lower)-y(ref.upper))).join('');
 const boundaries=spec.flatMap(({ref,x1,x2})=>[ref.upper,ref.lower].filter(Number.isFinite)
    .map(value=>line('dt-spec-line',x1,x2,y(value),y(value)))).join('');
 const targetLines=targets.map(({ref,x1,x2})=>line('dt-ref gc-target',x1,x2,y(ref.target),y(ref.target),ref)).join('');
 let joined=false;
 const trace=r.days.map((d,i)=>{
  if(d.value===null){joined=false;return '';}
  const cmd=joined?'L':'M';joined=true;
  return `${cmd}${x(i).toFixed(1)} ${y(d.value).toFixed(1)}`;
 }).join(' ');
 const pointGradients=[];
 const clamp=(min,value,max)=>Math.min(max,Math.max(min,value));
 const plotScope=plot.closest('.g-trend-focus')?'focus':'slide';
 const scaleId='dt-'+plotScope,traceId=scaleId+'-trace',traceWidth=step<6?2:3;
 const mid=(top+bottom)/2;
 const layers=runReferenceLayers(spans,{id:scaleId,left,right,top,bottom,low:lo,high:hi,y,width:traceWidth,
  trace:(value,color)=>runLevelTrace(r.days,value,color,x,y)});
 const marks=r.days.map((d,i)=>{
  if(d.value===null)return '';
  const reference=' · '+runReadingRequirements(d.value,d.ref);
  const records=eventsByDate[d.date]||[], types=dailyEventTypes(records);
  const readingX=x(i), readingY=y(d.value);
  const hollow=clamp(3,.5*step,10);
  const radius=(types.length?clamp(9,1.6*hollow,16):hollow)/2;
  let fill=types.length===1?dailyEventColor(types[0]):'';
  if(types.length>1){
   const id='dt-event-color-'+plotScope+'-'+d.date;
   const stops=types.map((type,j)=>`<stop offset="${j/types.length}" style="stop-color:${dailyEventColor(type)}"/><stop offset="${(j+1)/types.length}" style="stop-color:${dailyEventColor(type)}"/>`).join('');
   pointGradients.push(`<linearGradient id="${id}">${stops}</linearGradient>`);
   fill='url(#'+id+')';
  }
  const style=fill?' style="fill:'+fill+'"':'';
  const details=records.length?' · '+dailyEventDetail(records):'';
  return mark('dt-point','reading',d.date,dailyFullDate.format(new Date(d.date))+' · Actual '+dailyAht(d.value)+reference+details,
   `<circle class="dt-reading dt-reading-${types.length?'event':'ordinary'}" cx="${readingX}" cy="${readingY}" r="${radius}"${style}${types.length?'':periodAttr(d.ref)}/><circle cx="${readingX}" cy="${readingY}" r="${Math.max(4,Math.min(10,step/2))}" fill="transparent"/>`,'',periodIndex.get(d.ref)??-1);
 }).join('');
 const labelMarks=positioned.map(({group,event,reading,ref,x:anchor,center,width,side,lane})=>{
  const above=side==='above', yy=above?top-18*(lane+1):bottom+3+18*lane;
  const startY=above?yy+15:yy;
  const box=rect(ref?'dt-ref-box':'dt-marker-chip',center-width/2,yy,width,15,4);
  if(ref)return line('dt-target-leader',center,anchor,startY,y(ref.target),ref)+box+text('Target '+durationNumber(ref.target,durationUnit()==='seconds'),center,yy+11,'middle','dt-target-label');
  const value=reading?.value;
  const types=dailyEventTypes(group);
  const label=`${event.id} · ${dailyFullDate.format(new Date(event.date))} · ${dailyEventDetail(group)} · ${value==null?'No eligible reading':'Daily AHT '+dailyAht(value)}`;
  const band=22/types.length;
  const stripes=types.map((type,i)=>`<rect x="${center-11+i*band}" y="${yy+13}" width="${band}" height="2" rx="1" style="fill:${dailyEventColor(type)}"/>`).join('');
  return mark('dt-marker gc-event-marker','event',event.date,label,
   line('',center,anchor,startY,above?top:bottom)+line('',anchor,anchor,above?top:bottom,value==null?(above?bottom:top):y(value))+box+stripes+text(event.id,center,yy+11,'middle','dt-event-label'),
   '--event-color:'+(types.length===1?dailyEventColor(types[0]):'var(--muted)'));
 }).join('');
 const every=Math.max(1,Math.ceil(67/step));
 const labels=r.days.map((d,i)=>{
  const last=i===r.days.length-1;
  return last||(i%every===0&&(r.days.length-1-i)*step>50)?line('dt-date-axis',x(i),x(i),axisY,axisY+4)+text(dailyShortDate.format(new Date(d.date)),x(i),axisY+20,last&&step<40?'end':'middle'):'';
 }).join('');
 plot.innerHTML=`<svg viewBox="0 0 ${W} ${axisY+31}" height="${axisY+31}" role="group" aria-label="Daily average handle time in ${esc(durationUnitName(true))}">
  <defs><path id="${traceId}" d="${trace}"/>${pointGradients.join('')}${layers.defs}</defs>
  ${spans.length?`<rect class="dt-plot-hit" x="${left}" y="${top}" width="${right-left}" height="${bottom-top}" fill="transparent"/>`:''}
  <text class="dt-metric-axis-title" transform="translate(${12+gutter} ${mid}) rotate(-90)" text-anchor="middle">${esc("Average handle time ("+durationUnitName()+")")}</text>
  ${layers.scales}${fills}${layers.washes}${grid}${boundaries}${targetLines}${line('dt-date-axis dt-date-rule',left,right,axisY,axisY)}${labels}
  <use href="#${traceId}" class="dt-actual dt-context-trace" style="--trace-width:${traceWidth}px"/>${layers.overlays}${labelMarks}${marks}</svg>`;
 if(spans.length)bindRunReference(plot.firstElementChild,plot,spans,{left,right,top,bottom,width:W});
}

function runLevelTrace(readings,value,color,x,y){
 const level=y(value);
 const path=readings.flatMap((item,index)=>item.value===value&&readings[index-1]?.value===value
  ?[`M${x(index-1)} ${level}H${x(index)}`]:[]).join(' ');
 return path?`<path class="dt-actual dt-reference-level-trace" style="--trace-color:${color}" d="${path}"/>`:'';
}

function gDailyTrend(R){
  const state=observedState(R), result=dailyAhtSelection(R,state);
  const comparison=dailyComparison(R), narrative=dailyComparisonNarrative(comparison);
  const view=reportViews('trend',state).current[0];
  const title=view==='table'?'Recorded account events':view==='comparison'?'AHT difference by event type'
    :'Daily average handle time · '+durationUnitName();
  const show=result.observed.length||result.markers.length||result.refs.length;
  const body=view==='comparison'?dailyComparisonGraphic(comparison,state.eventTypes)
    :view==='table'?dailyEventsTable(result)
    :'<div class="dt-frame">'+(show?dailyChartLegend(result)+'<div class="dt-plot"></div>'
      :'<p class="dt-empty">No eligible readings in this selection.</p>')+'</div>';
  const visual=reportChartControls('trend',state)+'<h4 class="g-insights-chart-title" id="g-observed-trend">'+esc(title)+'</h4>'+body;
  const list=items=>'<ul>'+items.map(item=>takeawayListItem(item)).join('')+'</ul>';
  const details='<h4>Facts</h4>'+list([...narrative.facts,'Analysis period from '+dailyDateLabel(state.start)+' to '+dailyDateLabel(state.end)+'.'])
    +(narrative.next.length?'<h4>Next steps</h4>'+list(narrative.next):'')
    +'<button type="button" id="g-trend-evidence-link" class="g-linkbtn" data-chapter="g-trend-comparison-evidence">Evidence</button>';
  return '<section id="g-observed-trend-panel" class="g-chart-container-box g-daily-aht" aria-labelledby="g-observed-trend">'
    +gSlideResult(gSlideTakeaway([...narrative.takeaway,DAILY_TREND_UNASSESSED],details),visual,true)+'</section>';
}
function dailyGuidePages(R){
  const state=observedState(R), result=dailyAhtSelection(R,state);
  const types=dailyEventTypes(result.markers);
  const examples=types.length?'<div class="dt-guide-types"><table><thead><tr><th scope="col">Event type</th><th scope="col">Icon</th></tr></thead><tbody>'
    +types.map(type=>'<tr><th scope="row">'+esc(dailyEventLabel(type))+'</th><td>'+dailyEventDot(type)+'</td></tr>').join('')+'</tbody></table></div>'
    :'<p>'+(result.displayEvents.length?'Event markers are hidden for this chart.':'No recorded events match this selection.')+'</p>';
  const direction=(tone,sign,title,meaning)=>'<div class="dt-guide-direction" data-performance="'+tone+'"><strong>'+title+'</strong>'
    +'<div class="dt-guide-arrow-sample">'+arrowKey(tone,sign)+'</div><span>'+meaning+'</span></div>';
  const directions='<div class="dt-guide-directions">'+direction('favorable',-1,'Favorable','Lower AHT')
    +direction('unfavorable',1,'Unfavorable','Higher AHT')+'</div>';
  const limits=result.refs.some(ref=>Number.isFinite(ref.lower)&&Number.isFinite(ref.upper));
  return ['<h4>Events on the daily chart</h4>'
      +'<p>A boxed code <span class="dt-guide-event-code">E1</span> marks an event date. Hover or focus the code for the event name and any eligible AHT reading.</p>'
      +'<p>Filled dots use the event type’s color. A split dot shows that more than one event type shares the date.</p>'+examples
      +'<p>Gaps indicate dates without an eligible reading.</p>'
      +(result.refs.some(ref=>Number.isFinite(ref.target))?'<p class="dt-guide-reference">The amber Target line <i class="dt-target" aria-hidden="true"></i> marks the applicable target. Hover over a target period to see how its readings compare with the target.</p>':'')
      +(limits?'<p class="dt-guide-reference">The green band '+dailySpecificationKey(result.refs)+' spans the business specification limits.</p>'
        :result.refs.some(ref=>Number.isFinite(ref.lower)||Number.isFinite(ref.upper))?'<p class="dt-guide-reference">The dashed line '+dailySpecificationKey(result.refs)+' marks the applicable business specification limit.</p>':''),
    '<h4>Event comparison</h4>'+directions
      +'<p>Each arrow shows how much average AHT differed on dates with the event type compared with the same weekdays without it. Longer arrows show larger gaps. A very short gap appears as a dot at the mean.</p>'
      +'<p>Hover over or focus an event point to see the date and its actual AHT.</p>'];
}
function trendPreview(R,draft){
  var valid=draft.start&&draft.end&&draft.start>=R.scope.start&&draft.end<=R.scope.end&&draft.start<=draft.end;
  if(!valid)return {valid:false,text:R.metric?.metric_id==="aht"?'Choose an ordered date range within the analysis window.'
    :'Choose an ordered date range within the report period.'};
  if(R.metric?.metric_id==="aht"){
    if(!draft.dailyLines.length||!draft.dailyDrivers.length)
      return {valid:false,text:'Select at least one Line of Business and contact driver.'};
    if(dailyAhtScope(R,draft).pairs?.length===0)
      return {valid:false,text:'Choose Lines of Business and contact drivers that occur together.'};
    var result=dailyAhtSelection(R,draft);
    return {valid:true,text:result.observed.length+' of '+result.days.length+' dates have eligible readings · '
      +result.displayEvents.length+' recorded events',html:dailyAhtCoverage(result)};
  }
  var {view,events}=trendSelection(R,draft),days=view.by_day.filter(day=>Number.isFinite(day.value));
  var count=view.by_day.reduce((total,day)=>total+day.count,0);
  var summary=days.length?n0(days.length)+' business '+(days.length===1?'date':'dates')+' with results · '+n0(count)+' '+gCountLabel().toLowerCase()
    :count?'Daily values are unavailable for the selected observations.':'No eligible observations match this selection.';
  return {valid:true,text:summary+(draft.events&&R.calendar_events?' · '+n0(events.length)+' calendar '+(events.length===1?'event':'events'):'')};
}
function trendDraft(R){
  const state=observedState(R);
  const {start,end,events,line,driver,eventType}=state;
  if(R.metric?.metric_id!=="aht")return {start,end,events,line,driver,eventType};
  return {start,end,events,dailyLines:state.dailyLines??R.scope.lines_of_business,
    dailyDrivers:state.dailyDrivers??R.scope.contact_types,eventTypes:state.eventTypes??dailyEventTypes(R.calendar_events||[])};
}
var REPORT_CHART_CONTROLS={
  stability:{id:"g-stability-panel",title:"Stability",view:"stabilityView",render:stabilityPanel,evidence:stabilityEvidence,
    views:R=>[["chart","Individuals"],...(R&&stabilitySelection(R).rangeSignals.length?[["moving-range","Moving Range"]]:[]),
      ["scale","Stability scale"],["out-of-control","Out-of-control points"]],
    scope:stabilityScope,draft:R=>({...stabilityDates(R)}),fields:stabilityFields,preview:stabilityPreview,
    inputs:{"g-stability-start":"stabilityStart","g-stability-end":"stabilityEnd"},refresh:[],
    afterApply:(state,R)=>{if(state.stabilityView==='moving-range'&&!stabilitySelection(R).rangeSignals.length)state.stabilityView='chart';}},
  trend:{id:"g-observed-trend-panel",title:"Daily trend",view:"trendView",render:gObservedTrend,evidence:trendEvidence,
    views:R=>R?.metric?.metric_id==="aht"?[["chart","Chart"],
      ...(dailyAhtSelection(R,observedState(R)).displayEvents.length?[["table","Event table"]]:[]),
      ["comparison","Event comparison"]]:[["chart","Chart"],["table","Table"]],
    scope:R=>{var {start,end,line,driver}=observedState(R);return {start,end,
      ...(R.metric?.metric_id==="aht"?dailyAhtScope(R,observedState(R))
        :{lines_of_business:line?[line]:R.scope.lines_of_business,contact_types:driver?[driver]:R.scope.contact_types})};},
    fields:trendFilterFields,draft:trendDraft,preview:trendPreview,inputs:{"g-trend-line":"line","g-trend-driver":"driver","g-trend-start":"start","g-trend-end":"end","g-trend-events":"events","g-trend-event-type":"eventType"},
    request:(R,draft)=>{
      const run=dailyComparison(R)?.run,current=trendDraft(R);
      if(R.metric?.metric_id!=="aht"||!run||["start","end","dailyLines","dailyDrivers"].every(field=>
        JSON.stringify(current[field])===JSON.stringify(draft[field])))return null;
      const {start,end,dailyLines,dailyDrivers}=draft;
      return {daily_run:run,daily_window:{start,end,lines_of_business:dailyLines,contact_types:dailyDrivers}};
    },
    commit:(R,comparison,draft)=>Object.assign(observedState(R),draft,{eventComparison:comparison}),
    refresh:["line","driver","eventType"],afterApply:(state,R)=>{
      if(R.metric?.metric_id==="aht"&&state.trendView==="table"&&!dailyAhtSelection(R,state).displayEvents.length)state.trendView="chart";
      hourlyTrendChanged(R);
    }},
  box:{id:"g-observed-comparison",title:"Group performance comparison",view:"boxView",render:gBreakdowns,evidence:R=>gReportGroups(R,true),
    fields:boxFilterFields,preview:boxPreview,inputs:{"g-box-measure":"boxMeasure","g-box-dimension":"distribution"},refresh:["boxMeasure"]},
  histogram:{id:"g-observed-histogram",title:"Distribution of agent performance",view:"histogramView",render:gHistogram,evidence:R=>gHistogram(R,true),
    fields:histogramFilterFields,preview:histogramPreview,inputs:{"g-histogram-cohort":"histogram"},refresh:[]},
  hourly:{id:"g-hourly-heatmap",title:"Calendar heatmap",view:"hourlyView",render:gHourlyHeatmap,
    scope:R=>{var {selection,days}=R.hourly_heatmap;return {start:days[0],end:days.at(-1),
      lines_of_business:selection.line?[selection.line]:R.scope.lines_of_business,
      contact_types:selection.driver?[selection.driver]:R.scope.contact_types,group:selection.lead,shift:selection.shift};},
    fields:hourlyFilterFields,preview:hourlyPreview,draft:hourlyDraft,inputs:{"g-hourly-start":"start","g-hourly-lead":"lead","g-hourly-shift":"shift"},refresh:[],
    request:(R,draft)=>({hour_run:R.hourly_heatmap.comparison_key,hour_window:draft}),
    commit:(R,result)=>{R.hourly_heatmap=result;}},
  movement:{id:"g-component-movement",title:"Before and After component movement",view:"movementView",render:componentMovement,
    scope:R=>{var s=R.insights.component_movement.selection;return {periods:[['Before',s.before_start+' to '+s.before_end],
      ['After',s.after_start+' to '+s.after_end]],group:s.group};},
    evidence:R=>componentMovementEvidence(R,R.insights.component_movement),fields:movementFilterFields,preview:movementPreview,
    draft:R=>({...R.insights.component_movement.selection}),sync:syncMovementDates,inputs:{"g-movement-before-start":"before_start","g-movement-before-end":"before_end",
      "g-movement-after-start":"after_start","g-movement-after-end":"after_end","g-movement-group":"group"},refresh:[],
    request:(R,draft)=>({component_run:R.insights.component_movement.comparison_key,component_window:draft}),
    commit:(R,result)=>{R.insights.component_movement=result;},evidenceId:"g-component-movement-evidence"},
  agents:{id:"g-agent-heatmap",title:"Performance by agent and group",view:"agentHeatmapView",render:R=>gAgentHeatmap(R,true),
    fields:agentHeatmapFilterFields,preview:agentHeatmapPreview,inputs:{"g-agent-heatmap-group":"agentHeatmapGroup","g-agent-heatmap-measures":"agentHeatmapMeasures"},
    refresh:[],afterApply:state=>{state.agentHeatmapPage=1;}},
  gaps:{id:"g-factor-segments",title:"Adjusted group comparisons",view:"factorView",render:insSegments,evidence:R=>insSegments(R,true),
    fields:factorFilterFields,preview:factorPreview,inputs:{"g-factor-dimension":"factorDimension"},refresh:[]},
  relationship:{id:"g-metric-relationships-card",title:"Weekly metric relationships",view:"relationshipView",render:metricRelationships},
  cart:{id:"g-cart-profiles",title:"Historical CART performance profiles",view:"cartView",render:cartProfiles},
  projection:{id:"g-projection-panel",title:"Conditional projection",view:"projectionView",render:projectionPanel,
    views:[["chart","Chart"],["forecast","Projected weeks"],["history","Observed history"]]},
  volume:{id:"g-volume-by-date",title:"Busiest business dates",view:"volumeView",render:gReportVolume},
  drivers:{id:"g-driver-impact",title:"Contact driver impact",view:"driversView",render:R=>insContactDriverImpact(R.insights.contact_driver_impact,R)},
  constraints:{id:"g-constraints",title:"Controllable constraints",view:"constraintsView",render:R=>insConstraints(R.insights,R)},
  shortfalls:{id:"g-shortfalls-panel",title:"Component shortfalls",view:"shortfallsView",render:R=>insComponents(R.insights,R)},
  mix:{id:"g-work-mix",title:"Work mix",view:"mixView",render:R=>insMix(R.insights,R)},
  scenario:{id:"g-scenario-panel",title:"Conditional improvement scenario",view:"scenarioView",render:R=>insScenario(R.insights,R)},
  cohorts:{id:"g-cohorts-panel",title:"Ranked agent cohorts",view:"cohortView",render:R=>insCohorts(R.insights,R)},
  components:{id:"g-component-relationships",title:"Weekly component relationships",view:"componentView",render:componentRelationships},
  contact:{id:"g-contact-performance",title:"Contact type volume versus KPI",view:"contactView",render:gContactPerformance},
  requirements:{id:"g-requirements-panel",title:"Account requirements",view:"requirementsView",render:requirementsPanel,
    scope:R=>R.account_requirements.selection,
    evidence:R=>requirementsPanel(R,true),draft:R=>({...R.account_requirements.selection}),
    fields:requirementsFields,preview:requirementsPreview,sync:syncRequirementsDates,
    inputs:{"g-requirements-mode":"mode","g-requirements-start":"start","g-requirements-end":"end"},refresh:["mode"],
    request:(R,draft)=>({requirements_run:R.account_requirements.run,requirements_window:draft}),
    commit:(R,result)=>{R.account_requirements=result;}}
};
function reportViews(key,state){
  var chart=REPORT_CHART_CONTROLS[key],views=typeof chart.views==='function'?chart.views(xR()):chart.views||[["chart","Chart"],["table","Table"]];
  var index=Math.max(0,views.findIndex(view=>view[0]===state[chart.view]));
  return {current:views[index],next:views[(index+1)%views.length]};
}
function reportViewButton(key,state){
  var {current:[,active],next:[,next]}=reportViews(key,state);
  return '<button type="button" class="btn secondary g-compact-chart-control" id="g-'+key+'-view" data-chart-view="'+key+'" aria-label="'+esc('Toggle view. Showing '+active+'. Switch to '+next)+'">Toggle view · '+esc(active)+'</button>';
}
function reportChartControls(key,state,showView=true){
  var chart=REPORT_CHART_CONTROLS[key],[,active]=reportViews(key,state).current;
  var label='Focus mode: '+chart.title+', '+active;
  var icon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/></svg>';
  return '<button type="button" class="btn secondary g-compact-chart-control" id="g-'+key+'-explore" data-chart-explore="'+key+'" aria-haspopup="dialog" aria-expanded="false" aria-controls="g-chart-filter">Explore your data</button>'
    +(showView?reportViewButton(key,state):'')
    +'<button type="button" class="btn secondary g-focus-mode g-compact-chart-control" id="g-'+key+'-expand" data-chart-expand="'+key+'" aria-label="'+esc(label)+'"><span>Focus mode</span>'+icon+'</button>';
}
function chartDialogFields(modal){return modal.chart.fields(modal.result,modal.draft).replaceAll(' data-observed-chart','');}
function chartDialogHtml(modal){
  return {className:'g-settings-modal g-trend-focus',html:
    '<div class="g-modal-body-wrap"><div class="g-modal-header-bar"><h3 id="g-modal-h" tabindex="-1">'+esc(modal.card.querySelector('#g-component-movement-title')?.textContent||modal.chart.title)+'</h3>'
    +'<button type="button" id="g-modal-close" class="btn secondary g-compact-chart-control" aria-label="Close Focus mode">Close</button></div><div class="g-modal-scroll-pane"></div></div>'};
}
var chartFilter=null;
function positionChartPopover(panel,trigger,beside=false){
  var anchor=trigger.getBoundingClientRect(),zoom=panel.currentCSSZoom||1,margin=8;
  if(panel.classList.contains('dt-guide')){
    const bounds=panel.getBoundingClientRect(),right=anchor.right+8;
    panel.style.left=Math.max(12,right+bounds.width<=innerWidth-12?right:anchor.left-bounds.width-8)/zoom+'px';
    panel.style.top=Math.max(12,Math.min(anchor.top,innerHeight-bounds.height-12))/zoom+'px';
    return;
  }
  panel.style.maxWidth=(window.innerWidth-2*margin)/zoom+'px';
  panel.style.maxHeight=(window.innerHeight-2*margin)/zoom+'px';
  var bounds=panel.getBoundingClientRect();
  if(beside){
    var right=anchor.right+margin,left=anchor.left-bounds.width-margin;
    var nextTo=right+bounds.width<=window.innerWidth-margin?right:left>=margin?left:null;
    if(nextTo!==null){
      panel.style.left=nextTo/zoom+'px';
      panel.style.top=Math.max(margin,Math.min(anchor.top,window.innerHeight-bounds.height-margin))/zoom+'px';
      return;
    }
  }
  var anchorBottom=beside?anchor.bottom:Math.max(anchor.bottom,trigger.closest(".g-slide-heading")?.getBoundingClientRect().bottom||0);
  var below=window.innerHeight-anchorBottom-margin*2,above=anchor.top-margin*2;
  var flip=bounds.height>below&&above>below;
  var space=Math.max(0,flip?above:below);
  panel.style.maxHeight=space/zoom+'px';
  panel.style.top=(flip?Math.max(margin,anchor.top-panel.getBoundingClientRect().height-margin):anchorBottom+margin)/zoom+'px';
  panel.style.left=Math.max(margin,Math.min(beside?anchor.right-bounds.width:anchor.left,window.innerWidth-bounds.width-margin))/zoom+'px';
}
function closeChartFilter(focus=false){
  if(!chartFilter)return;
  if(cockpitDrag?.control.dataset.dailyChoice)finishCockpitDrag(false);
  var {panel,trigger}=chartFilter;
  chartFilter=null;
  panel.remove();
  trigger.setAttribute("aria-expanded","false");
  if(focus&&trigger.isConnected)trigger.focus({preventScroll:true});
}
function chartAppliedScope(chart,R){
  var scope=R.scope,selected=chart.scope?.(R)||scope;
  var groups=[['Account',[scope.account]],['Lines of Business',selected.lines_of_business??scope.lines_of_business],
    ['Contact drivers',selected.contact_types??scope.contact_types],['Group',[selected.group]],['Shift',[selected.shift]]];
  var pills=groups.map(([name,values])=>[name,(values||[]).filter(Boolean)]).filter(([,values])=>values.length)
    .map(([name,values])=>'<dt>'+esc(name)+'</dt><dd>'+values.map(value=>'<span class="g-chart-scope-pill">'+esc(value)+'</span>').join(' ')+'</dd>').join('');
  var periods=(selected.periods||[['From',selected.start],['Until',selected.end]]).filter(([,value])=>value)
    .map(([name,value])=>'<div><dt>'+esc(name)+'</dt><dd>'+esc(value)+'</dd></div>').join('');
  var heading=chart.scope?'Applied analysis scope':'Cockpit scope';
  return '<section class="g-chart-applied-scope" aria-label="'+heading+'"><h4>'+heading+'</h4>'
    +(pills?'<dl class="g-chart-scope-groups">'+pills+'</dl>':'')
    +(periods?'<dl class="g-chart-scope-periods">'+periods+'</dl>':'')+'</section>';
}
function chartPeriodFact({start,end}){
  return '<li class="g-chart-period-fact">'+esc('From '+start+' Until '+end)+'</li>';
}
function openChartFilter(trigger,key,chart,result){
  if(chartFilter?.trigger===trigger){closeChartFilter(true);return;}
  closeChartFilter();
  var guide=document.querySelector(".g-guide.is-open");
  if(guide)gSetGuide(guide,false);
  var state=observedState(result),draft=chart.draft?chart.draft(result):Object.fromEntries(Object.values(chart.inputs||{}).map(field=>[field,state[field]]));
  var daily=key==="trend"&&result.metric?.metric_id==="aht";
  var panel=document.createElement("section");
  panel.id="g-chart-filter";
  panel.className="g-chart-popover g-filter-popover";
  panel.setAttribute("popover","manual");
  panel.setAttribute("role","dialog");
  panel.setAttribute("aria-label","Explore your data");
  chartFilter={chart,key,result,draft,panel,trigger};
  var scope=chartAppliedScope(chart,result);
  if(chart.fields&&!chart.request){
    var preview=chart.preview(result,draft);
    var heading=daily
      ?'<div class="g-daily-explore-heading"><h4>Explore your data</h4><button type="button" class="btn secondary" data-close-daily-explore>Close</button></div>':'';
    panel.innerHTML=heading+scope+'<form id="g-trend-filter-form"><div class="g-trend-fields'+(daily?' g-daily-fields':'')+'">'+chartDialogFields(chartFilter)+'</div>'
    +'<aside class="g-trend-preview"><h4>Selection preview</h4><p id="g-trend-preview" role="status">'+esc(preview.text)+'</p>'
    +'<div id="g-trend-preview-detail">'+(preview.html||'')+'</div></aside>'
    +'<div class="g-chart-filter-actions"><button type="button" class="btn secondary" id="g-trend-cancel">Cancel</button>'
      +'<button type="submit" class="btn" id="g-trend-apply"'+(preview.valid?'':' disabled')+'>Apply</button></div></form>';
   }else panel.innerHTML=scope+(chart.request?'<p class="demo-note">This demo uses a fixed sample scope.</p>':'')
    +'<div class="g-chart-filter-actions"><button type="button" class="btn secondary" id="g-trend-cancel">Close</button></div>';
  trigger.after(panel);
  trigger.setAttribute("aria-expanded","true");
  panel.showPopover();
  if(!chart.request)chart.sync?.(chartFilter);
  positionChartPopover(panel,trigger);
  (panel.querySelector("input:not(:disabled),select:not(:disabled)")||panel.querySelector("button")).focus({preventScroll:true});
}
function openChartDialog(trigger){
  var key=trigger.dataset.chartExpand||trigger.dataset.chartExplore,chart=REPORT_CHART_CONTROLS[key];
  var R=xR(),current=S.modal,card=document.getElementById(chart.id);
  if(!R||!card||(current&&current.chartMode!=="focus"))return;
  if(trigger.dataset.chartExplore){openChartFilter(trigger,key,chart,R);return;}
  if(current)return;
  closeChartFilter();
  var guide=document.querySelector(".g-guide.is-open");
  if(guide)gSetGuide(guide,false);
  var placeholder=document.createElement('div');
  placeholder.style.height=card.offsetHeight+'px';
  var toolbar=trigger.closest(".g-slide-toolbar");
  var toolbarPlaceholder;
  if(card.classList.contains('g-daily-aht')){
    placeholder.className='g-daily-focus-origin';
    if(toolbar){
      toolbarPlaceholder=toolbar.cloneNode(true);
      toolbarPlaceholder.inert=true;
      toolbarPlaceholder.setAttribute('aria-hidden','true');
      toolbarPlaceholder.querySelectorAll('[id]').forEach(control=>control.removeAttribute('id'));
      toolbar.before(toolbarPlaceholder);
    }
    gMarkInsightsNav('g-slide-daily');
  }
  card.replaceWith(placeholder);
  S.modal={chartMode:"focus",chart,result:R,card,toolbar,toolbarPlaceholder,placeholder,from:trigger.id,top:window.scrollY};
  retainFocusedTakeaway(S.modal);
  renderModal();setModalBackground();
  sizeChartTables();
  document.getElementById('g-modal-h').focus({preventScroll:true});
}
function closeChartDialog(){
  var modal=S.modal;
  if(!modal?.chartMode)return;
  closeChartFilter();
  var slide=modal.placeholder.closest(".g-question-slide");
  var header=slide?.querySelector(".g-slide-heading");
  if(modal.toolbarPlaceholder?.isConnected)modal.toolbarPlaceholder.replaceWith(modal.toolbar);
  else if(header&&modal.toolbar)header.insertBefore(modal.toolbar,header.querySelector(".g-guide"));
  if(modal.placeholder.isConnected)modal.placeholder.replaceWith(modal.card);
  if(slide)syncSlideSubtitle(slide);
  S.modal=null;
  renderModal();setModalBackground();
  window.scrollTo({top:modal.top,behavior:"instant"});
  sizeChartTables();
  document.getElementById(modal.from)?.focus({preventScroll:true});
}
function refreshChartPreview(modal){
  modal.chart.sync?.(modal);
  var preview=modal.chart.preview(modal.result,modal.draft);
  document.getElementById('g-trend-preview').textContent=preview.text;
  document.getElementById('g-trend-preview-detail').innerHTML=preview.html||'';
  document.getElementById('g-trend-apply').disabled=!preview.valid;
  positionChartPopover(modal.panel,modal.trigger);
}
function readDailyChoices(control){
  var modal=chartFilter;
  if(!modal||modal.pending||!modal.panel.contains(control))return;
  modal.draft[control.dataset.dailyChoice]=[...control.querySelectorAll('input:checked')].map(option=>option.value);
  refreshChartPreview(modal);
}
document.addEventListener("input",function(e){
  var t=e.target,modal=chartFilter;
  if(t.form?.id!=="g-trend-filter-form"||!modal)return;
  var choices=t.closest('[data-daily-choice]');
  if(choices){readDailyChoices(choices);return;}
  var key=modal.chart.inputs[t.id];
  if(!key)return;
  modal.draft[key]=t.type==='checkbox'?t.checked:t.value;
  if(modal.chart.refresh.includes(key)){
    t.form.querySelector(".g-trend-fields").innerHTML=chartDialogFields(modal);
    document.getElementById(t.id)?.focus({preventScroll:true});
  }
  refreshChartPreview(modal);
});
document.addEventListener("submit",async function(e){
  if(e.target.id!=="g-trend-filter-form")return;
  e.preventDefault();
  var modal=chartFilter,R=xR();
  if(!modal||modal.result!==R||modal.pending||!modal.chart.preview(R,modal.draft).valid)return;
  var chart=modal.chart,state=observedState(R);
  var scopedRequest=chart.request?.(R,modal.draft);
  if(scopedRequest){
    var status=document.getElementById('g-trend-preview'),apply=document.getElementById('g-trend-apply');
    if(!state.resultRequest){status.textContent='Run the analysis again to apply this selection.';return;}
    var fields=[...e.target.elements].filter(field=>!field.disabled);
    modal.pending=true;
    fields.forEach(field=>field.disabled=true);
    apply.disabled=true;
    status.innerHTML=busyLabel('Updating results…');
    try{
      var response=await api('/api/result',{...JSON.parse(state.resultRequest),...scopedRequest});
      if(chartFilter!==modal||xR()!==R)return;
      if(response.status!==200){
        if(scopedRequest.daily_window&&response.body.error_code==='DAILY-SOURCE-CHANGED'){
          state.eventSourceInvalid=true;
          closeChartFilter(true);
          if(state.trendView==='table')state.trendView='chart';
          redrawObservedChart(chart.id,chart.render(R));
          updateChartEvidence(modal.key,R);
          return;
        }
        status.textContent=response.body.message||'The selection could not be applied.';
        return;
      }
      if(scopedRequest.daily_window&&!dailyEventSourceCurrent(R))return;
      chart.commit(R,response.body,modal.draft);
    }catch(error){
      if(chartFilter===modal)status.textContent='The selection could not be applied. Try again.';
      return;
    }finally{
      modal.pending=false;
      if(chartFilter===modal){fields.forEach(field=>field.disabled=false);apply.disabled=false;}
    }
  }else Object.assign(state,modal.draft);
  closeChartFilter(true);
  chart.afterApply?.(state,R);
  redrawObservedChart(chart.id,chart.render(R));
  updateChartEvidence(modal.key,R);
});
function updateChartEvidence(key,R){
  var chart=REPORT_CHART_CONTROLS[key],evidence=document.getElementById(chart.evidenceId||"g-"+key+"-evidence");
  if(evidence&&chart.evidence){
    if(chart.evidenceId)evidence.outerHTML=chart.evidence(R);
    else evidence.innerHTML=chart.evidence(R);
  }
}
function gCalendarEvents(events,eventType,identify=true){
  if(!events.length)return '<p class="muted">No '+(eventType?'events of this type':'calendar events')+' match the selected dates and Lines of Business.</p>';
  return '<section'+(identify?' id="g-calendar-events" aria-labelledby="g-calendar-events-title"':' aria-label="Account events"')+'><h4'+(identify?' id="g-calendar-events-title"':'')+'>Account events ('+n0(events.length)+')</h4>'
    +'<div class="scroll g-event-table" tabindex="0" aria-label="Account event records"><table><thead><tr><th scope="col">Event ID</th><th scope="col">Business date</th><th scope="col">Account event</th><th scope="col">Scope</th></tr></thead><tbody>'
    +events.map(function(event){
      return '<tr><th scope="row"><span class="g-event-id">'+esc(event.id)+'</span></th><td>'+esc(event.date)+'</td><td>'+esc(event.type.replace(/_/g," "))+(event.details?' · '+esc(event.details):'')+'</td><td>'+esc(event.lines_of_business.join(", "))+'</td></tr>';
    }).join("")+'</tbody></table></div></section>';
}
function heatmapColors(R,maximum){
  var direction=R.analysis_setup?.direction||R.metric.direction,scoring=R.metric.scoring;
  var assessment=R.target_assessment;
  var spec=assessment?.status==='published'&&assessment.overall?.classified?assessment.overall.specification:null;
  if(direction==='within_bounds'){
    if(!Number.isFinite(spec?.lower)||!Number.isFinite(spec?.upper))return null;
    return {score:value=>+(spec.lower<=value&&value<=spec.upper),label:'Red outside the report range. Green from '+fcValue(spec.lower)+' to '+fcValue(spec.upper)+'.'};
  }
  var red,green,lower=direction==='lower_is_better';
  if(direction==='monitor_only'){red=0;green=maximum;}
  else if(metricKind()==='percent'){red=lower?100:0;green=lower?0:100;}
  else if(scoring?.scoring_type==='scale'){red=lower?scoring.scale_end:scoring.scale_start;green=scoring.cutoff;}
  else{red=lower?spec?.upper:spec?.lower;green=xHasTarget(R);}
  if(!Number.isFinite(red)||!Number.isFinite(green)||(direction==='monitor_only'?green<=red:lower?green>=red:green<=red))return null;
  return {score:value=>Math.max(0,Math.min(1,(value-red)/(green-red))),
    label:(direction==='monitor_only'?'Magnitude in the source dataset. ':'Report color references. ')
      +'Red at '+fcValue(red)+'. Green at '+fcValue(green)+'.'};
}
function heatmapTint(colors,value){
  if(!colors)return '';
  var amount=Math.round(colors.score(value)*100);
  return ' style="--heat-color:color-mix(in srgb,color-mix(in srgb,var(--emerald-700) '+amount+'%,var(--coral-700)) 36%,var(--surface))"';
}
function hourlyColors(R,map){
  var configured=heatmapColors(R,map.maximum);
  if(configured)return configured;
  var values=map.cells.map(cell=>cell.value).filter(Number.isFinite);
  if(!values.length)return null;
  var min=Math.min(...values),max=Math.max(...values);
  return {score:value=>min===max?0.5:(value-min)/(max-min),
    neutral:true,label:'Darker blue marks higher observed values, from '+fcValue(min)+' to '+fcValue(max)+'.'};
}
function hourlyDraft(R){
  var applied=R.hourly_heatmap.selection,state=hourlyTrendScope(R);
  if(!state)return {...applied};
  var start=applied.start<state.start||applied.start>state.end?state.start:applied.start;
  return {start,end:state.end,line:state.line,driver:state.driver,lead:applied.lead,shift:applied.shift};
}
function hourlyTrendScope(R){
  const state=observedState(R);
  if(R.metric?.metric_id!=="aht")return state;
  const {lines,drivers}=dailyWorkFilters(R,state);
  if(lines?.length>1||drivers?.length>1)return null;
  return {start:state.start,end:state.end,line:lines?.[0]||'',driver:drivers?.[0]||''};
}
function chartDateField(id,label,value,min,max){
  return '<label for="'+id+'">'+label+'<input type="date" id="'+id+'" value="'+esc(value)+'" min="'+esc(min)+'" max="'+esc(max)+'" required></label>';
}
function hourlyFilterFields(R,draft){
  var map=R.hourly_heatmap,state=hourlyTrendScope(R)||map.selection;
  function choice(key,label,values){
    return values.length?observedSelect('g-hourly-'+key,label,[['','All']].concat(values.map(value=>[value,value])),draft[key]):'';
  }
  return chartDateField('g-hourly-start','First date',draft.start,state.start,state.end)
    +choice('lead','Agent group by team lead',map.leads)+choice('shift','Configured shift window',map.shifts);
}
function hourlyPreview(R,draft){
  var state=hourlyTrendScope(R)||R.hourly_heatmap.selection;
  if(!draft.start||draft.start<state.start||draft.start>state.end)return {valid:false,text:'Choose a first date within the applicable heatmap dates.'};
  var last=draft.start;
  for(var day=1;day<7&&last<draft.end;day++)last=nextDay(last);
  return {valid:true,text:[draft.start+' to '+last,draft.line||'All Lines of Business',draft.driver||'All contact drivers',
    draft.lead||'All team leads',draft.shift||'All hours'].join(' · ')};
}
function hourlyResultsTable(map){
  return '<div class="scroll" tabindex="0" aria-label="Hourly values"><table><thead><tr><th scope="col">Business date</th><th scope="col">Local hour</th><th scope="col">'+esc(chartMetricAxis())+'</th><th scope="col">'+esc(gCountLabel())+'</th></tr></thead><tbody>'
    +[...map.cells].sort((a,b)=>a.date.localeCompare(b.date)||a.hour-b.hour).map(cell=>'<tr><th scope="row">'+esc(cell.date)+'</th><td>'+String(cell.hour).padStart(2,'0')+':00</td><td>'+esc(cell.value===null?'Unavailable':fcValue(cell.value))+'</td><td>'+n0(cell.count)+'</td></tr>').join('')
    +'</tbody></table></div>';
}
function hourlyScopeNotice(map,R){
  var state=hourlyTrendScope(R);
  if(!state)return 'This heatmap uses its own applied scope because Daily Trend has multiple groups selected.';
  var applied=map.selection;
  return applied.line!==state.line||applied.driver!==state.driver||applied.start<state.start||map.days.at(-1)>state.end
    ?'Apply heatmap filters to use the current trend selection.':'';
}
function gHourlyHeatmap(R,evidence=false){
  var map=R.hourly_heatmap;
  var heading='<h3 id="g-hourly-title">Performance by calendar day and hour</h3>';
  if(!map)return '<section id="g-hourly-heatmap" aria-labelledby="g-hourly-title">'+heading+'<p>This view needs timestamped primary contact records.</p></section>';
  var s=map.selection,state=observedState(R),colors=hourlyColors(R,map);
  var cells=new Map(map.cells.map(cell=>[cell.date+'-'+cell.hour,cell]));
  var applied=[s.line||'All lines of business',s.driver||'All contact drivers',s.lead?'Team lead '+s.lead:'All team leads',s.shift?'Shift window '+s.shift:'All hours'];
  var peak=map.cells.reduce((best,cell)=>cell.count>=10&&Number.isFinite(cell.value)&&(!best||cell.value>best.value)?cell:best,null);
  var peaks=peak?map.cells.filter(cell=>cell.count>=10&&cell.value===peak.value):[];
  var takeaway=peaks.length?gSlideTakeaway('The highest observed '+ml()+' among eligible hours was '+fcValue(peak.value)+'.',
    '<h4>Facts</h4><ul>'+peaks.map(cell=>'<li>'+esc(cell.date+' at '+String(cell.hour).padStart(2,'0')+':00 · '+n0(cell.count)+' eligible contacts')+'</li>').join('')+'</ul>'
    +gTakeawayMeaning('An hour needs at least 10 eligible contacts to count toward this peak.'))
    :gSlideTakeaway('No hourly result was available with at least 10 eligible contacts.');
  var selection={...s,agentGroup:s.lead?'Team lead '+s.lead:null,start:map.days[0],end:map.days.at(-1)};
  var scope=evidence?chartScopeTitle(R,'Calendar heatmap',selection):presentationScopeTitle(R,selection);
  if(evidence)return '<h3>Calendar heatmap evidence</h3>'+scope+hourlyResultsTable(map)+takeaway;
  var body=Array.from({length:24},(_,hour)=>{
    var time=String(hour).padStart(2,'0')+':00';
    return '<tr><th scope="row">'+time+'</th>'+map.days.map(day=>{
      var cell=cells.get(day+'-'+hour);
      if(!cell)return '<td class="g-hourly-missing"><span aria-label="No eligible observations">—</span></td>';
      if(cell.value===null)return '<td title="Hourly totals exceed the supported numeric range.">Unavailable<small>n = '+n0(cell.count)+'</small></td>';
      var tone=colors?.neutral?' style="--heat-color:color-mix(in srgb,var(--aegean-600) '+Math.round(10+36*colors.score(cell.value))+'%,var(--surface))"':heatmapTint(colors,cell.value);
      var exact=String(cell.value/durationFactor())+' '+durationUnitSymbol()+' · '+n0(cell.count)+' observations';
      return '<td'+tone+' title="'+esc(exact)+'" aria-label="'+esc(exact)+'">'+esc(durationNumber(cell.value,false))+'<small>n = '+n0(cell.count)+'</small></td>';
    }).join('')+'</tr>';
  }).join('');
  var grid='<div class="scroll"><table class="g-hourly-grid"><caption>'+esc(ML()+' ('+durationUnitName(true)+') and eligible observations by local hour and date')+'</caption>'
    +'<thead><tr><th scope="col">Local hour</th>'+map.days.map(day=>'<th scope="col">'+esc(day)+'</th>').join('')+'</tr></thead><tbody>'+body+'</tbody></table></div>';
  return '<section id="g-hourly-heatmap" class="g-chart-container-box" aria-labelledby="g-hourly-title">'+heading+scope
    +'<p>Primary contact occurrence time in '+esc(map.zone)+'. Explore shows up to seven dates. Repeated clock hours share a cell.</p>'
    +'<div class="g-observed-filters">'+reportChartControls("hourly",state)+'</div>'
    +'<p class="muted" id="g-hourly-status" role="status">'+hourlyScopeNotice(map,R)+'</p>'
    +'<p>'+esc(map.days[0]+' to '+map.days.at(-1)+' · '+applied.join(' · '))+'</p>'
    +gSlideResult(takeaway,state.hourlyView==="table"?hourlyResultsTable(map):'<p class="muted">'+(colors?'<span class="g-hourly-key'+(colors.neutral?' is-neutral':'')+'" aria-hidden="true"></span>'+esc(colors.label):'Color references are unavailable for this scope.')+' A dash marks no eligible observations.</p>'+grid)
    +'</section>';
}
function hourlyTrendChanged(R){
  var status=document.getElementById('g-hourly-status');
  if(status)status.textContent=hourlyScopeNotice(R.hourly_heatmap,R);
}
function gArt(id,num,title,desc,body,src){var at=gVisibleChapters().map(function(c){return c[0];}).indexOf(id);if(at>=0)num=at+1;return '<article class="g-chapter-article" id="'+id+'" aria-labelledby="'+id+'-h"'+src+'><header class="g-chapter-heading"><h2 id="'+id+'-h" tabindex="-1">Chapter '+num+': '+esc(title)+'</h2>'+(desc?'<p class="g-ch-desc">'+esc(desc)+'</p>':'')+'</header>'+body+'</article>';}
function gQuestionSlide(id,question,body){
  var daily=id==="g-slide-daily"&&xR()?.metric?.metric_id==="aht";
  return body?'<section class="g-question-slide g-slide-frame'+(daily?' g-daily-aht-slide':'')+'" id="'+id+'" aria-labelledby="'+id+'-question">'
    +'<header class="g-slide-heading"><h3 class="g-slide-question" id="'+id+'-question">'+esc(question)+'</h3>'
    +'<p class="g-slide-subtitle" hidden></p><div class="g-slide-toolbar" role="group" aria-label="Slide controls"></div>'+gGuideControl(id,question)+'</header>'
    +'<div class="g-slide-content">'+body+'</div></section>':'';
}
function syncSlideSubtitle(slide){
  var content=slide.querySelector('.g-slide-content');
  var source=content.querySelector('[data-slide-content-title]')||
    content.querySelector(':scope > .g-chart-container-box > h3:first-child, .g-slide-visual > :is(h3,h4):not(.g-insights-chart-title):first-child');
  var subtitle=slide.querySelector('.g-slide-subtitle');
  var title=source?.textContent.trim()||'';
  var question=slide.querySelector('.g-slide-question').textContent.trim();
  subtitle.textContent=title.toLowerCase()===question.toLowerCase()?'':title;
  subtitle.hidden=!subtitle.textContent;
  source?.classList.add('g-slide-heading-source');
}
function collectSlideControls(source,toolbar){
  var selectors=[...source.querySelectorAll('select[data-observed-chart]')].map(select=>select.closest('[data-chart-selection]')||select.closest('label')||select);
  var groups=['[data-chart-explore]','[data-chart-view]','[data-chart-expand]'];
  toolbar.replaceChildren(...new Set([...selectors,...groups.flatMap(group=>[...source.querySelectorAll(group)])]));
  for(var wrapper of source.querySelectorAll('.g-observed-filters')){
    if(!wrapper.children.length)wrapper.remove();
  }
}
function retainFocusedTakeaway(modal){
  var takeaway=modal.card.querySelector('.g-slide-takeaway')?.cloneNode(true);
  if(takeaway){
    takeaway.removeAttribute('id');
    for(var node of takeaway.querySelectorAll('[id]'))node.removeAttribute('id');
  }
  modal.placeholder.replaceChildren(...(takeaway?[takeaway]:[]));
}
function takeawayListItem(item,attribute=''){
  if(!Array.isArray(item?.items))return '<li'+attribute+'>'+esc(item)+'</li>';
  return '<li'+attribute+'>'+esc(item.text)+'<ul class="g-takeaway-subitems">'+item.items.map(({label,text})=>
    '<li><strong>'+esc(label)+'</strong>'+esc(text||'')+'</li>').join('')+'</ul></li>';
}
function gSlideTakeaway(message,details='',id=''){
  var answers=Array.isArray(message)?message:[message];
  var template=document.createElement('template');
  template.innerHTML=details;
  for(var heading of [...template.content.children]){
    if(!heading.matches('h4')||heading.textContent!=='Facts')continue;
    var list=document.createElement('ul');
    list.className='g-takeaway-facts';
    heading.after(list);
    while(list.nextElementSibling?.matches('p,ul')){
      var fact=list.nextElementSibling;
      if(fact.matches('ul')){
        list.append(...fact.children);
        fact.remove();
      }else if(fact.classList.contains('g-takeaway-meaning')){
        if(!list.lastElementChild)break;
        list.lastElementChild.append(fact);
      }else{
        var item=document.createElement('li');
        for(var attribute of fact.attributes)item.setAttribute(attribute.name,attribute.value);
        item.append(...fact.childNodes);
        fact.replaceWith(item);
        list.append(item);
      }
    }
    if(!list.children.length){list.remove();heading.remove();}
  }
  return '<aside class="g-slide-takeaway" aria-label="Takeaway"'+(id?' id="'+esc(id)+'"':'')+'><h4>Takeaway</h4>'
    +'<ul class="g-takeaway-answer">'+answers.map(item=>takeawayListItem(item,' data-takeaway-answer')).join('')+'</ul>'
    +template.innerHTML+'</aside>';
}
function gTakeawayMeaning(message){
  return '<p class="g-takeaway-meaning"><span aria-hidden="true">↪</span> '+esc(message)+'</p>';
}
function gSlideResult(takeaway,visual,visualFirst=false){
  var graphic='<div class="g-slide-visual">'+visual+'</div>';
  return '<div class="g-slide-result">'+(visualFirst?graphic+takeaway:takeaway+graphic)+'</div>';
}
var INSIGHT_GUIDES={
  "g-slide-requirements":["Target attainment"],
  "g-slide-stability":["Run charts"],
  "g-slide-score-cutoff":["Observation score cutoff"],
  "g-slide-daily":["Daily movement", [["Below 0","Fell"],["0","Unchanged"],["Above 0","Rose"]],"Change compares the last and first eligible days in the applied selection."],
  "g-slide-hourly":["Highest eligible hour",[["Below 10","Below takeaway minimum"],["10 or more","Eligible for the takeaway"]],"The highest finite KPI and exact ties are highlighted among qualifying hours. Lower-count cells remain visible."],
  "g-slide-volume":["Busiest dates",[["Ranks 1–5","Most handled contacts"]],"Count ranks describe workload in the selected scope. Equal counts are ordered by date."],
  "g-slide-groups":["Group medians and spread",[["4 or more agents","Box plot available"],["Outside 1.5 × IQR fences","Outside the ordinary fence"]],"Where the direction or applicable interval supports ranking, the most and least favorable observed medians are highlighted. Tied ranks are shared."],
  "g-slide-distribution":["Agent distribution and cohorts",[["30 or more observations","Agent eligible to rank"],["4 or more ranked agents","Quartile cuts"],["20 or more ranked agents","Decile cuts"]],"Exact ties stay together. The histogram offers cohorts with at least two agents."],
  "g-slide-agents":["Heatmap shading",[["Column minimum","Low in this column"],["Column maximum","High in this column"]],"Each column uses its own observed range across all pages. Equal or missing values use neutral shading."],
  "g-slide-relationships":["Weekly relationship strength"],
  "g-factor-comparisons":["Adjusted gap screens",[["30 or more","Group observations"],["90% or more","Group-side shared work"],["5 or more each","Distinct agents"],["5% or more","Gap size relative to overall KPI"]],"Adjusted differences are descriptive. The rest’s overlap is disclosed separately."],
  "g-factor-direct-gaps":["Direct pair coverage",[["30 or more each","Eligible group observations"],["90% or more each","Adjusted descriptive gap available"]],"The comparison uses up to ten eligible groups by volume. With less shared work on either side, use the observed gap."],
  "g-factor-agent-groups":["Cohort cutoffs"],
  "g-factor-period-change":["Work-mix contributions",[["More than 50%","Leading absolute contribution"],["50% each","Equal contributions"],["Both zero","No contribution"]],"The shares use the sum of the two absolute contributions. Use the signed values to see whether each added to or offset movement."],
  "g-factor-driver-impact":["Weighted deviation and priority",[["Below 0","Unfavorable"],["0","Neutral"],["Above 0","Favorable"],["At least half at or below 80%","Within the highlight cutoff"]],"Cumulative share uses absolute volume-weighted deviations. Include a positive row when at least half of its share is at or below the 80% cutoff."],
  "g-factor-constraints":["Recorded controllable constraints",[["At least half at or below 80%","Within the priority set"],["Less than half at or below 80%","Outside the priority set"]],"Include a positive row when at least half of its share is at or below the 80% cutoff. Shares use recorded controllable counts."],
  "g-factor-shortfalls":["Component shortfall shares",[["Total shortfall above 0","Shares can be ranked"],["Total shortfall equals 0","No share to rank"]],"A higher share contributes more to the measured shortfall. Each component uses its highest observed source-file value as its reference."],
  "g-slide-component-movement":["Before and after movement",[["Below 0","Fell"],["0","Unchanged"],["Above 0","Rose"]],"Change compares the two pooled component averages in the applied date and group selection."],
  "g-slide-component-relationships":["Component straight-line fit",[["R² below 0.20","Weak fit"],["0.20 to 0.50 inclusive","Intermediate fit"],["R² above 0.50","More pronounced fit"]],"A fit needs eight or more complete paired weeks with variation. A coefficient below 10⁻¹² in magnitude gives no directional takeaway."],
  "g-slide-cart":["Historical CART coverage"],
  "g-slide-projection":["Forecast validation and target margin"],
  "g-slide-scenario":["Scenario adoption and lift",[["50%, 70%, or 80%","Available adoption assumptions"],["Lift above 0","Modeled movement"],["Lift equals 0","No modeled movement"]],"Adoption is the share of the linked modeled opportunity. The endpoint is conditional."],
  "g-slide-actions":["Recommendation priority",[["Ranks 1–3","Primary cards within a category"],["Rank 4 onward","Other recommendations"]],"Read approval status and prerequisites on each card. The rating orders cards within their category."]
};
var GUIDE_BOOK='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M12 5c-3-2-6-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1v15"/></svg>';
function gGuideControl(id,question){
  if(!Object.hasOwn(INSIGHT_GUIDES,id))return '';
  var R=xR();
  if(id==="g-slide-requirements"&&!R?.account_requirements&&!R?.target_assessment?.periods?.some(p=>typeof p.target_met==="boolean"))return '';
  if(id==="g-slide-hourly"&&!R?.hourly_heatmap)return '';
  if(id==="g-slide-scenario"&&(!R?.insights?.scenario||R.insights.scenario.blocked||!R.insights.constraints))return '';
  if(id==="g-slide-actions"&&!R?.insights?.cards?.length)return '';
  var guide="guide-"+id;
  return '<div class="g-guide"><button type="button" class="g-guide-toggle" data-guide-toggle aria-label="'+esc('Open threshold guide for '+question)+'" aria-expanded="false" aria-controls="'+guide+'">'+GUIDE_BOOK+'</button>'
    +'<aside class="g-chart-popover g-guide-panel" id="'+guide+'" aria-label="Threshold guide" popover="manual"></aside></div>';
}
function gGuideContent(slide,R){
  var id=slide.id,[title,ranges,note]=INSIGHT_GUIDES[id],state=observedState(R),result='',active=-1;
  var direction=R.analysis_setup?.direction||R.metric?.direction;
  if(id==="g-slide-requirements"){
    if(R.account_requirements)return requirementsGuide(R);
    var periods=(R.account_requirements?.assessment?.periods||R.target_assessment?.periods||[]).filter(p=>typeof p.target_met==="boolean");
    var rules=new Set(periods.map(p=>p.target_rule));
    ranges=[];
    if(rules.has("at_or_below"))ranges.push(["KPI ≤ target","Meets an at-or-below target","favorable"],["KPI > target","Misses an at-or-below target","adverse"]);
    if(rules.has("at_or_above"))ranges.push(["KPI ≥ target","Meets an at-or-above target","favorable"],["KPI < target","Misses an at-or-above target","adverse"]);
    note='Use the target and its direction for each effective period. An exact match meets the target.';
    if(periods.length===1)result='Applicable target '+durationNumber(periods[0].target,true)+' '+durationUnitSymbol()+'.';
  }else if(id==="g-slide-score-cutoff"){
    var cutoff=R.metric.cutoff_share;
    if(cutoff.basis==="file_cutoff")note='The scored share uses the cutoff supplied with the file.';
    else if(Number.isFinite(cutoff.cutoff)){
      ranges=[["Score < "+cutoff.cutoff,"Below the score cutoff"],["Score ≥ "+cutoff.cutoff,"Qualifies"]];
      note='This is the observation score cutoff. Any target for the pooled share has its own assessment.';
    }
  }else if(id==="g-slide-daily"){
    var view=trendSelection(R,state).view;
    var days=view.by_day.filter(day=>Number.isFinite(day.value)).sort((a,b)=>a.key.localeCompare(b.key));
    if(days.length>1)active=1+Math.sign(days.at(-1).value-days[0].value);
    result='Applied dates '+state.start+' to '+state.end+'. '+n0(days.length)+' dates with eligible values.';
    if(direction==="lower_is_better"||direction==="higher_is_better")note+=' '+(direction==="lower_is_better"?'Lower':'Higher')+' KPI values are favorable.';
  }else if(id==="g-slide-hourly"&&R.hourly_heatmap){
    var map=R.hourly_heatmap,colors=hourlyColors(R,map);
    note+=' '+(colors?colors.label:'Color references are unavailable for this scope.');
    result='Applied dates '+map.days[0]+' to '+map.days.at(-1)+'. '+n0(map.cells.filter(cell=>cell.count>=10&&Number.isFinite(cell.value)).length)+' hours qualify for the takeaway.';
  }else if(id==="g-slide-groups"){
    var box=boxSelection(R,state);
    if(box){
      result=box.label+' by '+box.labels[box.dim]+'. '+n0(box.groups.filter(group=>group.box).length)+' groups have a plottable box.';
    }
  }else if(id==="g-slide-agents"){
    var agent=agentHeatmapSelection(R,state);
    if(agent)result='Grouped by '+agent.group.label+' · '+n0(agent.columns.length)+' measures.';
  }else if(id==="g-factor-comparisons"){
    var factor=factorSelection(R,state);
    if(factor)result=factorPreview(R,state).text+'.';
  }else if(id==="g-slide-relationships"){
    ranges=[["|r| < 0.10","Very small"],["0.10 ≤ |r| < 0.30","Small"],["0.30 ≤ |r| < 0.50","Moderate"],["|r| ≥ 0.50","Strong"]];
    note='Use eight or more complete paired weeks with variation. Below 10⁻¹² in magnitude, ignore the sign. A positive row enters the descriptive priority set when at least half of its share is at or below 80%. A priority highlight also needs qualified significance.';
    var pairs=R.insights?.metric_relationships||[],pair=pairs.find(p=>p.id===state.relationship)||pairs[0];
    if(pair){
      var test=qualifiedLevelTest(pair);
      var magnitude=Math.abs(test?.coefficient??pair.r);
      if(pair.status==="descriptive"&&Number.isFinite(magnitude))active=magnitude<.10?0:magnitude<.30?1:magnitude<.50?2:3;
      result=pair.label+' · '+n0(pair.weeks.length)+' paired weeks. '+metricPairStatus(pair)+' '+(test
        ?'Adjusted p ≤ 0.05 is significant. Above 0.05 is inconclusive. This comparison’s adjusted p is '+test.adjusted_p+'.'
        :metricQualificationText(pair));
    }
  }else if(id==="g-slide-cart"){
    ranges=[["Fit ≥20 cells","Fit coverage floor"],["Later ≥10 cells","Historical check coverage floor"],["≥4 agents and ≥3 dates","Required in each period"]];
    note='The overall history needs at least 40 business dates. The latest quarter of dates supplies the historical check.';
    var cart=R.insights?.cart_profiles,path=cart?.paths.find(p=>String(p.id)===state.cartPath)||cart?.paths[0];
    if(path){
      ranges=ranges.concat([["Fit",fcValue(path.fitted)],["Historical check",fcValue(path.later.observed)]]);
      result='Applied path · '+n0(path.fit.cells)+' fit cells and '+n0(path.later.cells)+' later cells.';
      if(Number.isFinite(cart.target)&&typeof path.later.target_met==="boolean"){
        result+=' The check '+(path.later.target_met?'met':'missed')+' the '+fcValue(cart.target)+' target.';
      }
    }else result=cart?.reason||'No eligible historical profile is available.';
  }else if(id==="g-slide-projection"){
    var F=R.forecast;
    var improvement=Math.round((F?.improvement_required??.05)*100);
    ranges=[["12 or more consecutive weeks","Projection coverage"],["8 or more scored origins","One-step validation"],["More than "+improvement+"% lower MAD","Candidate clears benchmark screen"]];
    note='Historical one-week error describes the one-step tests. The projection gives one estimate per week.';
    if(F?.status==="published"&&fcHasTarget(F))ranges=ranges.concat([["Margin below 0","Misses target","adverse"],["0 to below MAD","Reaches within typical error"],["At least MAD","Reaches by typical error or more","favorable"]]);
    result=F?.status==="published"?fcCallout(F):F?.reason||'Projection unavailable for this selection.';
  }else if(id==="g-slide-distribution"||id==="g-factor-agent-groups"){
    if(id==="g-factor-agent-groups")note='Athena ranks by performance, with Q1 best and Q4 worst. Cutoff ties stay in the better cohort.';
    if(direction==="lower_is_better"||direction==="higher_is_better"||direction==="within_bounds"){
      var cuts=direction==="higher_is_better"?["x ≥ P75","P50 ≤ x < P75","P25 ≤ x < P50","x < P25"]
        :["x ≤ P25","P25 < x ≤ P50","P50 < x ≤ P75","x > P75"];
      ranges=(ranges||[]).concat(cuts.map((cut,i)=>[cut,["Q1 · Best","Q2","Q3","Q4 · Worst"][i]]));
      if(direction==="within_bounds")note+=' Here x is distance from the applicable interval, with zero inside.';
    }
    if(id==="g-slide-distribution"&&R.insights?.agent_histogram)result=histogramView(R.insights.agent_histogram,state).label+'.';
  }else if(id==="g-slide-scenario"){
    var scenario=R.insights?.scenario;
    if(scenario&&!scenario.blocked){
      result='Applied adoption '+Math.round(scenario.adoption*100)+'%. '+(scenario.target_beyond_modeled_lift
        ?'Required adoption rate: more than 100%.':typeof scenario.target_met==="boolean"
        ?'The endpoint '+(scenario.target_met?'meets':'misses')+' the '+fcValue(scenario.target)+' target.':'No target verdict applies.');
      if(Number.isFinite(scenario.adoption_to_meet_target))result+=' The model reaches the target at about '+Math.round(scenario.adoption_to_meet_target*100)+'% adoption.';
    }
  }else if(id==="g-slide-component-relationships"){
    var links=R.insights?.component_links;
    var row=links?.rows.find(row=>row.column===state.component)||links?.rows[0];
    if(row)result=row.label+' · '+n0(links.weeks.length)+' paired weeks.'+(Number.isFinite(row.r_squared)?' R² '+componentStat(row.r_squared)+'.':'')
      +(links.source==='D01'?' Descriptive. This component contributes to AHT.':' Descriptive. A qualified significance result is unavailable.');
  }
  var scope=slide.querySelector("[data-takeaway-answer]")?.textContent.trim();
  return '<h4 id="guide-'+id+'-title">'+esc(title)+'</h4>'
    +(ranges?.length?'<dl class="g-guide-ranges">'+ranges.map(([range,label,tone],i)=>'<div class="'+(tone?'g-guide-'+tone:'')+(i===active?' g-guide-active':'')+'"><dt>'+esc(range)+'</dt><dd>'+esc(label)+(i===active?' · Applied':'')+'</dd></div>').join("")+'</dl>':'')
    +(note?'<p>'+esc(note)+'</p>':'')+(result||scope?'<p><strong>Applied result</strong> '+esc(result||scope)+'</p>':'');
}
function gSetGuide(guide,open,focus=false){
  var toggle=guide.firstElementChild,panel=guide.lastElementChild,slide=guide.closest(".g-question-slide");
  var daily=slide.id==="g-slide-daily"&&xR()?.metric?.metric_id==="aht";
  guide.classList.toggle("is-open",open);
  toggle.setAttribute("aria-expanded",String(open));
  toggle.setAttribute("aria-label",(open?"Close":"Open")+" threshold guide for "+slide.querySelector(".g-slide-question").textContent);
  toggle.innerHTML=open?'<span aria-hidden="true">×</span>':GUIDE_BOOK;
  if(open){
    closeChartFilter();
    panel.classList.toggle('dt-guide',daily);
    if(daily){panel.setAttribute('role','dialog');panel.setAttribute('aria-label','Threshold Guide');}
    guide.dataset.page=daily&&observedState(xR()).trendView==="comparison"?"1":"0";
    gRenderGuide(guide,slide);
    panel.showPopover();
    positionChartPopover(panel,toggle,true);
  }else if(panel.matches(":popover-open"))panel.hidePopover();
  if(focus)(open?panel.querySelector('.g-guide-heading h4'):toggle).focus({preventScroll:true});
}
function gRenderGuide(guide,slide){
  var panel=guide.lastElementChild,index=Number(guide.dataset.page);
  var body=panel.classList.contains('dt-guide');
  var R=xR(),pages=slide.id==="g-slide-requirements"&&R?.account_requirements
    ?requirementsGuidePages(R):slide.id==="g-slide-stability"?stabilityGuidePages(R)
      :slide.id==="g-slide-daily"&&R?.metric?.metric_id==="aht"?dailyGuidePages(R):[gGuideContent(slide,R)];
  index=Math.min(index,pages.length-1);
  guide.dataset.page=String(index);
  panel.innerHTML='<div class="g-guide-heading"><h4 tabindex="-1">Threshold Guide</h4></div>'
    +(body?'<div class="dt-guide-body">'+pages[index]+'</div>':pages[index])+(pages.length>1?'<div class="g-guide-pages"><button type="button" class="btn secondary" data-guide-page="'+((index+pages.length-1)%pages.length)+'" aria-label="Previous guide">'+gChevron(-1,16)+'</button><span aria-live="polite">'+(index+1)+' of '+pages.length+'</span><button type="button" class="btn secondary" data-guide-page="'+((index+1)%pages.length)+'" aria-label="Next guide">'+gChevron(1,16)+'</button></div>':'');
}
function gRefreshGuide(){
  var guide=document.querySelector("#g-report-presentation .g-guide.is-open");
  if(guide)gRenderGuide(guide,guide.closest(".g-question-slide"));
}
function gCloseGuideOutsideView(dock){
  var guide=document.querySelector("#g-report-presentation .g-guide.is-open");
  if(!guide)return;
  var slide=guide.closest(".g-question-slide"),rect=slide.getBoundingClientRect();
  if(rect.bottom<=dock||rect.top>=window.innerHeight)gSetGuide(guide,false);
  else positionChartPopover(guide.lastElementChild,guide.firstElementChild,true);
}
function gShowsPanel(R,key){
  return S.page==="full-insights"||!Array.isArray(R.report_panels)||R.report_panels.includes(key);
}
function gReportVolume(R){
  var days=(R.handled_contacts_by_day||[]).filter(day=>Number.isFinite(day.count)).slice()
    .sort((a,b)=>b.count-a.count||String(a.key).localeCompare(String(b.key))).slice(0,5);
  if(!days.length)return '<p>Handled contact volume by date is unavailable for this selection.</p>';
  var peak=days[0];
  var tied=R.handled_contacts_by_day.filter(day=>day.count===peak.count).length;
  var takeaway=tied===1?peak.key+' was the busiest date in this scope, with '+n0(peak.count)+' handled contacts.'
    :n0(tied)+' dates tied for the highest volume, with '+n0(peak.count)+' handled contacts each.';
  var state=observedState(R),graphic='<p class="muted">Bars start at zero handled contacts.</p>'
    +'<ol class="bars" aria-label="Busiest business dates">'+days.map(day=>'<li class="barrow"><span>'+esc(day.key)
      +'</span><i aria-hidden="true" style="width:'+(peak.count>0?day.count/peak.count*100:0)+'%"></i><span>'
      +n0(day.count)+' contacts</span></li>').join('')+'</ol>';
  return reportCard("g-volume-by-date",gSlideResult(gSlideTakeaway(takeaway),'<div class="g-observed-filters">'+reportChartControls("volume",state)+'</div><h4 data-slide-content-title>Handled contacts by business date</h4>'
    +(state.volumeView==="table"?volumeTable(days):graphic)));
}
function volumeTable(days){
  return '<div class="scroll" tabindex="0" aria-label="Daily handled contact counts"><table><thead><tr><th scope="col">Business date</th><th scope="col">Handled contacts</th></tr></thead><tbody>'
    +days.map(day=>'<tr><th scope="row">'+esc(day.key)+'</th><td>'+n0(day.count)+'</td></tr>').join('')+'</tbody></table></div>';
}
function reportVolumeEvidence(R){
  var days=(R.handled_contacts_by_day||[]).filter(day=>Number.isFinite(day.count))
    .sort((a,b)=>String(a.key).localeCompare(String(b.key)));
  var ranked=[...days].sort((a,b)=>b.count-a.count||a.key.localeCompare(b.key)).slice(0,5);
  return days.length?'<h4>Highest-volume business dates</h4>'+volumeTable(ranked)
    +'<h4>All business dates in chronological order</h4>'+chartScopeTitle(R,'Daily handled volume')+volumeTable(days):'';
}
function gReportGroups(R,evidence=false){
  var ids=R.report_questions||[],people=R.group_comparison?.find(item=>item.id===R.metric?.metric_id)?.groups;
  var missingTeams=S.page!=="full-insights"&&ids.some(id=>id==="team-results"||id==="team-spread")&&!people?.team_lead?.length;
  if(!missingTeams)return gBreakdowns(R,evidence);
  var reason='Team comparisons need eligible results linked to a team lead.';
  if(ids.includes("contact-results"))return '<p>'+esc(reason)+'</p>'+gBreakdowns(R,evidence);
  return evidence?chartScopeTitle(R,'Applied team comparison scope'):gSlideTakeaway(reason);
}
function gContactPerformance(R,evidence=false){
  var groups=R.by_groups?.contact_type||[];
  var volume=new Map((R.handled_contacts_by_type||[]).map(row=>[row.key,row.count]));
  var isAht=(R.metric?.metric_id||metricId())==="aht";
  var impact=isAht?R.insights?.contact_driver_impact:null;
  var impactByType=new Map((impact?.rows||[]).filter(row=>Number.isFinite(row.impact)).map(row=>[row.key,row]));
  var pooled=isAht?(impact?.baseline??R.value):null;
  function impactText(result){
    var value=result?.impact;
    if(!Number.isFinite(value))return '—';
    return (value<0?'−':value>0?'+':'')+Math.abs(value)+' sec';
  }
  var rows=groups.map(row=>({...row,eligible:row.count,count:volume.get(row.key)??(metricId()==="aht"?row.count:null)}))
    .filter(row=>Number.isFinite(row.count)&&row.count>0&&Number.isFinite(row.value));
  if(!rows.length)return evidence?'':gSlideTakeaway('A contact-volume comparison needs eligible handled counts and KPI values by contact type.');
  var requirements=new Map((R.group_assessments_by_dimension?.contact_type||[]).map(row=>[row.key,row]));
  var target=xHasTarget(R),bounds=R.target_assessment?.overall?.classified?R.target_assessment.overall.specification:null;
  var hasScopedReferences=rows.some(row=>requirements.has(row.key));
  if(hasScopedReferences){target=null;bounds=null;}
  var references=[[pooled,'impact-pooled','Scoped pooled AHT','g-contact-pooled'],[target,'target','Target','gc-target'],
    [bounds?.lower,'impact-limit','Lower limit','g-contact-limit'],[bounds?.upper,'impact-limit','Upper limit','g-contact-limit']]
    .filter(([value])=>Number.isFinite(value));
  var requirementsShown=references.some(([,style])=>style!=='impact-pooled');
  var impactsShown=rows.some(row=>impactByType.has(row.key));
  var impactNote=impactsShown?'<p class="muted">Weighted impact compares each contact type with scoped pooled AHT and uses its eligible share of handled contacts. Positive values are favorable.</p>':'';
  var countBasis=R.metric?.unit!=="seconds"?'<th>'+esc(gCountLabel(R))+'</th>':'';
  var table='<div class="scroll" tabindex="0" aria-label="Contact type volumes and KPI"><table><thead><tr><th>Contact type</th><th>Handled contacts</th>'+countBasis+'<th>'+esc(chartMetricAxis())+'</th><th>Applicable requirements</th>'+(impactsShown?'<th>Signed weighted impact</th>':'')+'</tr></thead><tbody>'
    +rows.map(row=>'<tr><th scope="row">'+esc(row.key)+'</th><td>'+n0(row.count)+'</td>'+(countBasis?'<td>'+n0(row.eligible)+'</td>':'')+'<td>'+esc(fcValue(row.value))+'</td><td>'
    +esc(requirements.has(row.key)?scopedAssessmentText(requirements.get(row.key)):
      [[target,'Target'],[bounds?.lower,'Lower limit'],[bounds?.upper,'Upper limit']].filter(([v])=>Number.isFinite(v)).map(([v,label])=>label+' '+fcValue(v)).join(' · ')||'—')+'</td>'
      +(impactsShown?'<td class="n">'+esc(impactText(impactByType.get(row.key)))+'</td>':'')+'</tr>').join('')+'</tbody></table></div>';
  if(evidence)return '<h3>Contact type volumes and KPI</h3>'+chartScopeTitle(R,'Contact type comparison')+table+impactNote;
  var max=Math.max(...rows.map(row=>row.count)),values=rows.map(row=>row.value).concat(references.map(([value])=>value));
  var low=Math.min(...rows.map(row=>row.value)),maxValue=Math.max(...rows.map(row=>row.value));
  var min=Math.min(...values),high=Math.max(...values),pad=Math.max((high-min)*0.08,metricKind()==="points"?.05:1);
  var lo=min-pad,hi=high+pad;
  var x=n=>72+604*n/max,y=v=>214-194*(v-lo)/(hi-lo);
  var plotLegend=references.map(([value,style,label])=>[style,label+' '+fcValue(value)]);
  var points=[[],[]],highlights=new Set();
  for(var row of rows){
    var result=impactByType.get(row.key),value=result?.impact;
    var highlight=result?.vital_few&&value!==0?(value<0?'adverse':'favorable'):null;
    var px=x(row.count),py=y(row.value);
    var description=row.key+' · '+n0(row.count)+' handled contacts · '+fcValue(row.value)
      +(result?' · Signed weighted impact '+impactText(result):'');
    var title='<title>'+esc(description)+'</title>';
    if(highlight){
      highlights.add(highlight);
      var shape=highlight==='adverse'?'M0 -7 L7 6 H-7 Z':'M0 -7 L7 0 L0 7 L-7 0 Z';
      points[1].push('<path class="g-contact-impact-point g-contact-impact-'+highlight+'" d="'+shape+'" transform="translate('+px+' '+py+')">'+title+'</path>');
    }else{
      points[0].push('<circle class="gc-component-point" cx="'+px+'" cy="'+py+'" r="5">'+title+'</circle>');
    }
  }
  if(highlights.has('adverse'))plotLegend.push(['impact-adverse','Unfavorable weighted gaps']);
  if(highlights.has('favorable'))plotLegend.push(['impact-favorable','Favorable weighted offsets']);
  var graph=(plotLegend.length?chartLegend(plotLegend):'')
    +'<svg class="g-chart" viewBox="0 0 720 260" role="img" aria-label="Handled contacts versus '+esc(ml())+' by contact type">'
    +[0,.25,.5,.75,1].map(f=>{var v=lo+(hi-lo)*f;return '<line class="gc-grid" x1="72" x2="676" y1="'+y(v)+'" y2="'+y(v)+'"/><text x="64" y="'+(y(v)+4)+'" text-anchor="end">'+esc(durationNumber(v,true))+'</text><text x="'+x(max*f)+'" y="234" text-anchor="middle">'+n0(max*f)+'</text>';}).join('')
    +references.map(([value,,,className])=>'<line class="'+className+'" x1="72" x2="676" y1="'+y(value)+'" y2="'+y(value)+'"/>').join('')
    +points.flat().join('')
    +(low===maxValue?'':rows.filter(row=>row.value===low||row.value===maxValue).map(row=>{
      var at=x(row.count),end=at>510;
      return '<text x="'+(at+(end?-8:8))+'" y="'+Math.max(13,y(row.value)-7)+'" text-anchor="'+(end?'end':'start')+'">'+esc(row.key)+'</text>';
    }).join(''))
    +'<text x="374" y="252" text-anchor="middle">Handled contacts</text><text transform="translate(15 117) rotate(-90)" text-anchor="middle">'+esc(chartMetricAxis())+'</text></svg>';
  var names=value=>rows.filter(row=>row.value===value).map(row=>row.key).join(', ');
  var top=rows.reduce((a,b)=>b.count>a.count?b:a),tied=rows.filter(row=>row.count===top.count);
  var takeaway=low===maxValue?'All displayed contact types recorded '+fcValue(low)+'.':
    names(low)+' recorded the lowest result at '+fcValue(low)+', and '+names(maxValue)+' recorded the highest at '+fcValue(maxValue)+'.';
  var state=observedState(R);
  return '<section id="g-contact-performance" class="g-chart-container-box"><div class="g-observed-filters">'+reportChartControls("contact",state)+'</div>'
    +gSlideResult(gSlideTakeaway(takeaway,'<h4>Facts</h4><p>'+esc(tied.map(row=>row.key).join(', ')+' had the highest volume at '+n0(top.count)+' handled contacts'+(tied.length>1?' each':'')+'.')+'</p>'),
      '<h4>Contact type volume versus '+esc(ml())+'</h4>'+(state.contactView==="table"?table:graph)
      +(requirementsShown?'':'<p class="muted">No single requirement is shown for this comparison. See applicable requirements by contact type in the table.</p>'))
    +'<button type="button" class="g-linkbtn" data-chapter="g-contact-evidence">See contact type results in Evidence</button></section>';
}
function requirementsScope(R){
  return chartScopeText(R,'',R.account_requirements.selection);
}
function requirementsFields(R,draft){
  var options=R.account_requirements.periods.map(period=>[period.start,period.start+' to '+period.end]);
  return observedSelect("g-requirements-mode","Effective period",options.concat([["manual","Manual range"]]),draft.mode)
    +chartDateField("g-requirements-start","From",draft.start,R.scope.start,R.scope.end)
    +chartDateField("g-requirements-end","Until",draft.end,R.scope.start,R.scope.end);
}
function syncRequirementsDates(filter){
  var draft=filter.draft,period=filter.result.account_requirements.periods.find(row=>row.start===draft.mode);
  for(var key of ["start","end"]){
    var field=document.getElementById("g-requirements-"+key);
    if(period){draft[key]=period[key];field.value=period[key];}
    field.disabled=draft.mode!=="manual";
  }
}
function requirementsPreview(R,draft){
  var valid=!!(draft.start&&draft.end&&R.scope.start<=draft.start&&draft.start<=draft.end&&draft.end<=R.scope.end);
  return {valid,text:valid?draft.start+' to '+draft.end:'Choose ordered dates within the Cockpit analysis range.'};
}
function requirementsVerdict(period){
  if(!requirementsTarget(period))return "—";
  if(period.gap===0)return "On target";
  return period.target_met?"Meets target":"Misses target";
}
function requirementsTarget(period){
  return Number.isFinite(period?.target)&&typeof period.target_met==='boolean';
}
function lockedGuideCells(cells){
  return '<dl class="g-guide-ranges g-locked-guide-ranges">'+cells.map(([label,tone,description,active])=>
    '<div class="g-guide-'+tone+(active?' g-guide-active':'')+'"><dt>'+label+'</dt>'
    +(description?'<dd>'+description+'</dd>':'')+(active?'<dd>Current result'+(typeof active==='string'?' · '+active:'')+'</dd>':'')
    +'</div>').join('')+'</dl>';
}
function requirementsGuide(R){
  var assessment=R.account_requirements.assessment,periods=assessment.periods;
  var period=assessment.status==='published'&&assessment.overall?.classified?periods[0]:null;
  var rules=new Set(periods.filter(requirementsTarget).map(p=>p.target_rule));
  var actual='<span class="g-guide-mark-label">Actual '+insightMark('actual')+'</span>';
  var target='<span class="g-guide-mark-label">Target '+insightMark('target')+'</span>';
  var targetSection='<p>'+esc(assessment.reason||'No account target applies to these dates.')+'</p>';
  if(rules.size){
    var higher=rules.has('at_or_above'),meets=higher?'right':'left',misses=higher?'left':'right';
    var cells=[
      ['Meets the target','favorable',rules.size===1?'When the '+actual+' is at or to the '+meets+' of the '+target+'.':'An Actual that meets the rule for its period.',requirementsTarget(period)&&period.target_met&&(period.gap===0?'On target':true)],
      ['Misses the target','adverse',rules.size===1?'When the '+actual+' is to the '+misses+' of the '+target+'.':'An Actual that misses the rule for its period.',requirementsTarget(period)&&!period.target_met]
    ];
    targetSection='<p class="g-requirement-guide-key">'+actual+' · '+target+'</p>'+lockedGuideCells(higher&&rules.size===1?cells.reverse():cells)
      +'<p>An exact match is on target.</p>';
  }
  var specification='';
  if(typeof period?.specification?.conforms==='boolean'){
    var status=period.specification.conforms?'Within specification limits':limitText(period);
    specification='<p class="g-requirement-specification g-guide-active"><strong>Specification.</strong> '
      +esc(requirementsLimits(period))+'. '+esc(status)+' · Current result.</p>';
  }
  if(periods.some(p=>Number.isFinite(p.specification?.lower)||Number.isFinite(p.specification?.upper))){
    specification+='<p>'+(!specification?'<strong>Specification.</strong> ':'')+'A value exactly on a supplied limit is within specification.</p>';
  }
  return '<h4>Target attainment and specification limits</h4>'+targetSection+specification
    +(periods.length>1?'<p>See Table for the target and specification limits that apply in each period.</p>':'');
}
function requirementsGuidePages(R){
  var {variation,capability}=R.account_requirements.checks;
  return [requirementsGuide(R),
    '<h4>Variation · VSF</h4>'+lockedGuideCells([
      ['1.00 or above','adverse','Excessive variation',variation.rating==='high'],
      ['0.70 to below 1.00','caution','Potential variation issue',variation.rating==='acceptable'],
      ['Below 0.70','favorable','Low measured variation',variation.rating==='low']
    ])+'<p>Lower VSF (Variance Significance Factor) is favorable.</p><p>VSF describes the spread of scores relative to the KPI’s average.</p>',
    '<h4>Capability · Sigma level and Yield</h4>'+lockedGuideCells([
      ['− 2.5 sigma','adverse','− 84.1% yield',capability.on_target===false],
      ['<span aria-label="At or above the exact 2.5 sigma cutoff">+ 2.5 sigma</span>','favorable','+ 84.1% yield',capability.on_target===true]
    ])+'<p>A sigma level greater than 2.5 is favorable.</p><p>A yield greater than 84.1% is favorable.</p>'
      +'<p>Exactly 2.5 also meets the guide. The corresponding yield of 84.1% is rounded.</p>'
  ];
}
function requirementsTable(periods,evidence=false){
  if(!periods.length)return '';
  var headers=['Period','Actual','Target','Target verdict',...(evidence?['Gap']:[]),'Lower limit','Upper limit','Specification result'];
  if(evidence)headers.push(gCountLabel());
  return '<div class="scroll g-requirements-table" tabindex="0" aria-label="Account requirements by period"><table><thead><tr>'
    +headers.map(label=>'<th scope="col">'+esc(label)+'</th>').join('')+'</tr></thead><tbody>'
    +periods.map((p,index)=>'<tr'+(evidence?' id="g-requirement-period-'+index+'"':'')+'><th scope="row">'
      +periodLabel(p)+'</th>'
      +[requirementsValue(p.value,p),requirementsValue(p.target,p),requirementsVerdict(p),
        ...(evidence?[Number.isFinite(p.gap)?insSignedGap(p.gap):'—']:[]),requirementsValue(p.specification?.lower,p),
        requirementsValue(p.specification?.upper,p),p.specification?.conforms===true?'Within specification limits':p.specification?limitText(p):'—',
        ...(evidence?[n0(p.count)]:[])].map(value=>'<td>'+esc(value)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
}
function requirementsLimits(period){
  var {lower,upper}=period.specification;
  if(Number.isFinite(lower)&&Number.isFinite(upper))return requirementsValue(lower,period)+'–'+requirementsValue(upper,period);
  if(Number.isFinite(lower))return 'Lower limit '+requirementsValue(lower,period);
  return 'Upper limit '+requirementsValue(upper,period);
}
function requirementsValue(value,period){
  if(!Number.isFinite(value))return '—';
  var neighbors=[period.value,period.target,period.specification?.lower,period.specification?.upper]
    .filter(other=>Number.isFinite(other)&&other!==value&&fcValue(other)===fcValue(value));
  if(!neighbors.length)return fcValue(value);
  var factor=metricKind()==='seconds'?durationFactor():1,shown=value/factor;
  for(var digits=2;digits<=12;digits++){
    var rounded=shown.toFixed(digits);
    if(neighbors.every(other=>(other/factor).toFixed(digits)!==rounded))
      return displayNumber(shown,digits)+' '+durationUnitSymbol();
  }
  return shown.toString()+' '+durationUnitSymbol();
}
var readingDetail=null;
function closeReadingDetail(){
  readingDetail?.remove();
  readingDetail=null;
}
function showReadingDetail(mark,event){
  closeReadingDetail();
  var plot=mark.closest('.dt-plot'),chip=mark.querySelector('.dt-marker-chip');
  var tip=document.createElement('span'),anchor=(chip||mark).getBoundingClientRect();
  tip.className='g-reading-detail';
  if(plot||mark.matches('.dt-gap-point'))tip.setAttribute('data-daily-detail','');
  tip.textContent=(event.type==='pointerover'&&mark.dataset.readingPointer)||mark.dataset.readingDetail;
  tip.setAttribute('aria-hidden','true');
  tip.setAttribute('popover','manual');
  (plot||mark).after(tip);
  tip.runPlot=mark.closest('.dt-plot,.g-stability-plot');
  tip.showPopover();
  readingDetail=tip;
  var {width,height}=tip.getBoundingClientRect();
  var x=event.type==='pointerover'?event.clientX:anchor.left+anchor.width/2;
  var y=event.type==='pointerover'?event.clientY:anchor.bottom;
  var container=mark.closest('.g-modal-scroll-pane')?.getBoundingClientRect();
  var left=Math.max(0,container?.left??0),right=Math.min(innerWidth,container?.right??innerWidth);
  var top=Math.max(0,container?.top??0),bottom=Math.min(innerHeight,container?.bottom??innerHeight);
  var zoom=tip.currentCSSZoom||1;
  if(plot||mark.matches('.dt-gap-point')){
    const beside=anchor.right+6+width<=right-8?anchor.right+6:anchor.left-6-width;
    const fits=chip&&beside>=left+8;
    const above=anchor.top-6-height;
    const topY=fits?(anchor.top+anchor.bottom-height)/2:(chip||!plot)&&above>=top+8?above:anchor.bottom+6;
    tip.style.left=Math.max(left+8,Math.min(fits?beside:anchor.left,right-width-8))/zoom+'px';
    tip.style.top=Math.max(top+8,Math.min(topY,bottom-height-8))/zoom+'px';
    return;
  }
  tip.style.left=Math.max(left+8,Math.min(x+12,right-width-8))/zoom+'px';
  tip.style.top=Math.max(top+8,y+12+height<=bottom?y+12:Math.min(anchor.top,y)-height-8)/zoom+'px';
}
for(var name of ['pointerover','focusin','pointerout','focusout']){
  document.addEventListener(name,event=>{
    var mark=event.target.closest?.('[data-reading-detail]');
    if(!mark||mark.contains(event.relatedTarget))return;
    if(event.type==='pointerover'||event.type==='focusin')showReadingDetail(mark,event);
    else closeReadingDetail();
  });
}
document.addEventListener('keydown',event=>{
  if(event.key!=='Escape')return;
  if(readingDetail?.isConnected){
    readingDetail.runPlot?.resetRunReference?.();
    closeReadingDetail();
    event.stopImmediatePropagation();
    event.preventDefault();
  }else if(!chartFilter&&!document.querySelector('.g-guide.is-open')){
    const active=document.querySelector('svg[data-reference-inspected]');
    if(active){
      active.closest('.dt-plot,.g-stability-plot')?.resetRunReference?.();
      event.stopImmediatePropagation();
      event.preventDefault();
    }
  }
},true);
function readingDetailAttributes(label,pointerLabel){
  return ' aria-label="'+esc(label)+'" data-reading-detail="'+esc(label)+'"'
    +(pointerLabel?' data-reading-pointer="'+esc(pointerLabel)+'"':'');
}
function requirementDirection(period,low,high,pos){
  var lower=period.specification?.lower,upper=period.specification?.upper;
  var target=Number.isFinite(period.target)&&typeof period.target_met==="boolean";
  var {start,end,inside:band,tails}=businessScaleBands({lower,upper,target:target?period.target:null,rule:period.target_rule},low,high);
  var eligible=band.filter(part=>period.value>=part.from&&period.value<=part.to);
  var current=target&&period.value===period.target
    ?eligible.find(part=>part.good):eligible.at(-1);
  var span=(from,to)=>'left:'+pos(from)+'%;width:'+(pos(to)-pos(from))+'%';
  var shaft=start===end?'<span class="g-spec-point" style="left:'+pos(start)+'%"></span>'
    :'<div class="g-requirement-direction-fill" style="'+span(start,end)+'">'
      +band.map(part=>'<span style="width:'+((part.to-part.from)/(end-start)*100)+'%;background:'+part.color+'"></span>').join('')+'</div>';
  var head='min(15px, '+((pos(end)-pos(start))/4)+'%)';
  var extensions=tails.map(({from,to,color})=>{
    var left=from===end?'calc('+pos(from)+'% - '+head+')':pos(from)+'%';
    var width='calc('+(pos(to)-pos(from))+'% + '+head+')';
    return '<span class="g-spec-tail" style="left:'+left+';width:'+width+';background:'+color+'"></span>';
  }).join('');
  var chart='<div class="g-requirement-direction" aria-hidden="true">'
    +extensions+shaft
    +(current?.good!==undefined?'<span class="is-current" style="'+span(current.from,current.to)+'"></span>':'')+'</div>';
  if(start===end)return {chart,key:''};
  var relative=value=>100*(value-start)/(end-start)+'%';
  var stops=band.map(part=>part.color+' '+relative(part.from)+' '+relative(part.to));
  return {chart,key:'<i class="g-requirement-arrow-key" aria-hidden="true" style="background:linear-gradient(90deg,'+stops.join(',')+')"></i>'};
}
function requirementsGraphic(periods,weighted,direction){
  var rows=(periods.length?periods:[{value:weighted.value}]).filter(p=>Number.isFinite(p.value));
  var refs=rows.flatMap(p=>[p.value,p.target,p.specification?.lower,p.specification?.upper]).filter(Number.isFinite);
  if(!refs.length)return '<p>No eligible results for the selected dates.</p>';
  var low=Math.min(...refs),high=Math.max(...refs),padding=Math.max((high-low)*.1,Math.abs(high)*.03,.01);
  low=low>=0?Math.max(0,low-padding):low-padding;high+=padding;
  var pos=value=>100*((value-low)/(high-low));
  var factor=durationFactor(),rough=(high-low)/6/factor,scale=10**Math.floor(Math.log10(rough));
  var step=[1,2,5,10].find(multiplier=>multiplier*scale>=rough)*scale*factor;
  var ticks='';
  for(var tick=Math.ceil(low/step);tick<=Math.floor(high/step);tick++){
    var reading=tick*step,x=pos(reading);
    if(x>=3&&x<=97)ticks+='<span style="--position:'+x+'%">'+esc(chartValue(reading,step))+'</span>';
  }
  var unit=durationUnit()==='points'?'points':durationUnitSymbol();
  var axis='<div class="g-requirement-scale">'+ticks+'</div><span class="g-requirement-axis-unit">'+esc(ML()+' ('+unit+')')+'</span>';
  return rows.map(p=>{
    var lower=p.specification?.lower,upper=p.specification?.upper;
    var bounds=Number.isFinite(lower)||Number.isFinite(upper);
    var value=v=>requirementsValue(v,p);
    var arrow=requirementDirection(p,low,high,pos),target=requirementsTarget(p);
    var actualDetail='Actual · '+value(p.value)+(rows.length>1?' · '+periodLabel(p):'')
      +(typeof p.specification?.conforms==='boolean'?' · '+(p.specification.conforms?'Within':'Outside')+' specification limits':'');
    var targetDetail=target?'Target · '+value(p.target)+' · effective from '+p.effective_start
      +(p.effective_end?' until '+p.effective_end+' (exclusive)':''):'';
    var directionLabel=bounds||target?'Favorable direction':direction==='monitor_only'?'Monitoring only':'';
    var key=(label,mark,detail=label)=>'<li><button type="button" class="g-requirement-key"'
      +readingDetailAttributes(detail)+'>'+esc(label)+mark+'</button></li>';
    var legend='<ul class="g-chart-legend" aria-label="Chart legend">'+key('Actual',insightMark('actual'),actualDetail)
      +(target?key('Target',insightMark('target'),targetDetail):'')
      +(bounds?key('Within specification limits','<i class="g-requirement-band-key" aria-hidden="true"></i>')
        +key('Outside specification limits','<i class="g-requirement-track-key" aria-hidden="true"></i>')
        :key('Displayed scale','<i class="g-requirement-track-key" aria-hidden="true"></i>'))
      +(directionLabel&&arrow.key?key(directionLabel,arrow.key):'')+'</ul>';
    var hit=(left,right,label,mark='')=>'<button type="button" class="g-requirement-hit '+mark+'" style="left:'+pos(left)
      +'%;right:'+(100-pos(right))+'%"'+readingDetailAttributes(label)+'></button>';
    var band=bounds?(Number.isFinite(lower)?hit(low,lower,'Outside specification limits'):'')
      +hit(lower??low,upper??high,'Within specification limits','g-requirement-band')
      +(Number.isFinite(upper)?hit(upper,high,'Outside specification limits'):''):hit(low,high,'Displayed scale');
    var references=[['Actual',p.value,'g-insight-actual','var(--insight-actual-color)'],['Target',target?p.target:null,'g-insight-target','var(--amber-600)'],
      ['Lower limit',lower,'g-requirement-limit','var(--teal-600)'],['Upper limit',upper,'g-requirement-limit','var(--teal-600)']]
      .filter(([,value])=>Number.isFinite(value));
    var labels='<div class="g-requirement-labels" aria-hidden="true">'+references.map(([label,reading,mark,color])=>{
      var position=pos(reading),style='--position:'+position+'%;--mark-color:'+color;
      return '<i class="g-requirement-leader" style="'+style+'"></i><span class="g-requirement-label" data-position="'
        +position+'" style="'+style+'">'+esc(label+' '+value(reading))+'</span>';
    }).join('')+'</div>';
    return '<div class="g-requirement-reading">'+(rows.length>1&&p.first_date?'<h4>'+periodLabel(p)+'</h4>':'')
      +legend+'<div class="g-requirement-plot"><div class="g-requirement-track">'+band
      +references.map(([label,reading,mark])=>{
        var detail=label==='Actual'?actualDetail:label==='Target'?targetDetail:label+' · '+value(reading);
        var overlap=label==='Actual'&&target&&reading===p.target?actualDetail+' · '+targetDetail:null;
        if(label==='Lower limit'||label==='Upper limit')return '<span class="g-requirement-mark '+mark+'" role="img" aria-label="'+esc(detail)+'" style="--position:'+pos(reading)+'%"></span>';
        return '<button type="button" class="g-requirement-mark '+mark+'" style="--position:'+pos(reading)
          +'%;"'+readingDetailAttributes(detail,overlap)+'></button>';
      }).join('')+'</div>'
      +labels+axis+arrow.chart+'</div></div>';
  }).join('');
}
function placeRequirementLabels(area){
  var width=area.clientWidth;
  if(!width)return;
  var lanes=[],height=0;
  for(var label of area.querySelectorAll('.g-requirement-label')){
    var center=Number(label.dataset.position)*width/100,size=label.offsetWidth;
    height=Math.max(height,label.offsetHeight);
    var left=Math.max(0,Math.min(center-size/2,width-size)),right=left+size;
    var lane=lanes.findIndex(items=>items.every(item=>right+4<=item.left||left>=item.right+4));
    if(lane===-1){lane=lanes.length;lanes.push([]);}
    lanes[lane].push({left,right});
    label.style.setProperty('--label-left',left+'px');
    label.style.setProperty('--label-lane',lane);
    label.previousElementSibling.style.setProperty('--label-lane',lane);
  }
  area.style.setProperty('--label-step',height+4+'px');
  area.style.setProperty('--label-lanes',lanes.length);
}
function requirementsChecksEvidence(checks,assessment){
  var {variation,capability,coverage}=checks;
  var reasons={
    'DESCRIPTIVE-SCORE':'The configured point score is descriptive.',
    'SCORE-COUNTS-UNAVAILABLE':'The agent-day file does not establish how many scores were observed.',
    'NOT-RATIO-SCALE':'VSF does not apply to this metric.',
    'TOO-FEW':'There are too few qualifying readings for VSF.',
    'NON-POSITIVE-MEAN':'VSF requires a positive mean.',
    'SINGLE-REQUIREMENT-NEEDED':'A single effective requirement must cover the applied dates.',
    'TOO-FEW-AGENTS':'Yield and sigma require at least 12 eligible agents.',
    'SHORT-HISTORY':'Yield and sigma require at least 12 weeks of relevant observed history.',
    'NO-CAPABILITY-COMPARISON':'Yield requires an applicable target or a configured comparison against both bounds.',
    'ALL-MEET':'All eligible agents meet the comparison. There is no finite sigma level.',
    'NONE-MEET':'No eligible agent meets the comparison. There is no finite sigma level.'
  };
  var variationText=variation.reason?(reasons[variation.reason]||'VSF is unavailable for these dates.')
    :'VSF uses '+n0(variation.n)+' weighted '+(variation.basis==='agent'?'agent':'daily')+' readings.';
  var notes=new Set([variationText]);
  if(capability.reason)notes.add(reasons[capability.reason]||assessment.reason||'Yield and sigma are unavailable for these dates.');
  if(Number.isFinite(coverage.eligible_agents)){
    notes.add(n0(coverage.eligible_agents)+' agents had at least five eligible observations each. '
      +n0(coverage.below_agent_floor)+' were below that floor. The eligible agents’ observations span '
      +n0(coverage.history_days)+' calendar days.');
    if(coverage.unattributed_weight)notes.add(n0(coverage.unattributed_weight)+' eligible observations have no agent attribution and are excluded from agent-based checks.');
  }
  if(variation.rating!=='high'&&capability.on_target!==false)notes.add('An overall capability verdict requires all three checks, including qualified Stability.');
  return '<h4>Coverage and availability</h4>'+[...notes].map(note=>'<p>'+esc(note)+'</p>').join('');
}
function requirementsPanel(R,evidence=false){
  var result=R.account_requirements,weighted=result.weighted,assessment=result.assessment;
  var {variation,capability}=result.checks;
  var periods=assessment.periods.length?[...assessment.periods].sort((a,b)=>a.first_date.localeCompare(b.first_date))
    :[{...weighted,first_date:result.selection.start,last_date:result.selection.end}];
  var metric='Weighted '+(metricId()==='aht'?ml():ML());
  var assessments=periods.map(p=>{
    var onTarget=requirementsTarget(p);
    var target=onTarget?(p.gap===0?'is on target':p.target_met?'meets the target':'does not meet the target'):'';
    var spec=p.specification;
    var limit=typeof spec?.conforms==='boolean'?(spec.conforms?'within specification limits':limitText(p).toLowerCase()):'';
    var prefix=periods.length>1?periodLabel(p)+' · ':'';
    if(target&&limit)return prefix+metric+' '+target+(p.target_met===false&&spec.conforms?' but is still ':' and is ')+limit+'.';
    if(target||limit)return prefix+metric+' '+(target||'is '+limit)+'.';
    return prefix?prefix+'No applicable requirement.':'';
  }).filter(Boolean);
  var answers=assessments.length?assessments:[assessment.reason||'No account target or specification limit applies to these dates.'];
  var capabilityMisses=[];
  if(capability.on_target===false)capabilityMisses.push(capability.comparison==='specification'?'low specification yield':'low target yield');
  if(variation.rating==='high')capabilityMisses.push('high variation');
  if(capabilityMisses.length)answers.push('Current performance falls short on capability, with '+capabilityMisses.join(' and ')+'.');
  var periodFacts=periods.map(p=>{
    var facts=[],spec=p.specification,value=v=>requirementsValue(v,p);
    if(requirementsTarget(p)){
      var verdict=p.gap===0?'is on target':p.target_met?'meets the target':'does not meet the target';
      facts.push(metric+' '+verdict+' ('+value(p.target)+') with a gap of '+insSignedGap(p.gap)+'.');
    }
    if(typeof spec?.conforms==='boolean'){
      var conformance=spec.conforms?'within specification limits':limitText(p).toLowerCase();
      facts.push(metric+' is '+conformance+' ('+requirementsLimits(p)+').');
    }
    if(periods.length===1)return facts.map(fact=>'<li>'+esc(fact)+'</li>').join('');
    return '<li>'+esc(periodLabel(p)+' · Actual '+value(p.value))
      +(facts.length?'<ul>'+facts.map(fact=>'<li>'+esc(fact)+'</li>').join('')+'</ul>':'')+'</li>';
  }).join('');
  var checkFacts=[];
  if(Number.isFinite(variation.value)){
    var label={low:'Low',acceptable:'Potential variation issue with',high:'High'}[variation.rating];
    checkFacts.push(label+' VSF at '+displayNumber(variation.value,2,7)+'.');
  }
  if(Number.isFinite(capability.yield)){
    var yieldName=capability.comparison==='specification'?'Specification yield':'Target yield';
    var endpoint=capability.reason==='ALL-MEET'?' · All meet':capability.reason==='NONE-MEET'?' · None meet':'';
    checkFacts.push(yieldName+' at '+displayNumber(capability.yield*100,1,5)+'%'+endpoint+'.');
  }
  if(Number.isFinite(capability.sigma))checkFacts.push('Sigma level at '+displayNumber(capability.sigma,1,7)+'.');
  var factsHtml='<h4>Facts</h4><ul>'+(Number.isFinite(weighted.value)?'<li>'
    +esc(metric+' is at '+requirementsValue(weighted.value,periods.length===1?periods[0]:weighted)+'.')
    +(periodFacts?'<ul>'+periodFacts+'</ul>':'')+'</li>':'')
    +(checkFacts.length?'<li>Capability checks for the current period.<ul>'+checkFacts.map(fact=>'<li>'+esc(fact)+'</li>').join('')+'</ul></li>':'')
    +(evidence?'':chartPeriodFact(result.selection))+'</ul>';
  if(evidence)return '<h3>Account requirements</h3><p>'+esc(requirementsScope(R))+'</p>'
    +answers.map(answer=>'<p>'+esc(answer)+'</p>').join('')+(Number.isFinite(weighted.value)?factsHtml:'')+'<p>'+n0(weighted.count)+' '
    +esc(gCountLabel(R).toLowerCase())+' in the selected dates.</p>'+requirementsTable(periods,true)
    +(R.configuration||R.target_mapping_source==='analysis_setup'?'<button type="button" class="g-linkbtn" data-chapter="g-evidence-calculation">See requirement definitions and configuration in Technical evidence</button>':'')
    +(assessment.limitations||[]).map(item=>'<p>'+esc(item)+'</p>').join('')+scoreCutoffBasis(R)
    +requirementsChecksEvidence(result.checks,assessment);
  var state=observedState(R);
  var visual='<div class="g-observed-filters">'+reportChartControls("requirements",state)+'</div>'
    +'<h4 class="g-insights-chart-title">'+esc(metric+' ('+(durationUnit()==='points'?'points':durationUnitSymbol())+') against account requirements')+'</h4>'
    +'<div class="g-insights-labeled-chart">'
    +(state.requirementsView==="table"?requirementsTable(periods):requirementsGraphic(periods,weighted,R.analysis_setup?.direction||R.metric?.direction))+'</div>';
  return '<section id="g-requirements-panel" class="g-chart-container-box">'+gSlideResult(
    gSlideTakeaway(answers,factsHtml+'<button type="button" class="g-linkbtn" data-chapter="g-requirements-evidence">See account requirements in Evidence</button>'),visual,true)+'</section>';
}
function stabilityDates(R){
  var state=observedState(R);
  return {stabilityStart:state.stabilityStart||R.scope.start,stabilityEnd:state.stabilityEnd||R.scope.end};
}
function stabilityFields(R,draft){
  return chartDateField('g-stability-start','From',draft.stabilityStart,R.scope.start,R.scope.end)
    +chartDateField('g-stability-end','Until',draft.stabilityEnd,R.scope.start,R.scope.end);
}
function stabilityPreview(R,draft){
  var {stabilityStart:start,stabilityEnd:end}=draft;
  var valid=!!(start&&end&&R.scope.start<=start&&start<=end&&end<=R.scope.end);
  if(!valid)return {valid,text:'Choose ordered dates within the Cockpit analysis range.'};
  var weeks=stabilityWeeks(R,draft),eligible=weeks.filter(w=>Number.isFinite(w.value)).length;
  return {valid,text:eligible?eligible+' of '+weeks.length+' complete weeks have eligible readings.'
    :weeks.length?'No eligible readings in these complete weeks.':'No complete Monday–Sunday week falls within these dates.'};
}
function stabilityWeeks(R,dates=stabilityDates(R)){
  var assessment=R.target_assessment;
  var account=R.metric?.metric_id==='aht'?R.daily_references?.account:null;
  var periods=account?account.intervals.map(interval=>({...interval,rule:interval.target_rule,
    lower:interval.lower_specification_limit,upper:interval.upper_specification_limit}))
    :assessment?.status==='published'?assessment.periods.filter(requirementsTarget).map(period=>({...period,rule:period.target_rule})):[];
  return (R.forecast?.history||[]).flatMap((week,index,history)=>{
    var end=stabilityWeekEnd(week.start);
    if(week.start<dates.stabilityStart||end>dates.stabilityEnd)return [];
    var reference=periods.find(p=>p.effective_start<=week.start&&(!p.effective_end||end<p.effective_end));
    var prior=history[index-1],result=R.stability?.readings?.[index];
    var pair=Number.isFinite(prior?.value)&&Number.isFinite(week.value)?[[prior.start,prior.value],[week.start,week.value]]:null;
    return [{...week,end,reference,...(result||{hits:[],range:pair?Math.abs(week.value-prior.value):null,pair})}];
  });
}
function stabilityWeekEnd(start){
  var sunday=new Date(start+'T00:00:00Z');
  sunday.setUTCDate(sunday.getUTCDate()+6);
  return sunday.toISOString().slice(0,10);
}
function stabilitySelection(R){
  var weeks=stabilityWeeks(R),eligible=weeks.filter(w=>Number.isFinite(w.value)),flagged=eligible.filter(w=>w.hits.length);
  return {weeks,eligible,flagged,rangeSignals:flagged.filter(w=>w.hits.some(hit=>hit.chart==='moving_range')),
    rate:R.stability?.status==='assessed'&&eligible.length?flagged.length/eligible.length:null};
}
var STABILITY_TESTS=[['Extreme Outlier / Spike','One plotted value falls outside its applicable limits'],
  ['Sustained Shift','Nine values in a row on one side of the center line'],['Trend / Drift','Six values rising or falling in sequence'],
  ['Oscillation (Sawtooth)','Fourteen values alternating up and down'],['Early Warning Shift','Two of three values beyond 2σ on one side'],
  ['Small Sustained Shift','Four of five values beyond 1σ on one side'],['Stratification (Hugging the Mean)','Fifteen values in a row within 1σ'],
  ['Mixture (Avoiding the Mean)','Eight values in a row more than 1σ from the center line']];
function stabilityPattern(hit){return STABILITY_TESTS[hit.test-1][0];}
function stabilityTest(hit){return (hit.chart==='moving_range'?'Moving Range':'Individuals')+' Test '+hit.test;}
function stabilityPercent(rate){
  var percent=rate*100;
  if(rate===0)return '0%';
  return (percent<5&&Number(percent.toFixed(1))===5?String(percent):displayNumber(percent,1))+'%';
}
function stabilityScope(R){
  var {stabilityStart:start,stabilityEnd:end}=stabilityDates(R);
  return {start,end};
}
function stabilityWeekEvents(R,weeks){
  var byWeek=new Map();
  if(!R.calendar_events?.length||(R.metric?.metric_id==='aht'&&!dailyEventSourceCurrent(R)))return byWeek;
  var lines=new Set(R.scope.lines_of_business);
  for(var event of R.calendar_events){
    if(!event.lines_of_business.some(line=>lines.has(line)))continue;
    var week=weeks.find(reading=>Number.isFinite(reading.value)&&reading.start<=event.date&&event.date<=reading.end);
    if(!week)continue;
    if(!byWeek.has(week.start))byWeek.set(week.start,[]);
    byWeek.get(week.start).push(event);
  }
  return byWeek;
}
function stabilityDot(state=''){
  return '<i class="g-insight-actual g-stability-dot '+state+'" aria-hidden="true"></i>';
}
function stabilityGuidePages(R){
  var {weeks,flagged,rate}=stabilitySelection(R);
  var dot=state=>stabilityDot('g-stability-inline-mark '+state);
  var sample=(label,dot,lines,signal=false)=>'<span class="g-stability-guide-sample" aria-hidden="true">'
    +lines.map(y=>'<i class="g-stability-guide-limit" style="top:'+y+'px"></i>').join('')
    +'<i class="g-insight-actual g-stability-dot'+(signal?' g-stability-guide-signal':'')+'" style="top:'+dot+'px"></i></span>'+label;
  var target=weeks.some(week=>Number.isFinite(week.reference?.target))
    ?'<p>The dashed '+insightMark('target')+' Target is a business reference for its effective dates.</p>':'';
  var specifications=weeks.some(week=>Number.isFinite(week.reference?.lower)||Number.isFinite(week.reference?.upper))
    ?'<p>Teal dashes show business specification limits on Individuals. Red extensions are outside those requirements. Statistical control limits govern stability signals separately.</p>':'';
  var pages=['<h4>Run charts</h4>'+lockedGuideCells([[sample('Between limits',17,[5,29]),'favorable'],
      [sample('Above upper limit',8,[24],true),'adverse'],[sample('Below lower limit',25,[10],true),'adverse']])
    +'<p>Hollow points '+dot('')+' show readings. A filled point '+dot('is-event')+' on Individuals marks a week with a recorded event.</p>'
    +'<p>A coral ring '+dot('g-stability-guide-signal')+' marks an out-of-control signal on the chart. A point can have both marks.</p>'
    +'<p>Points above the upper limit or below the lower limit exceed the expected range of movement for in-control performance.</p>'
    +'<p>A pattern test can also flag a point between the limits.</p>'+target+specifications,
    '<h4>Stability scale</h4>'+lockedGuideCells([['Less than 5%','favorable','',rate!==null&&rate<.05],['5% or more','adverse','',rate!==null&&rate>=.05]])
    +'<p>Less than 5% out-of-control data points in the analyzed data period is favorable.</p>'
    +'<p>The rate needs eligible evaluations. A qualifying signal can still indicate instability in the favorable rate band.</p>'];
  if(flagged.length){
    var fired=new Set(flagged.flatMap(w=>w.hits.map(hit=>hit.test)));
    var rows=STABILITY_TESTS.filter((_,index)=>fired.has(index+1));
    pages.push('<h4>Out-of-control tests</h4><div class="scroll g-requirements-table g-stability-tested" tabindex="0" role="region" aria-label="Tests with flags"><table><colgroup><col><col></colgroup><thead><tr>'
      +'<th scope="col">Test pattern</th><th scope="col">What it flags</th></tr></thead><tbody>'
      +rows.map(([name,description])=>'<tr><th scope="row">'+esc(name)+'</th><td>'+esc(description)+'</td></tr>').join('')
      +'</tbody></table></div><p>A test flag identifies a week or change to investigate.</p>');
  }
  return pages;
}
function stabilityMetricAxis(){
  return 'Weighted '+(metricId()==='aht'?'AHT':ML())+' ('+(durationUnit()==='points'?'points':durationUnitSymbol())+')';
}
function stabilityMark(kind){return '<i class="g-stability-'+kind+'-key" aria-hidden="true"></i>';}
function stabilityLabel(label,left,centerY,width,kind){
  return '<g class="g-stability-label is-'+kind+'"><rect x="'+left+'" y="'+(centerY-9)+'" width="'+width
    +'" height="18" rx="3"/><text class="gc-tick" x="'+(left+width/2)+'" y="'+(centerY+4)+'" text-anchor="middle">'+esc(label)+'</text></g>';
}
function stabilitySignalLabels(signals){
  var rows=[],lowerLanes=0,upperLanes=0;
  var labels=signals.map(signal=>{
    var row=rows.find(row=>row.edge+6<=signal.boxLeft);
    if(!row){
      var above=lowerLanes>upperLanes;
      row={above,lane:above?upperLanes++:lowerLanes++};
      rows.push(row);
    }
    row.edge=signal.boxLeft+signal.boxWidth;
    return {...signal,lane:row.lane,above:row.above};
  });
  return {labels,lowerLanes,upperLanes};
}
function stabilityPlotContent(R,weeks,moving,width,style){
  var key=moving?'range':'value',chart=moving?'moving_range':'individuals';
  var values=weeks.map(week=>week[key]).filter(Number.isFinite);
  if(!values.length)return {markup:'<p>No eligible complete weeks are available for this scope.</p>',spans:[]};
  var useScale=!moving&&R.metric?.metric_id==='aht';
  var gutter=useScale&&weeks.some(week=>week.reference)?40:0;
  var top=18,bottom=227,context=document.createElement('canvas').getContext('2d');
  var detailFont=style.getPropertyValue('--font-chart-detail'),axisFont=style.getPropertyValue('--font-size-chart');
  var measure=(text,size)=>{context.font=size+' '+style.fontFamily;return Math.ceil(context.measureText(text).width);};
  var assessment=R.stability,limits=moving?assessment?.moving_range_limits:assessment?.individuals_limits;
  var controls=limits?[[limits[0],'Lower limit','limit'],[limits[1],'Upper limit','limit'],
    [moving?assessment.baseline.mr_center:assessment.baseline.center,'Center','center']]:[];
  var refs=[...controls.map(ref=>ref[0]),...weeks.flatMap(week=>!moving&&week.reference?
    [week.reference.target,week.reference.lower,week.reference.upper].filter(Number.isFinite):[])];
  var min=Math.min(...values,...refs),max=Math.max(...values,...refs),pad=Math.max((max-min)*.12,Math.abs(max)*.015,.01);
  var factor=durationFactor(),rough=(max-min+2*pad)/6/factor;
  var quantum=10**Math.floor(Math.log10(rough/2))*factor;
  var low=moving?0:Math.floor((min-pad)/quantum)*quantum;
  var unitStep=Math.ceil((max+pad-low)/6/quantum)*quantum;
  var high=low+6*unitStep;
  var referenceWidth=Math.max(0,...controls.map(([value,name])=>measure(name+' '+durationNumber(value,false),detailFont)),
    ...weeks.flatMap(week=>!moving&&Number.isFinite(week.reference?.target)?[measure('Target '+durationNumber(week.reference.target,false),detailFont)]:[]));
  var left=gutter+Math.max(52,30+Math.max(...Array.from({length:7},(_,i)=>measure(chartValue(low+i*unitStep,unitStep),axisFont))));
  var right=width-Math.max(22,referenceWidth?referenceWidth+24:26);
  var x=i=>weeks.length===1?(left+right)/2:left+(right-left)*i/(weeks.length-1);
  var spanYears=weeks[0].end.slice(0,4)!==weeks.at(-1).end.slice(0,4);
  var tickDate=new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',...(spanYears?{year:'2-digit'}:{}),timeZone:'UTC'});
  var signalDate=new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',timeZone:'UTC'});
  var dateSpacing=Math.max(...weeks.map(week=>measure(tickDate.format(new Date(week.end+'T00:00:00Z')),axisFont)))+12;
  var signals=[];
  weeks.forEach((week,index)=>{
    if(!Number.isFinite(week[key])||!week.hits.some(hit=>hit.chart===chart))return;
    var at=x(index),weekLabel=(signals.length+1)+'. Wk '+signalDate.format(new Date(week.end+'T00:00:00Z'));
    var boxWidth=measure(weekLabel,detailFont)+10,boxLeft=Math.max(left,Math.min(right-boxWidth,at-boxWidth/2));
    signals.push({weekLabel,boxWidth,boxLeft,at,index});
  });
  var {labels,lowerLanes,upperLanes}=stabilitySignalLabels(signals);
  if(upperLanes){var strip=4+upperLanes*22;top+=strip;bottom+=strip;}
  var y=value=>top+(bottom-top)*(high-value)/(high-low);
  var plot='';
  for(var i=0;i<7;i++){
    var value=low+i*unitStep;
    plot+='<line class="g-stability-grid" x1="'+left+'" x2="'+right+'" y1="'+y(value)+'" y2="'+y(value)+'"/>'
      +'<text class="gc-tick" x="'+(left-8)+'" y="'+(y(value)+4)+'" text-anchor="end">'+esc(chartValue(value,unitStep))+'</text>';
  }
  var path='',previous=false,points=[],segments=[],weekEvents=moving?new Map():stabilityWeekEvents(R,weeks);
  weeks.forEach((week,index)=>{
    var at=x(index);
    if(!moving&&week.reference){
      var segment=segments.at(-1);
      if(segment?.end===index-1&&segment.reference===week.reference)segment.end=index;
      else segments.push({start:index,end:index,reference:week.reference});
    }
    if(!Number.isFinite(week[key])){previous=false;return;}
    var level=y(week[key]),hits=week.hits.filter(hit=>hit.chart===chart),events=weekEvents.get(week.start);
    var label='Week ending '+week.end+' · '+(moving?'Moving range '+fcValue(week.range):'Actual '+fcValue(week.value)
      +(useScale?' · '+runReadingRequirements(week.value,week.reference,'No single target applies to this full week'):''))
      +(events?.length?' · Recorded events: '+dailyEventTypes(events).map(dailyEventLabel).join(', '):'')
      +(hits.length?' · '+[...new Set(hits.map(stabilityPattern))].join(', '):'');
    path+=(previous?' L':' M')+at+' '+level;
    previous=true;
    points.push({at,level,label,week,hits,events});
  });
  var halfStep=weeks.length>1?(right-left)/((weeks.length-1)*2):(right-left)/2;
  var references=segments.map(({start,end,reference})=>({ref:reference,x1:Math.max(left,x(start)-halfStep),x2:Math.min(right,x(end)+halfStep)}));
  var spans=useScale?references:[], geometry={left,right,top,bottom,width};
  var id='stability-individuals', layers=runReferenceLayers(spans,{id,...geometry,low,high,y,width:4.5,
    trace:(value,color)=>runLevelTrace(weeks,value,color,x,y)});
  var fills=spans.filter(({ref})=>Number.isFinite(ref.lower)&&Number.isFinite(ref.upper)).map(({ref,x1,x2})=>
    `<rect class="dt-band" x="${x1}" y="${y(ref.upper)}" width="${x2-x1}" height="${y(ref.lower)-y(ref.upper)}"/>`).join('');
  var axisY=lowerLanes?bottom+12+lowerLanes*22:bottom,height=axisY+55,lastTick=-Infinity;
  plot+='<path class="g-stability-axis" fill="none" stroke="var(--slate-400)" d="M'+left+' '+top+'V'+bottom+'M'+left+' '+axisY+'H'+right+'"/>'
    +'<text class="gc-tick" x="'+((left+right)/2)+'" y="'+(height-6)+'" text-anchor="middle">Week ending</text>'
    +'<text class="gc-tick" transform="translate('+(14+gutter)+' '+((top+bottom)/2)+') rotate(-90)" text-anchor="middle">'
    +esc(moving?'Moving range ('+durationUnitSymbol()+')':stabilityMetricAxis())+'</text>';
  weeks.forEach((week,index)=>{
    var at=x(index);
    if(index!==0&&index!==weeks.length-1&&(at-lastTick<dateSpacing||right-at<dateSpacing))return;
    lastTick=at;
    var date=tickDate.format(new Date(week.end+'T00:00:00Z'));
    plot+='<line class="g-stability-axis-tick" x1="'+at+'" x2="'+at+'" y1="'+axisY+'" y2="'+(axisY+7)+'"/>'
      +'<text class="gc-tick" x="'+at+'" y="'+(axisY+25)+'" text-anchor="middle">'+esc(date)+'</text>';
  });
  var line=(kind,first,last,value,extra='')=>'<line class="g-stability-'+kind+(kind==='spec'?' dt-spec-line':'')+'" x1="'+first+'" x2="'+last
    +'" y1="'+y(value)+'" y2="'+y(value)+'" data-'+kind+'-value="'+value+'"'+extra+'/>';
  var guides=controls.map(([value,,kind])=>line(kind,left,right,value)).join('');
  guides+=references.map(({ref,x1,x2},index)=>Number.isFinite(ref.target)
    ?line('target',x1,x2,ref.target,useScale?' data-target-period="'+index+'"':''):'').join('');
  guides+=spans.flatMap(({ref,x1,x2})=>[...new Set([ref.lower,ref.upper])]
    .filter(value=>Number.isFinite(value)&&!controls.some(([control])=>control===value))
    .map(value=>line('spec',x1,x2,value))).join('');
  var latest=segments.filter(segment=>Number.isFinite(segment.reference.target)).at(-1);
  var marks=controls.map(([value,name,kind])=>({value,name,kind,edge:right}));
  if(latest)marks.push({value:latest.reference.target,name:'Target',kind:'target',edge:Math.min(right,x(latest.end)+halfStep)});
  marks.sort((a,b)=>y(a.value)-y(b.value));
  marks.forEach((mark,index)=>{mark.labelY=Math.max(y(mark.value),index?marks[index-1].labelY+22:top);});
  for(var i=marks.length-1;i>=0;i--)marks[i].labelY=Math.min(marks[i].labelY,i===marks.length-1?bottom:marks[i+1].labelY-22);
  plot+=marks.map(({value,name,kind,edge,labelY})=>{
    var label=name+' '+durationNumber(value,false),boxWidth=measure(label,detailFont)+10,boxLeft=Math.min(right+10,width-boxWidth-2);
    return (edge===boxLeft&&y(value)===labelY?'':'<path class="g-stability-leader" d="M'+edge+' '+y(value)+'L'+boxLeft+' '+labelY+'"/>')
      +stabilityLabel(label,boxLeft,labelY,boxWidth,kind);
  }).join('');
  var labelCenter=({above,lane})=>above?top-16-lane*22:bottom+22+lane*22;
  plot+=labels.map(label=>{
    var {boxWidth,boxLeft,at,index,above}=label;
    var direction=above?-1:1;
    return '<path class="g-stability-week-guide" d="M'+at+' '+(y(weeks[index][key])+direction*8)
      +'V'+(labelCenter(label)-direction*9)+'H'+(boxLeft+boxWidth/2)+'"/>';
  }).join('')+labels.map(label=>
    stabilityLabel(label.weekLabel,label.boxLeft,labelCenter(label),label.boxWidth,'signal '+(label.above?'is-above':'is-below'))).join('');
  var markers=points.map(({at,level,label,week,hits,events})=>'<span role="img" tabindex="0" class="g-insight-actual g-stability-dot g-stability-point'
    +(hits.length?' is-signaled':'')+(events?.length?' is-event':'')+'" style="left:'+(100*at/width)+'%;top:'+(100*level/height)+'%;"'
    +(spans.length?' data-reference-index="'+spans.findIndex(({ref,x1,x2})=>ref===week.reference&&at>=x1&&at<=x2)+'"':'')
    +readingDetailAttributes(label)+' data-week-start="'+week.start+'"></span>').join('');
  var markup='<svg viewBox="0 0 '+width+' '+height+'" role="img" aria-label="'
    +(moving?'Moving Range for weekly AHT':'Observed weekly '+esc(ml()))+'">';
  if(spans.length)markup+='<defs><path id="'+id+'-trace" d="'+path+'"/>'+layers.defs+'</defs>'+layers.scales+fills+layers.washes;
  markup+=plot+'<path class="g-stability-trace dt-context-trace" d="'+path+'"/>'+layers.overlays+guides+'</svg>'+markers;
  return {markup,spans,geometry};
}
function stabilityChart(R,weeks,moving){
  if(!weeks.some(week=>Number.isFinite(moving?week.range:week.value)))return '<p>No eligible complete weeks are available for this scope.</p>';
  var chart=moving?'moving_range':'individuals',legend=[['actual',moving?'Moving range':'Actual',tracePointKey(stabilityDot(),'g-stability-trace-key')]];
  if(!moving&&stabilityWeekEvents(R,weeks).size)legend.push(['event','Recorded event',tracePointKey(stabilityDot('is-event'),'g-stability-trace-key')]);
  if(R.stability?.status==='assessed')legend.push(['center','Center line',stabilityMark('center')],['limit','Control limits',stabilityMark('limit')]);
  if(!moving&&weeks.some(week=>Number.isFinite(week.reference?.target)))legend.push(['target','Target']);
  if(!moving&&weeks.some(week=>Number.isFinite(week.reference?.lower)||Number.isFinite(week.reference?.upper)))
    legend.push(['spec','Business specification limits',dailySpecificationKey(weeks.map(week=>week.reference).filter(Boolean))]);
  if(weeks.some(week=>week.hits.some(hit=>hit.chart===chart)))
    legend.push(['signal','Signal',tracePointKey(stabilityDot('g-stability-signal-key'),'g-stability-trace-key')]);
  return chartLegend(legend)+'<div class="g-stability-plot" data-chart="'+chart+'"></div>';
}
var observedStabilityPlot=null,stabilityPlotWidths=new WeakMap();
var stabilityPlotObserver=new ResizeObserver(entries=>{for(var entry of entries)layoutStabilityPlot(entry.target);});
function layoutStabilityPlot(plot){
  var R=xR(),width=plot.clientWidth;
  if(!R||width<240||stabilityPlotWidths.get(plot)===width)return;
  stabilityPlotWidths.set(plot,width);
  var {markup,spans,geometry}=stabilityPlotContent(R,stabilityWeeks(R),plot.dataset.chart==='moving_range',width,getComputedStyle(plot));
  if(!plot.firstElementChild)plot.innerHTML=markup;
  else{
    var replacement=document.createElement('template');
    replacement.innerHTML=markup;
    var points=replacement.content.querySelectorAll('.g-stability-point');
    plot.firstElementChild.replaceWith(replacement.content.firstElementChild);
    plot.querySelectorAll('.g-stability-point').forEach((point,index)=>{point.style.cssText=points[index].style.cssText;});
  }
  if(spans.length)bindRunReference(plot.firstElementChild,plot,spans,geometry);
}
function stabilityScale({rate,flagged,eligible}){
  if(rate===null)return '<p>Stability scale unavailable.</p>';
  var position=rate>.05?92:rate*1680,percent=stabilityPercent(rate);
  var ticks=['0%','1%','2%','3%','4%','5%','>5%'].map((label,index)=>
    '<span style="left:'+(index===6?92:index*16.8)+'%">'+esc(label)+'</span>').join('');
  var labels=[['band','Favorable (<5%)'],['overflow','5% or more'],['rate','Observed rate']];
  return '<div class="g-stability-scale" style="--position:'+position+'%">'
    +chartLegend(labels.map(([kind,label])=>[kind,label,stabilityMark(kind)]))
    +'<div class="g-stability-rail" role="meter" aria-label="Out-of-control points" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+(rate*100)
    +'" aria-valuetext="'+flagged.length+' of '+eligible.length+' evaluated weeks ('+percent+')">'
    +[100,75,50,25,0].map(shade=>'<span class="g-stability-segment" style="--shade:'+shade+'%"></span>').join('')
    +'<span class="g-stability-overflow"></span><span class="g-stability-rate-marker"></span></div>'
    +'<div class="g-stability-scale-labels"><span class="g-stability-rate">Out-of-control points '+percent+'</span></div>'
    +'<div class="g-stability-scale-ticks" aria-hidden="true">'+ticks+'</div></div>';
}
function stabilitySignals({rate,flagged}){
  if(rate===null)return '<p>Out-of-control points were not assessed.</p>';
  if(!flagged.length)return '<p>No out-of-control points in the evaluated period.</p>';
  return '<div class="scroll g-requirements-table" tabindex="0" aria-label="Out-of-control points"><table><thead><tr>'
    +'<th scope="col">Week ending</th><th scope="col">Value</th><th scope="col">Test pattern</th>'
    +'</tr></thead><tbody>'+flagged.map(week=>{
      var patterns=[...new Set(week.hits.map(stabilityPattern))].join(', ');
      return '<tr><th scope="row">'+esc(week.end)+'</th><td>'+esc(fcValue(week.value))+'</td><td>'+esc(patterns)+'</td></tr>';
    }).join('')+'</tbody></table></div>';
}
function stabilityEvidenceHits(hits){
  if(!hits.length)return '—';
  return '<ul class="g-stability-evidence-hits">'+hits.map(hit=>'<li><details><summary>'+esc(stabilityTest(hit)+' · '+stabilityPattern(hit))
    +'</summary>'+esc(hit.readings.map(([week,value])=>stabilityWeekEnd(week)+' ('+fcValue(value)+')').join(' → '))
    +'</details></li>').join('')+'</ul>';
}
function stabilityTable(R,weeks){
  if(!weeks.length)return '<p>No complete weeks are available for this scope.</p>';
  var assessed=R.stability?.status==='assessed';
  var hasSpecs=weeks.some(week=>Number.isFinite(week.reference?.lower)||Number.isFinite(week.reference?.upper));
  return '<div class="scroll g-requirements-table" tabindex="0" aria-label="Observed weekly results"><table><thead><tr>'
    +'<th scope="col">Week ending</th><th scope="col">'+esc(stabilityMetricAxis())+'</th><th scope="col">Business Target</th>'
    +(hasSpecs?'<th scope="col">Business specification limits</th>':'')
    +'<th scope="col">'+esc(gCountLabel(R))+'</th>'
    +(assessed?'<th scope="col">Individuals tests</th><th scope="col">Moving Range pair</th><th scope="col">Moving Range test</th>':'')
    +'<th scope="col">Change from prior week</th></tr></thead><tbody>'
    +weeks.map(week=>{
      var value=Number.isFinite(week.value),target='g-stability-week-'+week.start;
      var reference=week.reference;
      return '<tr id="'+target+'"><th scope="row">'+esc(week.end)+'</th>'
        +'<td>'+(value?esc(fcValue(week.value)):'No eligible result')+'</td>'
        +'<td>'+(Number.isFinite(reference?.target)?esc(fcValue(reference.target)+' · Effective from '+reference.effective_start
          +(reference.effective_end?' until '+reference.effective_end+' (exclusive)':'')):'—')+'</td>'
        +(hasSpecs?'<td>'+esc(dailySpecification(reference))+'</td>':'')
        +'<td>'+n0(week.count)+'</td>'
        +(assessed?'<td>'+stabilityEvidenceHits(week.hits.filter(hit=>hit.chart==='individuals'))+'</td><td>'
          +(week.pair?esc(week.pair.map(([start,value])=>stabilityWeekEnd(start)+' ('+fcValue(value)+')').join(' → ')):'—')
          +'</td><td>'+stabilityEvidenceHits(week.hits.filter(hit=>hit.chart==='moving_range'))+'</td>':'')
        +'<td>'+(Number.isFinite(week.range)?esc(fcValue(week.range)):'—')+'</td></tr>';
    }).join('')+'</tbody></table></div>';
}
function stabilityEvidence(R){
  var assessment=R.target_assessment,imr=R.stability;
  var {weeks,eligible,flagged,rangeSignals,rate}=stabilitySelection(R);
  var events=[...stabilityWeekEvents(R,weeks).values()].flat();
  var details=imr?.reason?'<p>'+esc(imr.reason)+'</p>':'',coverage='';
  if(imr?.status==='assessed'){
    var [ilo,ihi]=imr.individuals_limits,[mlo,mhi]=imr.moving_range_limits;
    var {center,mr_center,sigma,observations,pairs}=imr.baseline;
    var {first_week,last_week}=imr.estimation_window;
    var countMR=eligible.filter(w=>Number.isFinite(w.range)).length;
    var countI=eligible.filter(w=>w.hits.some(hit=>hit.chart==='individuals')).length;
    details='<p>I-MR limits estimated from the Cockpit run’s complete weeks, '+esc(first_week)+' through '+esc(stabilityWeekEnd(last_week))
      +'. Used '+n0(observations)+' weekly readings and '+n0(pairs)+' consecutive pairs. Filtering dates keeps the limits and test results fixed. '
      +'A test that ends in the selected window can use earlier weeks.</p>'
      +'<p class="g-stability-limits">Within-process standard deviation '+esc(fcValue(sigma))+'. Individuals center '+esc(fcValue(center))
      +', limits '+esc(fcValue(ilo))+' to '+esc(fcValue(ihi))+'. Moving Range center '+esc(fcValue(mr_center))
      +', limits '+esc(fcValue(mlo))+' to '+esc(fcValue(mhi))+'.</p>'
      +(rate===null?'<p>No eligible complete weeks in the selected dates.</p>':'<p class="g-stability-evaluated">Individuals flags '
        +n0(countI)+' of '+n0(eligible.length)+' evaluated weeks. Moving Range flags '+n0(rangeSignals.length)+' of '+n0(countMR)
        +' pairs. Combined '+n0(flagged.length)+' of '+n0(eligible.length)+' evaluated weeks ('+stabilityPercent(rate)+'). '
        +'A pair counts on its later week. Overlapping flags count once.</p>')
      +(!imr.interpret_individuals?'<p>Review the Cockpit run’s Moving Range signals before drawing conclusions from the Individuals limits.</p>':'');
    coverage='<h4>Signal rule coverage</h4><dl>'+STABILITY_TESTS.map(([,description],index)=>{
      var count=eligible.filter(w=>w.eligible_tests.includes(index+1)).length;
      return '<dt>Individuals Test '+(index+1)+'</dt><dd>'+esc(description)+' · '+n0(count)+' evaluated windows</dd>';
    }).join('')+'<dt>Moving Range Test 1</dt><dd>One range beyond its upper limit · '+n0(countMR)+' evaluated pairs</dd></dl>';
  }
  return '<h3>Stability evidence</h3>'+chartScopeTitle(R,'Observed weeks',stabilityScope(R))
    +'<p>Each point pools eligible observations for one complete Monday–Sunday week in the Cockpit scope. A week without eligible observations breaks the trace.</p>'
    +'<p>A business Target is shown when one applicable version covers the entire week. A dash means there is no eligible whole-week target.'
    +(assessment?.status!=='published'&&assessment?.reason?' '+esc(assessment.reason):'')+'</p>'
    +details+'<h4>Weekly readings and absolute changes</h4>'+stabilityTable(R,weeks)+coverage
    +(events.length?'<h4>Recorded events in plotted weeks</h4>'+gCalendarEvents(events,null,false):'');
}
function stabilityPanel(R){
  var selection=stabilitySelection(R),{weeks,eligible,flagged,rate}=selection,state=observedState(R);
  var answer=eligible.length?'Stability was not assessed for these dates.'
    :'There are no eligible complete weekly results for this scope.';
  var readings=eligible.map(week=>week.value);
  var facts=readings.length?'<li>'+esc('Observed weekly '+ml()+' ranged from '
    +fcValue(Math.min(...readings))+' to '+fcValue(Math.max(...readings)))+'.</li>':'',steps='';
  if(rate!==null){
    answer=flagged.length?'The analyzed period is not stable with '+stabilityPercent(rate)+' of data points identified as out-of-control.'
      :R.stability.interpret_individuals?'The analyzed period is stable with no data points identified as out-of-control.'
      :'No out-of-control points were identified in the selected weeks.';
    var patterns=STABILITY_TESTS.map(([name],index)=>{
      var count=flagged.filter(week=>week.hits.some(hit=>hit.test===index+1)).length;
      return count?'<li>'+esc(name)+' · '+n0(count)+'</li>':'';
    }).join('');
    facts='<li>There are '+n0(flagged.length)+' points identified to be out-of-control within the selected period.'
      +(patterns?'<ul>'+patterns+'</ul>':'')+'</li><li>The analysis period has an identified '+stabilityPercent(rate)
      +' out-of-control across '+n0(eligible.length)+' datapoints.</li>';
    if(flagged.length)steps='<h4>Next steps</h4><ul><li>Evaluate the weeks identified as out-of-control for possible preventive or corrective actions.</li></ul>';
    else if(R.stability.interpret_individuals)steps='<h4>Next steps</h4><ul><li>Identify and maintain activities that contribute to limiting the impact of unplanned causes of variation in the score.</li></ul>';
  }
  var takeaway=gSlideTakeaway(answer,'<h4>Facts</h4><ul>'+facts+chartPeriodFact(stabilityScope(R))
    +'</ul>'+steps+'<button type="button" class="g-linkbtn" data-chapter="g-stability-evidence">See Stability in Evidence</button>');
  var [view,label]=reportViews("stability",state).current;
  var metric='Weekly weighted '+(metricId()==='aht'?ml():ML())+' ('+(durationUnit()==='points'?'points':durationUnitSymbol())+')';
  var body=view==='scale'?stabilityScale(selection):view==='out-of-control'?stabilitySignals(selection):stabilityChart(R,weeks,view==='moving-range');
  var visual=reportChartControls("stability",state)+'<h4 class="g-insights-chart-title">'+esc(metric+' · '+label)+'</h4>'
    +'<div class="g-insights-labeled-chart">'+body+'</div>';
  return '<section id="g-stability-panel" class="g-chart-container-box">'+gSlideResult(takeaway,visual,true)+'</section>';
}
function showsStability(R){
  return gReportViews(R).includes("time")&&gShowsPanel(R,"trend");
}
function scoreCutoffBasis(R){
  var cutoff=R.metric?.cutoff_share;
  if(!cutoff)return '';
  var base=gCountLabel(R).toLowerCase();
  var basis=cutoff.basis==="file_cutoff"?'the cutoff supplied with the file':'the configured score cutoff of '+cutoff.cutoff;
  return '<h4>Score cutoff for the report period</h4><p>'+esc(percentNumber(cutoff.share*100)+'% across '+n0(cutoff.scored)+' '+base
    +'. This share uses '+basis+'. The account target applies to the weighted KPI.')+'</p>';
}
function gCh1(R){
  var views=gReportViews(R),assessment=R.target_assessment;
  var body='';
  var requirements=R.account_requirements?requirementsPanel(R):withR(R,function(){return xH(targetSectionHtml(R)+conditionalHtml(R));});
  if(R.account_requirements)body+=gQuestionSlide("g-slide-requirements","How did we perform against the account’s requirements?",requirements);
  else if(requirements){
    var assessed=assessment?.periods?.filter(period=>typeof period.target_met==="boolean")||[];
    var latest=assessed.reduce((last,period)=>!last||period.last_date>last.last_date?period:last,null);
    var takeaway=assessment?.status==="published"?(latest
      ?fcValue(latest.value)+' '+(latest.gap===0?'was on':latest.target_met?'met':'missed')+' the '+fcValue(latest.target)+' target from '+latest.first_date+' to '+latest.last_date+'.'
      :'See the table for the applicable specification limits and period results.'):assessment?.reason;
    body+=gQuestionSlide("g-slide-requirements","How did performance compare with the applicable requirements?",
      gSlideTakeaway(takeaway||'Review the applicable requirements in the table.')+requirements);
  }
  else if(xHasTarget(R)===null&&(!assessment||assessment.status==="published"))body+='<p class="muted">No account target or specification limit applies to this selection.</p>';
  if(showsStability(R)){
    var daily=gQuestionSlide("g-slide-daily","How did "+ml()+" change day to day?",gObservedTrend(R));
    var stability=gQuestionSlide("g-slide-stability","Was performance stable over time?",stabilityPanel(R));
    body+=R.metric?.metric_id==="aht"?stability+daily:daily+stability;
  }
  if(gShowsPanel(R,"groups")&&views.indexOf("group")!==-1&&R.by_group&&!R.by_groups){
    var grouping=R.scope.group_by==="line_of_business"?"Line of Business":"Contact driver";
    body+=gQuestionSlide("g-slide-group-totals","Where did "+ml()+" differ?",gSlideTakeaway('Results are grouped by '+grouping+'.')+xPanel(R,"group"));
  }
  if(gShowsPanel(R,"groups"))body+=gQuestionSlide("g-slide-groups","How did performance compare across groups?",gReportGroups(R));
  if(gShowsPanel(R,"distribution"))body+=gQuestionSlide("g-slide-distribution","How widely did performance vary across agents?",gHistogram(R));
  var faq=[["How was "+ml()+" calculated?",calcText(R)+"."],["What was left out?",R.population_statement?R.population_statement.text:"Evidence lists the records set aside and their reasons."]];
  if(S.page==="full-insights"||!Array.isArray(R.report_panels)){
    body+=xFaq(faq);
  }
  return gArt("chapter-happened",1,"What Happened","",body,xb("What happened","calc"));
}
function gCountLabel(R=S.result){
  var labels={handled_contacts:'Handled contacts',scored_contacts:'Scored contacts',
    contact_weight:'Handled contacts in eligible periods',contacts_with_pass_outcomes:'Contacts with pass outcomes'};
  return labels[R?.metric?.count_basis]||(metricKind()==='seconds'?'Handled contacts':'Eligible observations');
}
function scopedAssessmentText(a){if(!a)return '';if(a.status==='no_target_applies')return 'No target or limit applies';if(a.status!=='published')return a.reason||'Comparison unavailable';return (a.periods||[]).map(function(p){var lines=[p.first_date+(p.last_date!==p.first_date?' to '+p.last_date:'')];if(Number.isFinite(p.target))lines.push('target '+num(p.target)+' '+durationUnitSymbol()+': '+resultText(p));if(p.specification.lower!==null)lines.push('lower limit '+num(p.specification.lower)+' '+durationUnitSymbol()+'');if(p.specification.upper!==null)lines.push('upper limit '+num(p.specification.upper)+' '+durationUnitSymbol()+'');if(p.specification.lower!==null||p.specification.upper!==null)lines.push(limitText(p));return lines.join('; ');}).join(' | ');}
function scopedTargetsHtml(R){var dimensions=R.group_assessments_by_dimension;if(!dimensions)return '';return '<section class="panel scoped-target-evidence"><h2>Group targets and limits</h2><p class="muted">Each requirement applies only to its named group and dates.</p>'+['line_of_business','contact_type'].map(function(dim){return '<h3>'+esc(dim==='line_of_business'?'Lines of Business':'Contact drivers')+'</h3><div class="scroll"><table><thead><tr><th>Group</th><th>Applicable requirement and result</th></tr></thead><tbody>'+dimensions[dim].map(function(a){return '<tr><td>'+esc(a.key)+'</td><td>'+esc(scopedAssessmentText(a))+'</td></tr>';}).join('')+'</tbody></table></div>';}).join('')+'</section>';}
function gBoxMedianRanks(R,boxes,peer,format){
  var direction=peer?peer.direction:R.analysis_setup?.direction||R.metric?.direction;
  var assessment=peer?null:R.target_assessment;
  var band=assessment?.status==="published"&&assessment.overall?.classified?assessment.overall.specification:null;
  var score={lower_is_better:value=>value,higher_is_better:value=>-value}[direction];
  if(direction==="within_bounds"&&Number.isFinite(band?.lower)&&Number.isFinite(band?.upper)){
    score=value=>Math.max(band.lower-value,value-band.upper,0);
  }
  var ranks={best:new Set(),worst:new Set(),note:''};
  if(!score||boxes.length<2)return ranks;
  var scores=boxes.map(group=>score(group.box.median)),best=Math.min(...scores),worst=Math.max(...scores);
  if(best===worst)return {...ranks,note:'All eligible group medians are tied on the favorable-direction ranking.'};
  if(direction!=="within_bounds"&&format(boxes[scores.indexOf(best)].box.median)===format(boxes[scores.indexOf(worst)].box.median)){
    return {...ranks,note:'The group medians are indistinguishable at the shown precision.'};
  }
  ranks.best=new Set(boxes.filter((group,index)=>scores[index]===best));
  ranks.worst=new Set(boxes.filter((group,index)=>scores[index]===worst));
  return ranks;
}
function gBoxMedianCallouts(R,boxes,peer,format=fcValue,ranks=gBoxMedianRanks(R,boxes,peer,format)){
  if(ranks.note)return gSlideTakeaway(ranks.note);
  if(!ranks.best.size)return gSlideTakeaway(boxes.length?'The available group medians do not support a distinct best and worst result.':'No group has an eligible box plot.');
  var best=[...ranks.best],worst=[...ranks.worst];
  var names=groups=>groups.map(group=>group.key).join(', ');
  var typical=groups=>groups.map(group=>group.key+' '+format(group.box.median)+' across '+n0(group.agent_count)+' agents').join('; ');
  var spread=group=>format(group.box.q1)+' to '+format(group.box.q3);
  return gSlideTakeaway(names(best)+(best.length===1?' had':' shared')+' the most favorable typical result. '+names(worst)
    +(worst.length===1?' had':' shared')+' the least favorable.', '<h4>Facts</h4><p>'+esc(typical(best)+'. '+typical(worst)
      +'. The middle half of eligible agent results ranged from '+spread(best[0])+' in '+best[0].key+' and from '+spread(worst[0])
      +' in '+worst[0].key+'.')+'</p>');
}
function boxSelection(R,state){
  if(!R.group_charts)return null;
  var extra=R.group_comparison||[], selected=R.metric?.metric_id;
  var peer=extra.find(item=>item.id===state.boxMeasure&&item.id!==selected);
  var views=peer?.groups||extra.find(item=>item.id===selected)?.groups||{};
  var labels={...OBSERVED_DIMENSIONS,team_lead:"Team lead",manager:"Manager",training_wave:"Training wave",tenure_group:"Tenure group"};
  var options=(peer?[]:observedDimensions(R)).concat(Object.keys(views).map(key=>[key,labels[key]]));
  if(!options.length)return null;
  var dim=state.distribution;
  if(!options.some(function(pair){return pair[0]===dim;}))dim=options[0][0];
  var totals=new Map((R.by_groups?.[dim]||[]).map(g=>[g.key,g]));
  var groups=views[dim]||(R.group_charts[dim]||[]).map(g=>({...g,...totals.get(g.key)}));
  var label=peer?peer.label:ML(),axis=peer?label+' ('+reportUnitSymbol(peer.unit)+')':chartMetricAxis();
  var format=peer?value=>Number.isFinite(value)?value.toLocaleString('en-US',{maximumSignificantDigits:5})+' '+peer.unit:'—':fcValue;
  var measureOptions=[[selected,ML()]].concat(extra.filter(item=>item.id!==selected).map(item=>[item.id,item.label]));
  return {peer,selected,views,extra,labels,options,dim,groups,label,axis,format,measureOptions};
}
function boxFilterFields(R,state){
  var {measureOptions,peer,selected,options,dim}=boxSelection(R,state);
  return (measureOptions.length>1?observedSelect("g-box-measure","Measure",measureOptions,peer?.id||selected):'')
    +observedSelect("g-box-dimension","Group by",options,dim);
}
function boxPreview(R,state){
  var {groups,label,labels,dim}=boxSelection(R,state);
  return {valid:true,text:label+' · '+labels[dim]+' · '+n0(groups.filter(group=>group.box).length)+' of '+n0(groups.length)+' groups with box plots'};
}
function gBreakdowns(R,evidence=false){
  var state=observedState(R),selection=boxSelection(R,state);
  if(!selection)return '';
  var {peer,selected,views,extra,labels,dim,groups,label,axis,format}=selection;
  var eligible=groups.filter(g=>g.box).sort((a,b)=>b.count-a.count);
  var ranks=gBoxMedianRanks(R,eligible,peer,format);
  var extremes=[ranks.best.values().next().value,ranks.worst.values().next().value].filter(Boolean);
  var visible=new Set([...new Set([...extremes,...eligible])].slice(0,10));
  var boxes=eligible.filter(g=>visible.has(g));
  var method='<p>Each agent contributes one '+esc(label.toLowerCase())+' value pooled over their eligible results in the group. Boxes show the middle half and median. Whiskers extend to the last observations within 1.5 box widths of either end, with values beyond those fences shown as dots.</p>';
  if(views[dim]){
    var coverage=groups.reduce((total,g)=>total+g.count,0);
    var source=peer||extra.find(item=>item.id===selected);
    method+='<p class="muted">'+esc(source.source)+' · '+n0(coverage)+' of '+n0(source.count)+' eligible observations have this grouping.'
      +(Object.hasOwn(OBSERVED_DIMENSIONS,dim)?'':' Group assignments use the supplied roster (D06).')+'</p>';
  }
  var body=boxes.length?gBoxPlot(boxes,label,axis,format,peer?1:durationFactor(),ranks)
    :'<p>'+(groups.some(g=>g.box_reason)?'No group has a plottable distribution. See the group values for details.':'No group has the four agents needed to draw a box plot.')+'</p>';
  if(boxes.length)method+='<p class="muted">The chart shows '+n0(boxes.length)+' of '+n0(groups.length)+' groups. Boxes require at least four agents. Where space is limited, the chart includes the observed extremes, then fills by observation count.</p>';
  var pairwise=peer?null:R.insights?.pairwise?.[dim];
  if(boxes.length>=2&&pairwise)body+='<p>Comparison letters are unavailable. '+(pairwise.pairs.length
    ?'The available pairwise gaps describe the observed results.':'Too few groups have enough eligible observations for a direct comparison.')
    +' <button type="button" class="g-linkbtn" data-chapter="g-cld-evidence-'+esc(dim)+'">See pairwise coverage in Evidence</button></p>';
  var values='<div class="scroll" tabindex="0" aria-label="Group values and counts"><table><thead><tr><th scope="col">'+esc(labels[dim])+'</th><th scope="col">Pooled '+esc(label)+'</th><th scope="col">'+(peer?"Eligible observations":gCountLabel())+'</th><th scope="col">Agents</th><th scope="col">Lower quartile</th><th scope="col">Median</th><th scope="col">Upper quartile</th><th scope="col">Whiskers</th><th scope="col">Beyond whiskers</th></tr></thead><tbody>'
    +groups.map(function(g){var b=g.box;return '<tr><th scope="row">'+esc(g.key)+'</th><td>'+format(g.value)+'</td><td>'+n0(g.count)+'</td><td>'+n0(g.agent_count)+'</td>'
      +(b?'<td>'+format(b.q1)+'</td><td>'+format(b.median)+'</td><td>'+format(b.q3)+'</td><td>'+format(b.lower)+' to '+format(b.upper)+'</td><td>'
        +n0(b.outliers.length)+(b.outliers.length?'<span class="g-outlier-values"> · '+esc(b.outliers.map(format).join(', '))+'</span>':'')+'</td>':'<td colspan="5">'+esc(g.box_reason||"Fewer than four agents")+'</td>')+'</tr>';}).join("")+'</tbody></table></div>';
  var scope=evidence?chartScopeTitle(R,'Box plots by '+labels[dim]):presentationScopeTitle(R,{agentGroup:label+' by '+labels[dim]});
  if(evidence)return '<h3>Group performance evidence</h3>'+scope+method+values;
  return '<section id="g-observed-comparison" class="g-chart-container-box g-observed-comparison" aria-labelledby="g-observed-comparison-title"><h3 id="g-observed-comparison-title">Group performance comparison</h3>'
    +scope+'<div class="g-observed-filters">'+reportChartControls("box",state)+'</div>'
    +gSlideResult(gBoxMedianCallouts(R,eligible,peer,format,ranks),state.boxView==="table"?values:body)
    +'<button type="button" id="g-box-evidence-link" class="g-linkbtn" data-chapter="g-box-evidence">See group values in Evidence</button></section>';
}
function chartValue(value,spacing,factor=durationFactor()){
  var shown=value/factor;
  var digits=Math.max(0,Math.min(12,1-Math.floor(Math.log10(spacing/factor))));
  return shown.toLocaleString('en-US',{maximumFractionDigits:digits});
}
function gBoxPlot(groups,label,axis,format,factor,ranks){
  var lo=Infinity,hi=-Infinity;
  for(var g of groups){
    for(var value of [g.box.lower,g.box.upper,...g.box.outliers]){lo=Math.min(lo,value);hi=Math.max(hi,value);}
  }
  if(hi===lo){var pad=Math.abs(lo)*.01||1;lo-=pad;hi+=pad;}
  if(!Number.isFinite(hi-lo))return '<p>These groups exceed the shared axis range. See their values in the table.</p>';
  var step=(hi-lo)/4,ticks=Array.from({length:5},function(_,i){return lo+i*step;});
  function x(v){return 4+592*((v-lo)/(hi-lo));}
  function line(a,b,y1,y2,cls){return '<line x1="'+x(a)+'" x2="'+x(b)+'" y1="'+y1+'" y2="'+y2+'" class="'+cls+'"/>';}
  var legend=[["box","Middle 50%"],["median","Median"],["whisker","Whiskers"]];
  if(groups.some(function(g){return g.box.outliers.length;}))legend.push(["outlier","Beyond whiskers"]);
  return chartLegend(legend)+'<div role="group" aria-label="'+esc(label+" distribution by group")+'">'+groups.map(function(g){
    var b=g.box;
    var rank=ranks.best.has(g)?'best':ranks.worst.has(g)?'worst':'';
    return '<div class="g-box-row'+(rank?' g-box-'+rank:'')+'"><span>'+esc(g.key)+' <small class="muted">('+n0(g.agent_count)+' agents)</small>'
      +(rank?'<small class="g-box-rank">'+(rank==='best'?'Best':'Worst')+' observed median</small>':'')+'</span><svg viewBox="0 0 600 30" preserveAspectRatio="none" aria-hidden="true" stroke="'+(rank?'currentColor':'var(--ink)')+'">'
      +ticks.map(function(v){return line(v,v,0,30,"gc-grid");}).join("")
      +line(b.lower,b.upper,15,15,"g-box-whisker")+line(b.lower,b.lower,9,21,"g-box-cap")+line(b.upper,b.upper,9,21,"g-box-cap")
      +'<rect x="'+x(b.q1)+'" y="5" width="'+(x(b.q3)-x(b.q1))+'" height="20" fill="var(--accent-soft)"/>'
      +line(b.median,b.median,5,25,"g-box-median")+b.outliers.map(function(v){return '<circle cx="'+x(v)+'" cy="15" r="3" fill="var(--ink)"><title>'+esc(format(v))+'</title></circle>';}).join("")+'</svg></div>';
  }).join("")+'<div class="g-box-row"><span class="muted">'+esc(axis)+'</span><div class="g-box-ticks">'
    +ticks.map(function(v){return '<span style="left:'+(x(v)/6)+'%">'+esc(chartValue(v,step,factor))+'</span>';}).join("")+'</div></div></div>';
}
function histogramView(H,state){return H.views.find(view=>view.key===state.histogram)||H.views[0];}
function histogramFilterFields(R,state){
  var H=R.insights.agent_histogram;
  return observedSelect("g-histogram-cohort","Agent cohort",H.views.map(view=>[view.key,view.label]),histogramView(H,state).key);
}
function histogramPreview(R,state){
  var view=histogramView(R.insights.agent_histogram,state);
  return {valid:true,text:view.label+' · '+n0(view.counts.reduce((total,count)=>total+count,0))+' agents'};
}
function histogramPalette(R,low,high){
  var direction=R.analysis_setup?.direction||R.metric?.direction;
  var target=xHasTarget(R);
  if(direction==='lower_is_better'||direction==='higher_is_better'){
    var lower=direction==='lower_is_better';
    var worst=lower?high:low,best=Number.isFinite(target)?target:lower?low:high;
    return {
      describe:Number.isFinite(target)?'Bars meeting the target are green. Other bars are shaded toward red at the least favorable observed value.'
        :'No target applies. Bar color shows relative performance across observed values.',
      score:(from,to,last)=>{
        if(Number.isFinite(target)){
          var containsBoundary=from<target&&target<to||(lower?from===target&&from<to:last&&from<to&&to===target);
          if(containsBoundary)return null;
          if(lower?to<=target:from>=target)return 1;
        }
        if(best===worst)return null;
        return ((from/2+to/2)-worst)/(best-worst);
      }
    };
  }
  var assessment=R.target_assessment;
  var band=assessment?.status==='published'&&assessment.overall?.classified?assessment.overall.specification:null;
  if(direction!=='within_bounds'||!Number.isFinite(band?.lower)||!Number.isFinite(band?.upper))return null;
  var distance=value=>Math.max(band.lower-value,value-band.upper,0);
  var extreme=Math.max(distance(low),distance(high));
  return {
    describe:'Bars within the specification limits are green. Other bars are shaded toward red by distance from the limits.',
    score:(from,to,last)=>{
      if(from>=band.lower&&to<=band.upper)return 1;
      if(from<band.lower&&(to>band.lower||last&&to===band.lower)||from<=band.upper&&to>band.upper)return null;
      return extreme?1-distance(from/2+to/2)/extreme:null;
    }
  };
}
function gHistogram(R,evidence=false){
  var H=R.insights&&R.insights.agent_histogram;
  if(!H)return '';
  var state=observedState(R),overall=H.views[0],view=histogramView(H,state);
  var cohort=view!==overall;
  var W=720,L=58,T=16,P=640,B=168,bins=view.counts.length;
  var low=H.edges[0],high=H.edges[bins],target=xHasTarget(R);
  var domainLow=low,domainHigh=high;
  var direction=R.analysis_setup?.direction||R.metric?.direction;
  var lowerBetter=direction==='lower_is_better',higherBetter=direction==='higher_is_better';
  var palette=histogramPalette(R,low,high);
  var legend=[["median","Overall agent median: "+fcValue(H.median)]];
  if(cohort)legend.push(["overall","All agents"]);
  if(palette)legend.push(["hist-ramp",(cohort?view.label+": ":"")+"Less to more favorable"]);
  legend.push(["hist-neutral",palette?"Reference bin or no color distinction":cohort?view.label:"All agents"]);
  if(target!==null)legend.push(["target","Target: "+fcValue(target)]);
  var peak=Math.max(...overall.counts),step=Math.max(1,Math.ceil(peak/5)),top=Math.max(step,step*Math.ceil(peak/step));
  var spacing=(high-low)/bins||1;
  function label(v){return esc(chartValue(v,spacing));}
  function y(n){return B-(B-T)*n/top;}
  function x(value){return domainLow===domainHigh?L+P/2:L+P*(value-domainLow)/(domainHigh-domainLow);}
  var targetSide=target===null?'':target<domainLow?'below':target>domainHigh?'above':'';
  var description=view.label+' agent counts by '+ml()+(targetSide?'. Target '+fcValue(target)+' lies '+targetSide+' the displayed range.':'');
  var graph='<svg class="g-chart" viewBox="0 0 '+W+' 220" role="img" aria-label="'+esc(description)+'">';
  if((lowerBetter||higherBetter)&&H.quartile_cuts.length===3&&low<high){
    var q1=Math.min(...H.quartile_cuts),q3=Math.max(...H.quartile_cuts);
    var zones=lowerBetter?[["best",low,q1],["worst",q3,high]]:[["best",q3,high],["worst",low,q1]];
    zones.forEach(function([kind,from,to]){
      if(from===to)return;
      graph+='<rect class="g-hist-zone g-hist-zone-'+kind+'" x="'+x(from)+'" y="'+T+'" width="'+(x(to)-x(from))+'" height="'+(B-T)+'"/>';
      legend.push([kind,(kind==='best'?"Quartile 1":"Quartile 4")+' reference: '+fcValue(from)+' to '+fcValue(to)]);
    });
  }
  for(var n=0;n<=top;n+=step)graph+='<line class="gc-grid" x1="'+L+'" x2="'+(L+P)+'" y1="'+y(n)+'" y2="'+y(n)+'"/><text x="'+(L-8)+'" y="'+(y(n)+4)+'" text-anchor="end">'+n0(n)+'</text>';
  graph+='<text x="'+L+'" y="10">Agents</text>';
  var rows=overall.counts.map(function(count,i){
    var lower=label(H.edges[i]),upper=label(H.edges[i+1]);
    var range=lower===upper?lower:lower+' to '+upper;
    var width=H.edges[i]===H.edges[i+1]?16:x(H.edges[i+1])-x(H.edges[i]);
    var left=H.edges[i]===H.edges[i+1]?x(H.edges[i])-width/2:x(H.edges[i]);
    var gap=Math.min(1,width/4);
    var score=palette?.score(H.edges[i],H.edges[i+1],i===bins-1);
    var fill=Number.isFinite(score)?' style="--histogram-fill:color-mix(in srgb,var(--emerald-700) '
      +Math.min(100,Math.max(0,score*100))+'%,var(--coral-700))"':'';
    var exactLow=H.edges[i]/durationFactor(),exactHigh=H.edges[i+1]/durationFactor();
    var exact=exactLow===exactHigh?String(exactLow):exactLow+' to '+exactHigh+(i===bins-1?' (upper edge included)':' (upper edge excluded)');
    function bar(n,classes,name,style){
      return '<rect class="g-hist-bar'+classes+'"'+style+' x="'+(left+gap)+'" y="'+y(n)+'" width="'+(width-2*gap)+'" height="'+(B-y(n))+'"><title>'+esc(exact+' · '+name+' · '+n0(n)+' agents')+'</title></rect>';
    }
    graph+=bar(count,cohort?' g-hist-overall':'',overall.label,cohort?'':fill);
    if(cohort)graph+=bar(view.counts[i],' g-hist-cohort',view.label,fill);
    return '<tr><th scope="row">'+(evidence?esc(exact):range)+'</th><td>'+n0(count)+'</td>'+(cohort?'<td>'+n0(view.counts[i])+'</td>':'')+'</tr>';
  }).join("");
  function reference(kind,value){
    return '<line class="g-hist-'+kind+'" x1="'+x(value)+'" x2="'+x(value)+'" y1="'+T+'" y2="'+B+'"/>';
  }
  graph+=reference('median',H.median);
  if(target!==null){
    if(target>=domainLow&&target<=domainHigh)graph+=reference('target',target);
    else{
      var side=target<domainLow?-1:1,edge=side<0?L:L+P,ay=T+8;
      graph+='<g class="g-hist-target" aria-label="'+esc('Target '+fcValue(target)+' lies '+(side<0?'below':'above')+' the displayed range')+'"><title>'+esc('Target '+fcValue(target))+'</title>'
        +'<path class="g-hist-target-arrow" style="stroke-dasharray:none" d="M '+(edge-10*side)+' '+ay+' H '+(edge+8*side)
        +' m '+(-5*side)+' -5 l '+(5*side)+' 5 l '+(-5*side)+' 5"/></g>';
    }
  }
  var tickSpacing=(domainHigh-domainLow)/bins||1;
  var ticks=domainLow===domainHigh?[low]:H.edges.filter((_,i)=>i%2===0||i===bins);
  ticks.forEach(function(v){
    graph+='<text x="'+x(v)+'" y="'+(B+18)+'" text-anchor="middle">'+esc(chartValue(v,tickSpacing))+'</text>';
  });
  graph+='<text x="'+(L+P/2)+'" y="'+(B+40)+'" text-anchor="middle">'+esc(chartMetricAxis())+'</text></svg>';
  var values='<div class="scroll" tabindex="0" aria-label="Histogram counts"><table><thead><tr><th scope="col">'+esc(ML()+' ('+durationUnitSymbol()+')')+'</th><th scope="col">All agents</th>'+(cohort?'<th scope="col">'+esc(view.label)+'</th>':'')+'</tr></thead><tbody>'+rows+'</tbody></table></div>';
  var selection={agentGroup:cohort?view.label:null};
  var scope=evidence?chartScopeTitle(R,'Agent histogram',selection):presentationScopeTitle(R,selection);
  if(evidence)return '<h3>Agent distribution evidence</h3>'+scope
    +'<p>Each agent contributes one pooled '+esc(ml())+' value. Quartile and decile filters start with the strongest performers and require at least '+n0(H.cohort_floor)+' eligible observations per agent. Cohorts with fewer than two agents are omitted.</p>'
    +'<p>A range includes its lower edge. The upper edge belongs to the next range, except that the final range includes its upper edge.</p>'+'<p>'+esc(palette?.describe||'Direction or a usable specification range is unavailable for interpreting the bar colors.')+'</p>'+values;
  var most=Math.max(...view.counts),topBins=view.counts.reduce((indices,count,index)=>{
    if(count===most)indices.push(index);
    return indices;
  },[]);
  var total=view.counts.reduce((sum,count)=>sum+count,0);
  var leadingRanges=topBins.map(index=>chartValue(H.edges[index],spacing)+'–'+chartValue(H.edges[index+1],spacing));
  var population=cohort?view.label:'the overall distribution';
  var takeaway='In '+population+', '+n0(most)+' of '+n0(total)+' agents fell in each of the '+n0(topBins.length)+' most populated ranges.';
  var facts='<h4>Facts</h4><p>'+n0(total)+' eligible agents. '+(topBins.length>1?'Tied ranges: '+esc(leadingRanges.join(', ')+' '+durationUnitSymbol())+'.':'')+'</p>';
  if(low===high){
    takeaway='All '+n0(total)+' agents in '+population+' recorded '+fcValue(low)+'.';
  }else if(topBins.length===1){
    var topBin=topBins[0],lower=H.edges[topBin],upper=H.edges[topBin+1];
    var range=chartValue(lower,spacing)+'–'+chartValue(upper,spacing)+' '+durationUnitSymbol();
    takeaway='In '+population+', '+n0(most)+' of '+n0(total)+' agents fell in the most populated range, '+range+'.';
  }
  return '<section id="g-observed-histogram" class="g-chart-container-box g-observed-comparison" aria-labelledby="g-observed-histogram-title"><h3 id="g-observed-histogram-title">Distribution of agent performance</h3>'
    +scope
    +'<div class="g-observed-filters">'+reportChartControls("histogram",state)+'</div>'
    +(palette?'<p class="muted">'+esc((lowerBetter?'Lower values are favorable. ':higherBetter?'Higher values are favorable. ':'')+palette.describe)+'</p>':'')
    +gSlideResult(gSlideTakeaway(takeaway,facts),state.histogramView==="table"?values:'<div class="g-histogram-legend">'+chartLegend(legend)+'</div>'+graph)
    +'<button type="button" id="g-histogram-evidence-link" class="g-linkbtn" data-chapter="g-histogram-evidence">See histogram counts in Evidence</button></section>';
}
function redrawObservedChart(id,html){
  var chart=document.getElementById(id);
  var modal=S.modal?.chartMode==="focus"?S.modal:null;
  var slide=(modal?.card===chart?modal.placeholder:chart).closest(".g-question-slide");
  var toolbar=(modal?.card===chart?modal.toolbar:null)||slide?.querySelector(".g-slide-toolbar");
  var active=document.activeElement;
  var focused=chart.contains(active)||toolbar?.contains(active)?active.id:null;
  var collapsed=[...chart.querySelectorAll('details[id]:not([open])')].map(function(detail){return detail.id;});
  chart.outerHTML=html;
  var replacement=document.getElementById(id);
  if(toolbar&&replacement.querySelector('[data-observed-chart],[data-chart-view],[data-chart-expand]')){
    collectSlideControls(replacement,toolbar);
  }
  if(modal?.card===chart){
    modal.card=replacement;
    var movementTitle=replacement.querySelector('#g-component-movement-title');
    if(movementTitle)document.getElementById('g-modal-h').textContent=movementTitle.textContent;
    syncTakeawayEvidence(slide,replacement);
    retainFocusedTakeaway(modal);
  }else if(slide){
    syncSlideSubtitle(slide);
    syncTakeawayEvidence(slide);
  }
  collapsed.forEach(function(id){var detail=document.getElementById(id);if(detail)detail.open=false;});
  if(focused)document.getElementById(focused)?.focus({preventScroll:true});
  gRefreshGuide();
  sizeChartTables();
}
const dailyAhtPlotObserver=new ResizeObserver(entries=>{
  const R=xR();
  if(R)for(const entry of entries)drawDailyAht(entry.target,dailyAhtSelection(R,observedState(R)));
});
let observedDailyAhtPlot;
function sizeChartTables(){
  document.querySelectorAll('.g-requirement-labels').forEach(placeRequirementLabels);
  for(const frame of document.querySelectorAll('.dt-comparison-frame')){
    if(!frame.offsetWidth)continue;
    const short=new Set();
    for(const row of frame.querySelectorAll('.dt-comparison-row')){
      const callout=row.querySelector('.dt-gap-callout'), label=row.querySelector('.dt-gap-label');
      if(!label)continue;
      const mean=parseFloat(row.style.getPropertyValue('--gap-mean'))/100*callout.clientWidth;
      label.style.left=Math.max(0,Math.min(callout.clientWidth-label.offsetWidth,mean-label.offsetWidth/2))+'px';
      const segment=row.querySelector('.dt-gap-segment');
      if(segment&&getComputedStyle(segment.lastElementChild).display!=='none')short.add(segment.dataset.performance);
    }
    for(const item of frame.querySelectorAll('[data-short-key]'))item.hidden=!short.has(item.dataset.shortKey);
  }
  var plot=document.querySelector('.g-stability-plot');
  if(plot!==observedStabilityPlot){
    stabilityPlotObserver.disconnect();
    observedStabilityPlot=plot;
    if(plot)stabilityPlotObserver.observe(plot);
  }
  if(plot)layoutStabilityPlot(plot);
  const dailyPlot=document.querySelector('.g-daily-aht .dt-plot');
  if(dailyPlot!==observedDailyAhtPlot){
    dailyAhtPlotObserver.disconnect();
    observedDailyAhtPlot=dailyPlot;
    if(dailyPlot)dailyAhtPlotObserver.observe(dailyPlot);
  }
  if(dailyPlot&&xR())drawDailyAht(dailyPlot,dailyAhtSelection(xR(),observedState(xR())));
  var expanded=document.querySelector(".g-trend-focus .g-modal-scroll-pane");
  var root=document.getElementById("g-report-presentation");
  if(root&&!root.hidden||expanded){
    for(var pane of document.querySelectorAll('#g-report-presentation .g-slide-content .scroll:has(>table), .g-trend-focus .g-daily-event-table')){
      var rows=pane.querySelector(':scope > table').tBodies[0]?.rows;
      if(!rows||rows.length<=7||!pane.getClientRects().length)continue;
      var last=rows[6].getBoundingClientRect(),bounds=pane.getBoundingClientRect(),zoom=pane.currentCSSZoom||1;
      var scrollbar=Math.max(0,pane.offsetHeight-pane.clientHeight);
      pane.style.setProperty('--table-preview-height',Math.ceil((last.bottom-bounds.top)/zoom+pane.scrollTop+scrollbar)+'px');
      pane.classList.add('g-table-preview');
    }
  }
  if(expanded)expanded.style.setProperty("--chart-table-space",Math.max(120,expanded.clientHeight-180)+"px");
}
document.addEventListener("toggle",function(e){
  if(e.target.matches?.("#g-report-presentation details[open]"))sizeChartTables();
},true);
function agentHeatmapSelection(R,state){
  var map=R.agent_heatmap;
  if(!map?.groupings.length)return null;
  var group=map.groupings.find(item=>item.id===state.agentHeatmapGroup)||map.groupings[0];
  var set=state.agentHeatmapMeasures||'components';
  var columns=map.columns.filter(column=>column.kind==='selected'||column.kind===(set==='peers'?'peer':'component'));
  return {map,group,set,columns};
}
function agentHeatmapFilterFields(R,state){
  var {map,group,set}=agentHeatmapSelection(R,state);
  return observedSelect('g-agent-heatmap-group','Group by',map.groupings.map(item=>[item.id,item.label]),group.id)
    +observedSelect('g-agent-heatmap-measures','Measures',[["components","KPI and components"],["peers","KPI and other measures"]],set);
}
function agentHeatmapPreview(R,state){
  var {group,columns}=agentHeatmapSelection(R,state);
  return {valid:true,text:group.label+' · '+n0(group.rows.length)+' rows · '+n0(columns.length)+' measures'};
}
function gAgentHeatmap(R,evidence=false,complete=false){
  var state=observedState(R),selection=agentHeatmapSelection(R,state);
  if(!selection)return '';
  var {map,group,set,columns}=selection,page=state.agentHeatmapPage||1,pageSize=25,shaded=!evidence&&state.agentHeatmapView!=="table";
  var pages=Array.from({length:Math.ceil(group.rows.length/pageSize)},(_,i)=>[String(i+1),String(i+1)]);
  var first=(page-1)*pageSize,rows=group.rows.slice(first,first+pageSize);
  var ranges=new Map(columns.map(column=>{
    var low=Infinity,high=-Infinity;
    for(var row of group.rows){
      var value=row.cells[column.id]?.value;
      if(Number.isFinite(value)){low=Math.min(low,value);high=Math.max(high,value);}
    }
    return [column.id,[low,high]];
  }));
  function tint(id,value){
    var [low,high]=ranges.get(id);
    if(low===high)return '';
    var scale=Math.max(Math.abs(low),Math.abs(high))||1;
    var span=high/scale-low/scale;
    if(!Number.isFinite(span)||span<=0)return '';
    var weight=Math.round((value/scale-low/scale)/span*46);
    return ' style="--heat-color:color-mix(in srgb,var(--aegean-600) '+weight+'%,var(--surface))"';
  }
  function unit(column){
    if(column.unit==='seconds'&&metricKind()==='seconds')return durationUnitSymbol();
    return {seconds:'sec',points:'pts',percent:'%',fraction:'0–1 score',rating:'rating'}[column.unit];
  }
  function source(column){
    var dataset=(gReportDatasets(R)||[]).find(item=>item.code===column.source);
    return column.source+(dataset?.file?' · '+dataset.file:'');
  }
  var header=columns.map(column=>{
    var coverage=group.coverage[column.id]||0,total=map.totals[column.id]||0;
    return '<th scope="col" title="'+esc(evidence?source(column):column.label)+'">'+esc(column.label)+'<small>'+esc(unit(column)+(evidence?' · '+column.source:''))+'</small>'
      +(coverage<total?'<small>'+n0(coverage)+' of '+n0(total)+' attributed</small>':'')+'</th>';
  }).join('');
  function tableRows(items){return items.map(row=>'<tr><th scope="row">'+esc(row.group)+'</th>'+columns.map(column=>{
    var cell=row.cells[column.id];
    if(!cell)return '<td class="g-hourly-missing"><span aria-label="No eligible observations">—</span></td>';
    if(cell.value===null)return '<td title="The pooled total exceeds the supported numeric range.">Unavailable<small>n = '+n0(cell.count)+'</small></td>';
    var value=column.unit==='seconds'&&metricKind()==='seconds'?cell.value/durationFactor():cell.value;
    var exact=String(value)+' '+unit(column)+' · '+n0(cell.count)+' observations'+(evidence?' · '+source(column):'');
    return '<td'+(shaded?tint(column.id,cell.value):'')+' title="'+esc(exact)+'" aria-label="'+esc(exact)+'">'
      +esc(componentStat(value))+'<small>n = '+n0(cell.count)+'</small></td>';
  }).join('')+'</tr>').join('');}
  var scope=evidence?chartScopeTitle(R,'Heatmap by '+group.label):presentationScopeTitle(R,{agentGroup:group.label});
  function table(items,label){return '<div class="scroll" tabindex="0" aria-label="'+label+'"><table class="g-hourly-grid g-agent-heatmap-grid"><caption>'+esc(group.label)+' results and eligible observation counts</caption>'
    +'<thead><tr><th scope="col">'+esc(group.label)+'</th>'+header+'</tr></thead><tbody>'+tableRows(items)+'</tbody></table></div>';}
  if(complete)return table(group.rows,'Complete agent and group values');
  var shown='<p>'+(evidence?esc(chartScopeText(R,'Report dates'))+'. ':'')+'Showing '+n0(rows.length?first+1:0)+'–'+n0(first+rows.length)+' of '+n0(group.rows.length)+'. A dash marks no eligible observations.</p>';
  var completeControl=evidence&&pages.length>1?'<details data-complete-agent-results><summary>Show all '+n0(group.rows.length)+' results for this grouping</summary></details>':'';
  var takeaway=gSlideTakeaway(group.label+' results include '+n0(group.rows.length)+' rows and '+n0(columns.length)+' measures.',
    shaded?gTakeawayMeaning('Stronger blue marks higher values within each measure. The scale stays the same across pages.'):'' );
  return '<section id="g-agent-heatmap" class="g-chart-container-box" aria-labelledby="g-agent-heatmap-title"><h3 id="g-agent-heatmap-title">Performance by agent and group</h3>'
    +scope+'<div class="g-agent-heatmap-controls"><div class="g-observed-filters">'+reportChartControls("agents",state)
    +(pages.length>1?observedSelect('g-agent-heatmap-page','Page',pages,String(page)):'')+'</div>'
    +'</div>'+shown
    +(columns.some(column=>column.source==='D03'||column.source==='D04')?'<p class="muted">Survey and audit components pool eligible sampled records. Their counts reflect their own source file.</p>':'')
    +(columns.length===1?'<p>No eligible '+(set==='peers'?'peer measures':'component values')+' were available for this report.</p>':'')
    +gSlideResult(takeaway,(shaded?'<span class="g-agent-heatmap-key" aria-hidden="true"></span>':'')+table(rows,'Agent and group values'))
    +completeControl+'</section>';
}
document.addEventListener("toggle",function(event){
  var details=event.target;
  if(details.open&&details.hasAttribute("data-complete-agent-results")&&details.children.length===1){
    details.insertAdjacentHTML("beforeend",gAgentHeatmap(xR(),true,true));
  }
},true);
document.addEventListener("change",function(e){
  var t=e.target;if(t.dataset.observedChart===undefined)return;
  var R=xR(),state=observedState(R),id=t.id;
  if(id==="g-component-choice"){
    selectComponentRelationship(R,t.value);
  }
  else if(id==="g-metric-choice"){
    selectMetricRelationship(R,t.value);
  }
  else if(id==="g-cart-path"){
    selectCartPath(R,t.value);
  }
  else if(id==="g-agent-heatmap-page"){
    state.agentHeatmapPage=Number(t.value);
    redrawObservedChart("g-agent-heatmap",gAgentHeatmap(R,true));
    updateChartEvidence("agents",R);
  }
  else if(id==="g-cohort-kind"){
    state.cohortKind=t.value;
    redrawObservedChart("g-cohorts-panel",insCohorts(R.insights,R));
  }
  else if(id==="g-direct-gap-dimension"){
    state.directGapDimension=t.value;
    redrawObservedChart("g-direct-gap-panel",directGapPanel(R));
  }
  else return;
  document.getElementById(id).focus({preventScroll:true});
});
function fcValue(v){return durationNumber(v,false)+' '+durationUnitSymbol();}
function fcHasTarget(F){return F.forecast.some(week=>Number.isFinite(week.target));}
function fcTrajectory(F){
  var weeks=F.forecast,first=weeks[0],last=weeks.at(-1);
  var flat=weeks.every(week=>week.value===first.value);
  var rising=weeks.every((week,i)=>!i||week.value>=weeks[i-1].value);
  var falling=weeks.every((week,i)=>!i||week.value<=weeks[i-1].value);
  var shape=flat?'stays flat':rising?'rises':falling?'falls':'changes direction';
  return 'The conditional projection '+shape+' from '+fcValue(first.value)+' in the week of '+first.start
    +' to '+fcValue(last.value)+' in the week of '+last.start+'.';
}
function fcChart(F){
  var hist=F.history.map(function(w){return {s:w.start,v:w.value};}),fut=F.forecast.map(function(w){return {s:w.start,v:w.value};}),all=hist.concat(fut),W=640,H=260,L=70,T=14,B=34,Rr=14;
  var vals=all.map(function(p){return p.v;}).concat(F.forecast.map(week=>week.target).filter(Number.isFinite));
  var lo=Math.min.apply(null,vals),hi=Math.max.apply(null,vals),pad=(hi-lo||1)*0.08;lo-=pad;hi+=pad;
  var x=function(i){return L+(W-L-Rr)*i/Math.max(all.length-1,1);},y=function(v){return T+(H-T-B)*(1-(v-lo)/(hi-lo));};
  var line=function(a,off){return a.map(function(p,i){return x(i+off).toFixed(1)+','+y(p.v).toFixed(1);}).join(' ');};
  var joined=[hist[hist.length-1]].concat(fut);
  var split=(x(hist.length-1)+x(hist.length))/2;
  var step=x(1)-x(0);
  var tgt=F.forecast.map((week,i)=>{
    if(!Number.isFinite(week.target))return '';
    var mark=x(hist.length+i),level=y(week.target);
    return '<line class="gc-target" x1="'+(mark-step/2)+'" x2="'+Math.min(W-Rr,mark+step/2)+'" y1="'+level+'" y2="'+level+'"><title>'
      +esc(week.start+' target '+fcValue(week.target))+'</title></line>';
  }).join('');
  var ticks=[lo+pad,(lo+hi)/2,hi-pad].map(function(v){return '<text x="'+(L-6)+'" y="'+(y(v)+4).toFixed(1)+'" text-anchor="end" font-size="11" fill="currentColor">'+esc(durationNumber(v,false))+'</text><line x1="'+L+'" x2="'+(W-Rr)+'" y1="'+y(v).toFixed(1)+'" y2="'+y(v).toFixed(1)+'" stroke="currentColor" opacity=".12"/>';}).join('');
  var legend=[["weekly","Observed weekly "+ml()],["projected","13-week conditional projection",
    tracePointKey('<i class="dt-dot g-projected-point-key"></i>','g-projected-trace-key')]];
  if(fcHasTarget(F))legend.push(["target","Applicable target"]);
  return chartLegend(legend)+'<figure style="margin:0"><svg class="fc-chart" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Weekly '+ml()+' with the 13-week conditional projection" style="width:100%;height:auto;color:var(--ink)">'
   +'<rect x="'+split.toFixed(1)+'" y="'+T+'" width="'+(W-Rr-split).toFixed(1)+'" height="'+(H-B-T)+'" fill="var(--slate-200)" fill-opacity=".35"/>'
   +ticks+tgt+'<text transform="translate(14 '+((H-B+T)/2)+') rotate(-90)" text-anchor="middle" font-size="11" fill="currentColor">'+esc(chartMetricAxis())+'</text>'
   +'<line x1="'+split.toFixed(1)+'" x2="'+split.toFixed(1)+'" y1="'+T+'" y2="'+(H-B)+'" stroke="currentColor" opacity=".3"/>'
   +'<polyline fill="none" stroke="var(--bar)" stroke-width="2" points="'+line(hist,0)+'"/>'
   +'<polyline fill="none" stroke="var(--accent)" stroke-width="2" stroke-dasharray="6 4" points="'+line(joined,hist.length-1)+'"/>'
   +'<text x="'+split+'" y="'+(T+10)+'" text-anchor="end" font-size="10" fill="currentColor">Observed · </text>'
   +'<text x="'+split+'" y="'+(T+10)+'" font-size="10" fill="currentColor">Projected</text>'
   +[0,fut.length-1].map(i=>'<circle class="gc-pt" cx="'+x(hist.length+i)+'" cy="'+y(fut[i].v)+'" r="3"><title>'
     +esc(fut[i].s+' · '+fcValue(fut[i].v))+'</title></circle>').join('')
   +'<text x="'+L+'" y="'+(H-12)+'" font-size="11" fill="currentColor">Week of '+esc(all[0].s)+'</text><text x="'+(W-Rr)+'" y="'+(H-12)+'" text-anchor="end" font-size="11" fill="currentColor">Week of '+esc(all[all.length-1].s)+'</text></svg>'
   +'<figcaption>'+esc('Projection starts '+fut[0].s+' at '+fcValue(fut[0].v)+' and ends '+fut.at(-1).s+' at '+fcValue(fut.at(-1).v)+'.')
   +(Number.isFinite(F.target)?' '+esc('Applicable target '+fcValue(F.target)+'.'):'')+'</figcaption></figure>';
}
function fcCallout(F){
  var assessed=F.forecast.filter(week=>typeof week.target_met==='boolean');
  if(!assessed.length)return 'No account target applies across any complete projected week.';
  var passed=assessed.filter(week=>week.target_met).length;
  var changes=F.forecast.flatMap((week,i)=>{
    var previous=F.forecast[i-1];
    if(!previous||typeof previous.target_met!=='boolean'||typeof week.target_met!=='boolean'||week.target_met===previous.target_met)return [];
    return [week.start+': '+(week.target_met?'meets':'misses')+' '+fcValue(week.target)];
  });
  var reference=Number.isFinite(F.target)?' '+fcValue(F.target):' applicable';
  return n0(passed)+' of '+n0(assessed.length)+' projected weeks with a target meet the'+reference+' target.'
    +(changes.length?' The projected comparison changes in these weeks ('+changes.join(', ')+').':'')
    +(assessed.length<F.forecast.length?' The other projected weeks have no full-week target comparison.':'');
}
function gCh2(R){
  var F=R&&R.forecast;
  var question="What does the conditional forecast show?";
  if(!F||F.status!=='published'){
    var reason=F?.reason?gQuestionSlide("g-slide-projection",question,gSlideTakeaway(F.reason)):'';
    return gArt("chapter-ahead",3,"What's Ahead","Conditional projection unavailable for this selection.",reason,xb("What's ahead","na"));
  }
  return gArt("chapter-ahead",3,"What's Ahead","If the recent pattern continues, this is where "+ml()+" is headed over the next 13 weeks.",
    gQuestionSlide("g-slide-projection",question,projectionPanel(R)),xb("What's ahead","calc"));
}
function projectionPanel(R){
  var F=R.forecast,state=observedState(R),mode=reportViews("projection",state).current[0];
  var flat=F.forecast.every(week=>week.value===F.forecast[0].value);
  var explanation=flat?({"Last value":"The selected method carries the latest observed weekly result forward.",
    "Simple smoothing":"The selected method carries its smoothed weekly level forward."})[F.model.label]:null;
  var takeaway=gSlideTakeaway(fcTrajectory(F),'<h4>Facts</h4>'
    +'<p id="g-forecast-target">'+esc(fcCallout(F))+'</p>'+(explanation?gTakeawayMeaning(explanation):'')
    +'<p>Typical error was '+esc(insDifferenceSize(F.model.mad))+' in one-week tests. The full 13-week path has no separate validation.</p>'
    +'<h4>Next step</h4><p>When the next complete week closes, compare its actual result with that week’s projection and any applicable target.</p>','g-forecast-first');
  var visual='<div class="g-observed-filters">'+reportChartControls("projection",state)+'</div><h4 id="g-forecast-trend" data-slide-content-title>Weekly '+ml()+' and the next 13 weeks</h4>'
   +(mode==="chart"?fcChart(F):forecastValuesTable(F,mode==="history"))
   +'<p class="muted">Prediction ranges and the chance of reaching the target are unavailable.</p>';
  return '<section id="g-projection-panel" class="g-chart-container-box" aria-labelledby="g-forecast-trend">'+gSlideResult(takeaway,visual)
   +'<button type="button" class="g-linkbtn" data-chapter="g-evidence-projection">See how the forecast was built in Evidence</button></section>';
}
function forecastValuesTable(F,history=false){
  var label=history?"Observed":"Projected";
  var requirements=!history&&fcHasTarget(F);
  function comparison(week){
    if(typeof week.target_met!=='boolean')return 'Unavailable';
    var verdict=week.target_met?'Meets target':'Misses target';
    if(week.value!==week.target&&fcValue(week.value)===fcValue(week.target)){
      verdict+=' · '+insDifferenceSize(week.value-week.target)+(week.value>week.target?' above':' below');
    }
    return esc(verdict);
  }
  return '<div class="scroll" tabindex="0" aria-label="'+label+' weekly values"><table><thead><tr><th scope="col">Week of</th><th scope="col" class="n">'+label+' ('+durationUnitSymbol()+')</th>'
    +(requirements?'<th scope="col">Applicable target</th><th scope="col">Projected comparison</th>':'')+'</tr></thead><tbody>'
    +(history?F.history:F.forecast).map(w=>'<tr><th scope="row">'+esc(w.start)+'</th><td class="n">'+fcValue(w.value)+'</td>'
      +(requirements?'<td>'+(Number.isFinite(w.target)?fcValue(w.target):'—')+'</td><td>'+comparison(w)+'</td>':'')+'</tr>').join('')+'</tbody></table></div>';
}
function fcEvidence(R){
  var F=R&&R.forecast;if(!F)return '';
  if(F.status!=='published')return '<h3>How the forecast was built</h3><p>'+esc(F.reason)+'</p>';
  var m=F.model,b=F.benchmark,pct=function(x){return x===null||x===undefined?'':x.toFixed(1)+'%';};
  return '<h3>How the forecast was built</h3>'+chartScopeTitle(R,'Conditional projection')+'<p>'+esc(fcTrajectory(F))+'</p><p>'+esc(fcCallout(F))+'</p><p class="muted">Weekly values use complete Monday to Sunday weeks inside the chosen dates ('+n0(F.history.length)+' weeks). Each method was scored on its one-step-ahead errors for '+n0(F.scored_origins)+' weeks it had not seen. Mean absolute deviation is the main measure. The other measures are shown for information. A method replaces carrying the last week forward only if its main error is more than '+Math.round(F.improvement_required*100)+'% lower.</p>'
   +'<p class="muted">The 13-week forecast has no separate holdout check. The typical error in the target outlook comes from the one-week comparisons.</p>'
   +'<div class="scroll"><table><thead><tr><th>Method</th><th class="n">Mean absolute deviation</th><th class="n">Mean absolute percentage error</th><th class="n">Mean squared deviation</th></tr></thead><tbody>'
   +'<tr><td>'+esc(m.label)+' (used)</td><td class="n">'+fcValue(m.mad)+'</td><td class="n">'+pct(m.mape)+'</td><td class="n">'+m.msd.toFixed(1)+'</td></tr>'
   +(m.beat_benchmark?'<tr><td>'+esc(b.label)+' (benchmark)</td><td class="n">'+fcValue(b.mad)+'</td><td class="n">'+pct(b.mape)+'</td><td class="n">'+b.msd.toFixed(1)+'</td></tr>':'')+'</tbody></table></div>'
   +'<h4>Projected weeks</h4>'+forecastValuesTable(F)+'<h4>Observed weekly history</h4>'+forecastValuesTable(F,true);
}
var INS_DIMENSIONS={line_of_business:'Line of Business',contact_type:'Contact type',tenure_group:'Tenure group',training_wave:'Training wave',team_lead:'Team lead',manager:'Manager'};
function insDifferenceSize(value){return durationNumber(Math.abs(value),false)+' '+(metricKind()==='percent'?'percentage points':durationUnitSymbol());}
function insSignedGap(value){return (value>0?'+':value<0?'−':'')+insDifferenceSize(value);}
function signedComparisonBars(rows,label){
  if(!rows.length)return '';
  var bound=Math.max(...rows.map(row=>Math.abs(row.value)))||1;
  var displayedBound=(bound/durationFactor()).toLocaleString('en-US',{maximumSignificantDigits:3});
  var unit=metricKind()==='percent'?'percentage points':durationUnitSymbol();
  return '<div class="g-signed-plot" role="group" aria-label="'+esc(label)+'">'+rows.map(function(row){
    var offset=50*(row.value/bound);
    return '<div class="g-signed-row"><div class="g-signed-label"><strong>'+esc(row.key)+'</strong>'
      +(row.status?'<small class="muted">'+esc(row.status)+'</small>':'')
      +'<span>'+esc(insSignedGap(row.value))+'</span></div>'
      +'<div class="g-signed-track" aria-hidden="true"><i'+(row.unconfirmed?' class="is-unconfirmed"':'')
      +' style="left:'+(50+Math.min(0,offset))+'%;width:'+Math.abs(offset)+'%"></i></div></div>';
  }).join('')+'<div class="g-signed-axis" aria-hidden="true"><span>−'+esc(displayedBound)+'</span><span>0 '+esc(unit)
    +'</span><span>+'+esc(displayedBound)+'</span></div></div>';
}
function factorSelection(R,state){
  var segments=R.insights?.segments||{};
  var options=Object.keys(segments).filter(dim=>segments[dim].length);
  if(!options.length)return null;
  var dim=options.includes(state.factorDimension)?state.factorDimension:options[0];
  return {options,dim,rows:segments[dim],label:INS_DIMENSIONS[dim]||dim};
}
function factorFilterFields(R,state){
  var {options,dim}=factorSelection(R,state);
  return observedSelect('g-factor-dimension','Group by',options.map(key=>[key,INS_DIMENSIONS[key]||key]),dim);
}
function factorPreview(R,state){
  var {rows,label}=factorSelection(R,state);
  return {valid:true,text:label+' · '+n0(rows.filter(row=>Number.isFinite(row.gap)).length)+' of '+n0(rows.length)+' groups with an adjusted comparison'};
}
function insSegments(R,evidence=false){
  var state=observedState(R),selection=factorSelection(R,state);
  if(!selection)return '';
  var {rows,label}=selection,scope='';
  var gaps=rows.filter(g=>Number.isFinite(g.gap)).map(g=>({key:g.key,value:g.gap,status:"Descriptive only",unconfirmed:true}));
  var values='<div class="scroll" tabindex="0" aria-label="Adjusted group values"><table><thead><tr><th scope="col">Group</th><th scope="col" class="n">'+gCountLabel()+'</th><th scope="col" class="n">'+ML()+'</th><th scope="col" class="n">Adjusted difference from the rest</th><th scope="col">Result</th></tr></thead><tbody>'
    +rows.map(function(g){var verdict=Number.isFinite(g.gap)?"Descriptive only":"Unavailable";
      return '<tr><th scope="row">'+esc(g.key)+'</th><td class="n">'+n0(g.contacts)+'</td><td class="n">'+(g.value===null?'':fcValue(g.value))+'</td><td class="n">'+(g.gap===null?'':insSignedGap(g.gap))+'</td><td>'+verdict+'</td></tr>';}).join('')+'</tbody></table></div>';
  if(evidence)return '<h3>Adjusted group comparison evidence</h3>'+scope+values;
  var cleared=rows.filter(g=>g.checks?.some(check=>check.check==="Gap large enough"&&check.outcome==="pass")).length;
  var takeaway=cleared?n0(cleared)+(cleared===1?' group cleared':' groups cleared')+' the descriptive 5% gap screen. Adjusted differences remain descriptive.'
    :gaps.length?'No group cleared all the coverage and descriptive size screens. Adjusted differences shown here describe the observed shared work.'
    :'No adjusted differences are available for this grouping.';
  return '<div id="g-factor-segments"><div class="g-observed-filters">'+reportChartControls("gaps",state)+'</div>'+scope
    +'<h4>'+esc(label)+'</h4>'+gSlideTakeaway(takeaway)+(state.factorView==="table"?values:signedComparisonBars(gaps,label+" adjusted differences from the rest"))
    +'<button type="button" id="g-gaps-evidence-link" class="g-linkbtn" data-chapter="g-gaps-evidence">See adjusted group values in Evidence</button></div>';
}
function insPairwise(I,selected,evidence=false){
  if(!I.pairwise)return '';
  function gapText(pair,gap){
    if(gap===0)return "Same observed value";
    return esc(insDifferenceSize(gap)+" higher in "+(gap>0?pair.first:pair.second));
  }
  var comparisons=Object.entries(I.pairwise).filter(([dim])=>!selected||dim===selected).map(function([dim,view]){
    var title='<section id="'+(evidence?'g-evidence-direct-pairs-':'g-direct-pairs-')+esc(dim)+'"><h4>'+esc(OBSERVED_DIMENSIONS[dim])+'</h4>';
    if(!view.pairs.length)return title+'<p>At least two groups with '+n0(I.assumptions.min_contacts)+' eligible observations each are needed.</p></section>';
    var note=view.shown_groups<view.groups?'<p class="muted">Showing '+n0(view.shown_groups)+' of '+n0(view.groups)+' groups. Groups below '+n0(I.assumptions.min_contacts)+' eligible observations are left out. If more than ten qualify, the ten with the most observations are shown.</p>':'';
    return title+note+'<div class="scroll"><table><thead><tr><th scope="col">Pair</th><th scope="col">Observed gap</th><th scope="col">Gap at the same work mix</th><th scope="col">Shared work mix</th></tr></thead><tbody>'
      +view.pairs.map(function(pair){
        var coverage=pair.counts.map(function(count,i){return n0(pair.shared_counts[i])+' of '+n0(count);}).join(' · ');
        return '<tr><th scope="row">'+esc(pair.first+' and '+pair.second)+'</th><td>'+gapText(pair,pair.observed_gap)+'</td><td>'
          +(pair.mix_gap===null?'Too little overlap':gapText(pair,pair.mix_gap))+'</td><td>'+coverage+'</td></tr>';
      }).join("")+'</tbody></table></div></section>';
  }).join("");
  return '<details open class="g-values"'+(evidence?'':' id="g-factor-pairwise"')+'><summary>Compare two groups directly</summary>'
    +'<p>Observed gaps use each group’s eligible results. Where both groups have at least 90% of their observations in categories they share, Athena also shows the gap at the pair’s combined work mix. For Lines of Business, the shared categories are contact drivers. For contact drivers, they are Lines of Business.</p>'
    +'<p class="muted">These are descriptive comparisons. Uncertainty intervals and statistical verdicts require a qualified pairwise method.</p>'+comparisons+'</details>';
}
function directGapPanel(R){
  var dims=Object.keys(R.insights.pairwise||{});
  if(!dims.length)return '';
  var state=observedState(R),selected=dims.includes(state.directGapDimension)?state.directGapDimension:dims[0];
  var pairs=R.insights.pairwise[selected].pairs;
  var lead=[...pairs].sort((a,b)=>Math.abs(b.observed_gap)-Math.abs(a.observed_gap))[0];
  var answer=!lead?'At least two eligible groups are needed to compare this dimension.'
    :lead.observed_gap===0?'The displayed groups shared the same observed result.'
    :'The largest observed gap was '+insDifferenceSize(lead.observed_gap)+' between '+lead.first+' and '+lead.second+'.';
  var coverage=lead?'<h4>Facts</h4><p>'+esc(lead.mix_gap===null
    ?'The two groups shared too little work for an adjusted comparison.'
    :'The shared-work comparison gave a gap of '+insDifferenceSize(lead.mix_gap)+'.')+'</p>':'';
  return '<div id="g-direct-gap-panel"><div class="g-observed-filters">'+observedSelect("g-direct-gap-dimension","Compare by",dims.map(dim=>[dim,OBSERVED_DIMENSIONS[dim]]),selected)+'</div>'
    +gSlideResult(gSlideTakeaway(answer,coverage),insPairwise(R.insights,selected))
    +'<button type="button" class="g-linkbtn" data-chapter="g-evidence-direct-pairs-'+esc(selected)+'">See this group comparison in Evidence</button></div>';
}
function cldEvidence(I,showFactors){
  if(!I?.pairwise)return '';
  return Object.entries(I.pairwise).map(function([dimension,view]){
    var adjusted=view.pairs.filter(pair=>pair.mix_gap!==null).length;
    return '<section id="g-cld-evidence-'+esc(dimension)+'"><h4>'+esc(OBSERVED_DIMENSIONS[dimension])+' pairwise coverage</h4>'
      +'<p>The full pairwise table has '+n0(view.pairs.length)+' descriptive pairs across '+n0(view.shown_groups)+' of '+n0(view.groups)+' groups. '
      +n0(adjusted)+' pairs have at least 90% shared work mix on both sides. Letters require direct pairwise inference that accounts for repeated agents, work-mix coverage and multiple comparisons.</p>'
      +'<button type="button" class="g-linkbtn" data-chapter="g-evidence-direct-pairs-'+esc(dimension)+'">See the direct gaps</button></section>';
  }).join('')+(showFactors?'':insPairwise(I,null,true));
}
function insCohortTable(c,title,kind,table=true){
  if(!c)return '';
  if(c.blocked)return '<h3>'+title+'</h3><p>'+esc((c.blocked[0]||{}).reason||'Not available for this selection.')+'</p>';
  function cohortName(q){return kind+' '+q.position+(q.label==='best'||q.label==='worst'||kind==='Quartile'?' ('+q.label+')':'');}
  var bars=c.cohorts.filter(function(q){return Number.isFinite(q.value);}).map(function(q){return {key:cohortName(q),value:q.value};});
  return '<h3>'+title+'</h3>'+(table?'<div class="scroll"><table><thead><tr><th>Group</th><th>Agents</th><th>'+gCountLabel()+'</th><th>'+ML()+'</th></tr></thead><tbody>'
    +c.cohorts.map(function(q){return '<tr><th scope="row">'+esc(cohortName(q))+'</th><td>'+n0(q.n_agents)+'</td><td>'+n0(q.observations)+'</td><td>'+(q.value===null?'':fcValue(q.value))+'</td></tr>';}).join('')+'</tbody></table></div>'
    :comparisonBars(bars,q=>fcValue(q.value),fcValue,ML()+" by "+title.toLowerCase(),true));
}
function insCohorts(I,R,evidence=false){
  var c=I.cohorts,d=I.deciles;
  if(!c&&!d)return '';
  if(evidence)return reportCard('g-cohort-evidence-quartiles',insCohortTable(c,'Quartiles','Quartile'))
    +reportCard('g-cohort-evidence-deciles',insCohortTable(d,'Deciles','Decile'));
  var state=observedState(R),deciles=!!d&&(!c||state.cohortKind==="deciles"),chosen=deciles?d:c;
  var values=(chosen.cohorts||[]).filter(cohort=>Number.isFinite(cohort.value)),best=values[0],worst=values.at(-1);
  var comparison=best&&best!==worst
    ?'The highest-ranked '+n0(best.n_agents)+' agents recorded '+fcValue(best.value)+' versus '+fcValue(worst.value)
      +' among the lowest-ranked '+n0(worst.n_agents)+'.'
    :'The selected bands do not have two distinct pooled results to compare.';
  return '<section id="g-cohorts-panel" class="g-chart-container-box"><div class="g-observed-filters">'+reportChartControls("cohorts",state)
    +(c&&d?observedSelect("g-cohort-kind","Cohort bands",[["quartiles","Quartiles"],["deciles","Deciles"]],deciles?"deciles":"quartiles"):'')+'</div>'
    +gSlideResult(gSlideTakeaway(chosen.blocked?(chosen.blocked[0]?.reason||'This cohort grouping is unavailable.'):comparison,
      (chosen.blocked?'':'<h4>Facts</h4><p>'+n0(chosen.n_ranked)+' agents met the minimum of '+n0(chosen.floor)+' eligible observations per agent. Exact ties stay in the same band.</p>')
      +'<button type="button" class="g-linkbtn" data-chapter="g-cohort-evidence-'+(deciles?'deciles':'quartiles')+'">See these cohort results in Evidence</button>'),
      insCohortTable(chosen,deciles?'Deciles':'Quartiles',deciles?'Decile':'Quartile',state.cohortView==="table"))+'</section>';
}
function matchEvidence(R){var d=R&&R.match_disclosure;if(!d||!d.length)return '';
  return '<h3>How surveys and audits match the main file</h3><p class="muted">A survey or audit may name an interaction that is not in the main file, and many contacts have neither. Rows are kept either way. What matters is that the dates overlap the analysis period.</p>'
   +'<div class="scroll"><table><thead><tr><th>File</th><th class="n">Rows</th><th class="n">Found in the main file</th><th class="n">Not in the main file</th><th class="n">Matched in the analysis dates</th><th>Dates in the file</th></tr></thead><tbody>'
   +d.map(function(x){return '<tr><td>'+esc(x.label)+'</td><td class="n">'+n0(x.rows)+'</td><td class="n">'+(x.checkable?n0(x.matched):'—')+'</td><td class="n">'+(x.checkable?n0(x.not_in_main):'—')+'</td><td class="n">'+(x.checkable?n0(x.matched_in_period):'—')+'</td><td>'+esc((x.date_min||'')+' to '+(x.date_max||''))+(x.overlaps_period===false?' (does not overlap the analysis dates)':'')+(x.checkable?'':' (an agent-day main file has no interaction IDs, so the match cannot be checked)')+'</td></tr>';}).join('')+'</tbody></table></div>';}
function insEvidence(I){
  var names=INS_DIMENSIONS;
  function share(value){return Number.isFinite(value)?Math.round(value*100)+'%':'—';}
  var seg=Object.keys(I.segments||{}).map(function(dim){return (I.segments[dim]||[]).map(function(g){
    var shown=Number.isFinite(g.gap);
    return '<tr><td>'+esc(names[dim]||dim)+'</td><td>'+esc(g.key)+'</td><td class="n">'+n0(g.contacts)+'</td><td class="n">'+(g.agents===null?'—':n0(g.agents))+'</td><td class="n">'+(g.agents_rest===null?'—':n0(g.agents_rest))+'</td><td class="n">'+share(g.held_constant_share)+'</td><td class="n">'+share(g.rest_held_constant_share)+'</td><td class="n">'+(shown?insSignedGap(g.gap):'—')+'</td><td>'+esc((g.checks||[]).map(c=>c.check+' ('+c.outcome+')').join(', '))+'</td><td>'+(shown?'Descriptive only':'Unavailable')+(g.reason?': '+esc(g.reason):'')+'</td></tr>';
  }).join('');}).join('');
  var m=I.roster_match,rm=m?'<p>Agent roster: '+n0(m.agents_in_roster)+' of '+n0(m.agents_in_data)+' agents in the data were found in the roster, covering '+(m.contacts_with_agent?Math.round(100*m.contacts_matched/m.contacts_with_agent):0)+'% of the contacts that have an agent. Tenure is counted from the hire date to the day of the work. Agents not in the roster stay in every total but are not placed in a tenure, wave, team lead or manager group.</p>':'<p>No agent roster was supplied, so tenure, training wave, team lead and manager groups were not assessed.</p>';
  var co=(I.cohorts&&!I.cohorts.blocked)?'<p>Agent groups: '+n0(I.cohorts.n_ranked)+' agents ranked with at least '+n0(I.cohorts.floor)+' eligible observations each; '+n0(I.cohorts.n_unranked)+' agents below that are not ranked.</p>':'';
  return '<h3>How group differences were calculated</h3><p class="muted">Athena compares the group with all remaining eligible observations, including observations without a group label. It weights both sides by the remaining observations in the categories shared by both sides. The coverage columns show what share of each side’s observations falls in those categories. The checks describe coverage, size and how large the gap is. The adjusted difference is descriptive because it requires its own qualified confirmation test.</p>'
   +'<div class="scroll"><table><thead><tr><th>Dimension</th><th>Group</th><th class="n">Group observations</th><th class="n">Agents in group</th><th class="n">Agents in the rest</th><th class="n">Group coverage</th><th class="n">Rest coverage</th><th class="n">Adjusted difference</th><th>Checks</th><th>Result</th></tr></thead><tbody>'+seg+'</tbody></table></div>'+co+rm;}

function insMix(I,R,evidence=false){
  var m=I.mix;if(!m)return '';
  var title='<h3>What contributed to the change in '+esc(ml())+'</h3>';
  if(m.blocked){
    var reason=(m.blocked[0]||{}).reason||'Not available.';
    return title+(evidence?'<p>'+esc(reason)+'</p>':gSlideTakeaway(reason));
  }
  function movement(v){return v===0?'had no net effect':(v<0?'lowered':'raised')+' the result by '+amount(v);}
  function amount(v){
    var shown=Math.abs(v)/durationFactor(),unit=metricKind()==='percent'?'percentage points':durationUnitSymbol();
    return (shown<.01?'less than 0.01':shown.toLocaleString('en-US',{maximumFractionDigits:shown>=1?1:2}))+' '+unit;
  }
  var overall=m.change===0?'stayed the same':(m.change<0?'fell by ':'rose by ')+amount(m.change);
  var volume=gCountLabel(R).toLowerCase();
  var comparison=m.baseline_dates&&m.evaluated_dates
    ?m.baseline_dates.join(' to ')+' ('+fcValue(m.value_baseline)+', '+n0(m.contacts.baseline)+' '+volume+') and '
      +m.evaluated_dates.join(' to ')+' ('+fcValue(m.value_evaluated)+', '+n0(m.contacts.evaluated)+' '+volume+').':'';
  var endpoints=Number.isFinite(m.value_baseline)&&Number.isFinite(m.value_evaluated)
    ?'<ul class="g-mix-endpoints" aria-label="Observed performance and change">'
      +[['First half',m.value_baseline],['Second half',m.value_evaluated],['Overall change',m.change]].map(([label,value],i)=>
        '<li><span>'+label+'</span><strong>'+esc(i===2?insSignedGap(value):fcValue(value))+'</strong></li>').join('')+'</ul>':'';
  var rate=Math.abs(m.rate_effect),mix=Math.abs(m.mix_effect);
  var contribution=rate===mix?(rate===0?'Neither component contributed to a change.':'The two contributions were equal in size.')
    :rate>mix?'Changes within Lines of Business made the larger contribution.':'The shift in work share across Lines of Business made the larger contribution.';
  var state=observedState(R),rows=[{key:"Performance within Lines of Business",value:m.rate_effect},{key:"Share of "+volume+" by Line of Business",value:m.mix_effect}];
  var table='<div class="scroll"><table><thead><tr><th>Contribution</th><th>Change</th></tr></thead><tbody>'
    +rows.concat({key:"Overall change",value:m.change}).map(row=>'<tr><th scope="row">'+esc(row.key)+'</th><td>'+esc(insSignedGap(row.value))+'</td></tr>').join('')+'</tbody></table></div>';
  if(evidence)return title+(comparison?'<p>'+esc(comparison)+'</p>':'')+table+'<p>The breakdown compares changes in each line’s performance and changes in its share of eligible volume. The contributions add up to the overall change.</p>';
  return '<section id="g-work-mix" class="g-chart-container-box"><div class="g-observed-filters">'+reportChartControls("mix",state)+'</div>'
    +gSlideResult(gSlideTakeaway(ML()+' '+overall+' between the first and second halves of the observed dates. '+contribution,
      '<h4>Facts</h4>'+(comparison?'<p>'+esc(comparison)+'</p>':'')+'<ul>'+rows.map(row=>'<li>'+esc(row.key+' '+movement(row.value)+'.')+'</li>').join('')+'</ul>'),
      title+endpoints+(state.mixView==="table"?table:signedComparisonBars(rows,"Contributions to the overall change")))+'</section>';
}
function insConstraints(I,R,evidence=false){var c=I.constraints;if(!c||!c.pools.length)return '';
  var rows=c.pools.filter(function(p){return p.share>0;});if(!rows.length)return '';
  var un=c.pools.filter(function(p){return p.unclassified;}).reduce(function(a,p){return a+p.share;},0);
  var highest=Math.max(...rows.map(p=>p.controllable));
  var leaders=rows.filter(p=>p.controllable===highest);
  var share=percentNumber(leaders[0].share*100)+'%';
  var occurrenceCount=value=>displayNumber(value,0,12);
  var countFacts=occurrenceCount(leaders[0].controllable)+' of '+occurrenceCount(c.total_controllable)+' recorded controllable occurrences'+(leaders.length>1?' per leading label':'')+'.';
  var sourceFacts='Counts come from the selected account’s rows in the uploaded constraint table. The table supplies no dates or contact types for these counts.';
  var cutoffFacts='A label is included when at least half of its positive share falls at or below the 80% cutoff.';
  var takeaway=leaders.length===1
    ?leaders[0].level2+' had the largest share of recorded controllable occurrences at '+share+'.'
    :n0(leaders.length)+' labels tied for the largest share of recorded controllable occurrences at '+share+' each.';
  var table='<div class="scroll"><table><thead><tr><th>Rank</th><th>Constraint category</th><th>Constraint</th><th>Occurrences</th><th>Share</th><th>Cumulative</th><th>Category</th></tr></thead><tbody>'
   +rows.map(function(p,i){return '<tr><td>'+(i+1)+'</td><td>'+esc(p.level1)+'</td><th scope="row">'+esc(p.level2)+'</th><td>'+occurrenceCount(p.controllable)+'</td><td>'+percentNumber(p.share*100)+'%</td><td>'+percentNumber(p.cumulative*100)+'%</td><td>'+(p.vital_few?'Priority':'Not-priority')+'</td></tr>';}).join('')+'</tbody></table></div>';
  var state=observedState(R);
  if(evidence)return '<h3>Share of controllable constraints by label</h3><p>'+esc(countFacts)+'</p><p>'+sourceFacts+'</p>'+table
    +'<p>'+cutoffFacts+'</p>'
    +(un>0?'<p>'+percentNumber(un*100)+'% of recorded controllable counts had unclassified labels.</p>':'');
  return '<section id="g-constraints" class="g-chart-container-box"><div class="g-observed-filters">'+reportChartControls("constraints",state)+'</div>'
    +gSlideResult(gSlideTakeaway(takeaway,'<h4>Facts</h4><p>'+esc(countFacts)+'</p><p>'+sourceFacts+'</p><p>'+cutoffFacts+'</p>'
      +(un>0?'<p>'+Math.round(un*100)+'% had unclassified labels.</p>':'')),
      '<h3>Share of controllable constraints by label</h3>'+(state.constraintsView==="table"?table:
      paretoChart(rows.map(p=>({...p,key:p.level2})),"Share of controllable constraints","Share of recorded controllable counts (%)","Labels within the 80% cutoff")))+'</section>';
}
function paretoChart(rows,label,axisLabel,highlightLabel){
  var width=1000,rowHeight=42,barHeight=rowHeight/1.05,height=rowHeight*rows.length,ticks=[0,.2,.4,.6,.8,1];
  function x(share){return share*width;}
  function y(i){return rowHeight*(i+.5);}
  function pct(share){return n1(share*100)+'%';}
  var grid=ticks.map(function(share){
    return '<line x1="'+x(share)+'" x2="'+x(share)+'" y1="0" y2="'+height+'" vector-effect="non-scaling-stroke" stroke="var('+(share===.8?'--accent':'--line')+')"'+(share===.8?' stroke-dasharray="5 4"':'')+'/>';
  }).join('');
  var bars=rows.map(function(row,i){
    return '<rect x="0" y="'+(y(i)-barHeight/2)+'" width="'+x(row.share)+'" height="'+barHeight+'" fill="var('+(row.vital_few?'--accent':'--bar')+')"'+(row.vital_few?'':' opacity=".45"')+'>'
      +'<title>'+esc(row.key)+' · '+pct(row.share)+' share · '+pct(row.cumulative)+' cumulative</title></rect>';
  }).join('');
  var line=rows.map(function(row,i){return x(row.cumulative)+','+y(i);}).join(' ');
  var labels=rows.map(function(row){
    var name=esc(row.key);
    return '<div class="g-pareto-label" tabindex="0"><span class="g-pareto-label-text">'+name+'</span><span class="g-pareto-full" aria-hidden="true">'+name+'</span></div>';
  }).join('');
  var legend=[];
  if(rows.some(function(row){return row.vital_few;}))legend.push(["highlight",highlightLabel]);
  if(rows.some(function(row){return !row.vital_few;}))legend.push(["rest",legend.length?"Other categories":"Category share"]);
  if(rows.length>1)legend.push(["cumulative","Cumulative share"]);
  legend.push(["threshold","80% cutoff"]);
  return '<div role="group" aria-label="'+esc(label)+'">'+chartLegend(legend)+'<div class="scroll" tabindex="0" aria-label="'+esc(label)+'"><div class="g-pareto" style="--pareto-row:'+rowHeight+'px"><div>'+labels+'</div><div>'
    +'<svg viewBox="0 0 '+width+' '+height+'" height="'+height+'" preserveAspectRatio="none" role="img" aria-label="'+esc(label)+' in descending order">'
    +grid+bars+(rows.length>1?'<polyline fill="none" stroke="var(--ink)" stroke-width="2" vector-effect="non-scaling-stroke" points="'+line+'"/>':'')+'</svg>'
    +'<div class="g-pareto-axis">'+ticks.map(function(tick){return '<span>'+Math.round(tick*100)+'%</span>';}).join("")+'</div>'
    +'<p class="g-pareto-unit">'+esc(axisLabel)+'</p></div></div></div></div>';
}
function insContactDriverImpact(impact,R,evidence=false){
  if(!impact)return '';
  var kpi={aht:'AHT',csat:'CSAT',qa_score:'QA'}[metricId()];
  function amount(value){
    var v=Math.abs(value),unit=durationUnitSymbol();
    if(metricKind()==='seconds')v/=durationFactor();
    if(metricKind()==='percent')unit='percentage points';
    return v.toLocaleString('en-US',{maximumSignificantDigits:3})+' '+unit;
  }
  var adverse=impact.adverse.length?'<h4>Largest unfavorable gaps</h4><ol>'+impact.adverse.map(function(row){
    var move=impact.direction==='lower_is_better'?'above':'below';
    return '<li><strong>'+esc(row.key)+'</strong> was '+move+' the selected '+kpi+' average, with a volume-weighted difference of '+esc(amount(row.impact))+'.</li>';
  }).join('')+'</ol>':'';
  var detail=impact.rows.map(function(row,i){
    var signed=(row.impact<0?'−':row.impact>0?'+':'')+amount(row.impact);
    return '<tr><td>'+(i+1)+'</td><td>'+esc(row.key)+'</td><td class="n">'+n0(row.count)+'</td><td class="n">'+esc(fcValue(row.value))+'</td>'
      +'<td class="n">'+esc(signed)+'</td><td class="n">'+n1(row.share*100)+'%</td><td class="n">'+n1(row.cumulative*100)+'%</td><td>'+(row.vital_few?'Vital few':'')+'</td></tr>';
  }).join('');
  var table='<div class="scroll"><table><thead><tr><th>Rank</th><th>Contact driver</th><th>Eligible volume</th><th>'+kpi+'</th><th>Signed impact</th><th>Share of impact</th><th>Cumulative</th><th>Pareto group</th></tr></thead><tbody>'
    +detail+'</tbody></table></div>';
  var state=observedState(R);
  if(evidence)return '<h3>Contact driver impact</h3>'+table+adverse
    +'<p>Impact weights the difference from the selected average by eligible volume. Positive impact is favorable. A row is in the priority set when it has a nonzero share and at least half of that share falls at or below the 80% cutoff.</p>';
  var leader=impact.adverse[0],leaders=leader?impact.rows.filter(row=>row.impact===leader.impact):[];
  var answer=leader?leaders.map(row=>row.key).join(', ')+(leaders.length>1?' tied for':' had')+' the largest unfavorable volume-weighted gap of '+amount(leader.impact)+'.'
    :'The selected work mix has no unfavorable driver gap to rank.';
  return '<section id="g-driver-impact" class="g-chart-container-box"><div class="g-observed-filters">'+reportChartControls("drivers",state)+'</div>'
    +gSlideResult(gSlideTakeaway(answer,
      '<h4>Facts</h4><p>The selected '+kpi+' average was '+esc(fcValue(impact.baseline))+'. Impact combines each driver’s difference with eligible volume.</p>'+adverse),
      '<h3>Contact driver impact</h3>'+(state.driversView==="table"?table:
      paretoChart(impact.rows,"Contact driver impact","Share of absolute impact (%)","Drivers within the 80% cutoff")))+'</section>';
}
function componentStat(value){
  return value!==0&&(Math.abs(value)<.001||Math.abs(value)>=1e6)?value.toExponential(2)
    :value.toLocaleString('en-US',{maximumSignificantDigits:4});
}
function componentOutcomeTitle(links){
  if(links.source==='D01')return chartMetricAxis();
  if(links.outcome==='pass_rate')return links.source==='D03'?'Customer satisfaction rate (Percent)':'Quality assurance pass rate (Percent)';
  return links.source==='D03'?'Customer satisfaction (Supplied score)':'Quality assurance (Supplied score)';
}
function fittedRangeText(fit,xTitle,yTitle){
  if(fit?.length!==2||!fit.every(point=>point.every(Number.isFinite)))return '';
  return 'On the fitted line, '+yTitle+' is '+componentStat(fit[0][1])+' at '+xTitle+' '+componentStat(fit[0][0])
    +' and '+componentStat(fit[1][1])+' at '+xTitle+' '+componentStat(fit[1][0])+'.';
}
function componentPlot(links,row,relationship,evidence=false){
  var factor=links.source==='D01'?durationFactor():1;
  var xFactor=relationship?1:factor;
  var yFactor=relationship?durationFactor():factor;
  var points=relationship?relationship.weeks.map(function(week){
    return {date:week.start,x:week.measure/xFactor,y:week.outcome/yFactor,
      counts:n0(week.measure_count)+' measure observations · '+n0(week.outcome_count)+' KPI observations'};
  }):links.weeks.map(function(week,i){
    return {date:week.start,count:week.count,x:row.weekly_values[i]/factor,y:links.outcome_values[i]/factor};
  });
  var fit=(row.fit||[]).map(function(pair){return {x:pair[0]/xFactor,y:pair[1]/yFactor};});
  var W=680,H=300,L=84,T=14,P=574,B=240;
  function axis(values,start,span){
    var min=Infinity,max=-Infinity;
    for(var value of values){min=Math.min(min,value);max=Math.max(max,value);}
    var norm=Math.max(Math.abs(min),Math.abs(max))||1;
    var low=min/norm,high=max/norm;
    if(low===high)return {at:function(){return start+span/2;},ticks:[{at:start+span/2,label:componentStat(low*norm)}]};
    var position=function(value){return start+span*(.04+.92*(value-low)/(high-low));};
    return {at:function(value){return position(value/norm);},ticks:Array.from({length:5},function(_,i){
      var value=low+(high-low)*i/4;
      return {at:position(value),label:componentStat(value*norm)};
    })};
  }
  var all=points.concat(fit);
  var x=axis(all.map(function(p){return p.x;}),L,P),y=axis(all.map(function(p){return p.y;}),B,T-B);
  var unit={D01:durationUnitName(true),D03:'Supplied rating',D04:'Points'}[links.source];
  var xTitle=row.label+' ('+(relationship?relationship.unit:unit)+')';
  var yTitle=relationship?ML()+' ('+durationUnitName(true)+')':componentOutcomeTitle(links);
  var chart='<svg class="g-chart" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+esc(yTitle+' by '+xTitle+' across '+n0(points.length)+' comparable weeks')+'">';
  y.ticks.forEach(function(t){chart+='<line class="gc-grid" x1="'+L+'" x2="'+(L+P)+'" y1="'+t.at+'" y2="'+t.at+'"/><text x="'+(L-7)+'" y="'+(t.at+4)+'" text-anchor="end">'+esc(t.label)+'</text>';});
  x.ticks.forEach(function(t){chart+='<line class="gc-grid" x1="'+t.at+'" x2="'+t.at+'" y1="'+T+'" y2="'+B+'"/><text x="'+t.at+'" y="'+(B+18)+'" text-anchor="middle">'+esc(t.label)+'</text>';});
  chart+='<text x="'+(L+P/2)+'" y="'+(H-16)+'" text-anchor="middle">'+esc(xTitle)+'</text>'
    +'<text transform="translate(14 '+((B+T)/2)+') rotate(-90)" text-anchor="middle">'+esc(yTitle)+'</text>';
  if(fit.length)chart+='<line class="gc-component-fit" x1="'+x.at(fit[0].x)+'" y1="'+y.at(fit[0].y)+'" x2="'+x.at(fit[1].x)+'" y2="'+y.at(fit[1].y)+'"/>';
  chart+=points.map(function(p){
    return '<circle class="gc-component-point" cx="'+x.at(p.x)+'" cy="'+y.at(p.y)+'" r="3"><title>'
      +esc(p.date+' · '+xTitle+' '+componentStat(p.x)+' · '+yTitle+' '+componentStat(p.y)+' · '+(p.counts||n0(p.count)+' observations'))+'</title></circle>';
  }).join("")+'</svg>';
  var legend=[["week","One comparable week"]];
  if(fit.length)legend.push(["fit","Fitted line"]);
  if(relationship)return chartLegend(legend)+chart;
  var direction=Math.abs(row.r)<1e-12?'The paired weeks show no clear direction for '+row.label+'.'
    :'Weeks with higher '+row.label+' tended to have '+(row.r>0?'higher ':'lower ')+yTitle+'.';
  var meaning=links.source==="D01"?row.label+' is included in total handling time, so some of this association comes from how AHT is calculated.'
    :'These are paired weekly observations. A rating or factor included in the total can partly explain the association.';
  var values='<div class="scroll"><table><thead><tr><th scope="col">Week of</th><th scope="col">'+esc(xTitle)+'</th><th scope="col">'+esc(yTitle)+'</th><th scope="col">Observations</th></tr></thead><tbody>'
    +points.map(function(p){return '<tr><th scope="row">'+esc(p.date)+'</th><td>'+esc(componentStat(p.x))+'</td><td>'+esc(componentStat(p.y))+'</td><td>'+n0(p.count)+'</td></tr>';}).join("")
    +'</tbody></table></div>';
  if(evidence)return values;
  var context=links.source==='D01'?'Qualification is held for these component relationships because the components contribute to AHT.'
    :'A component included in the reported outcome can partly explain its association. Significance is unavailable for these comparisons.';
  var overview=relationshipOverview(links.rows,item=>Number.isFinite(item.r)?'Descriptive comparisons':'Unavailable',context);
  return '<div id="g-component-plot"><h4>'+esc(row.label+' and '+yTitle)+'</h4>'
    +gSlideResult(gSlideTakeaway(direction,overview+'<h4>Facts</h4><p>'+n0(points.length)+' comparable weeks.</p>'+gTakeawayMeaning(meaning)+
      '<button type="button" class="g-linkbtn" data-chapter="g-component-evidence-'+esc(row.column)+'">See this component in Evidence</button>'),
      observedState(xR()).componentView==="table"?values:chartLegend(legend)+chart)+'</div>';
}
var LEVEL_TEST_METHODS={pearson:"Pearson",spearman:"Spearman",kendall_tau_b:"Kendall’s tau-b"};
function relationshipVariablePicker(id,options,value){
  var index=options.findIndex(option=>option[0]===value);
  function control(label,step,disabled){
    return '<button type="button" class="btn secondary g-relationship-step g-compact-chart-control" id="'+id+(step<0?'-previous':'-next')
      +'" data-relationship-step="'+step+'" aria-label="'+label+' variable" aria-disabled="'+disabled+'">'+label+'</button>';
  }
  return '<div class="g-relationship-picker" data-chart-selection role="group" aria-label="Choose relationship variable">'
    +observedSelect(id,"Variable",options,value).replace(' data-observed-chart',' data-observed-chart aria-label="Variable"')
    +control("Previous",-1,index<=0)+control("Next",1,index>=options.length-1)+'</div>';
}
function setRelationshipVariable(id,value){
  var choice=document.getElementById(id);
  choice.value=value;
  var picker=choice.closest('[data-chart-selection]');
  picker.querySelector('[data-relationship-step="-1"]').setAttribute('aria-disabled',String(choice.selectedIndex<=0));
  picker.querySelector('[data-relationship-step="1"]').setAttribute('aria-disabled',String(choice.selectedIndex>=choice.options.length-1));
}
function relationshipOverview(rows,categoryFor,note=''){
  var categories=['Significant qualified results','Inconclusive','Descriptive comparisons','Qualification held','Unavailable'];
  var items=categories.map(category=>{
    var matches=rows.filter(row=>categoryFor(row)===category);
    if(!matches.length)return '';
    var labels=matches.slice(0,3).map(row=>row.label).join(', ');
    return '<li><strong>'+category+'</strong> · '+esc(labels)+(matches.length>3?' · '+n0(matches.length-3)+' more in Evidence':'')+'</li>';
  }).join('');
  return '<h4>Across variables</h4><ul class="g-relationship-overview">'+items+'</ul>'+(note?'<p>'+esc(note)+'</p>':'');
}
function qualifiedLevelTest(pair){
  var test=pair.level_test;
  return pair.status==='descriptive'&&test?.status==='qualified'&&Object.hasOwn(LEVEL_TEST_METHODS,test.method)
    &&Number.isFinite(test.coefficient)&&Math.abs(test.coefficient)<=1
    &&Number.isFinite(test.adjusted_p)&&test.adjusted_p>=0&&test.adjusted_p<=1?test:null;
}
function metricRelationshipCategory(pair){
  var test=qualifiedLevelTest(pair);
  if(test)return test.adjusted_p<=.05?'Significant qualified results':'Inconclusive';
  if(pair.status!=='descriptive'||!Number.isFinite(pair.r))return 'Unavailable';
  return pair.level_test?.status==='withheld'?'Qualification held':'Descriptive comparisons';
}
function metricQualificationText(pair){
  var category=metricRelationshipCategory(pair);
  if(category==='Significant qualified results')return 'The qualified weekly-level test was significant after adjustment for multiple comparisons.';
  if(category==='Inconclusive')return 'The qualified weekly-level test was inconclusive after adjustment for multiple comparisons.';
  if(category==='Qualification held')return 'Qualification is on hold.'+(pair.level_test.reason?' '+pair.level_test.reason:' Descriptive results are available.');
  return category==='Descriptive comparisons'?'The observed relationship is descriptive. A qualified significance result is unavailable.':'';
}
function metricPairStatus(pair,evidence=false){
  var qualified=qualifiedLevelTest(pair);
  if(pair.status==="descriptive"&&(qualified||Number.isFinite(pair.r))){
    var r=qualified?.coefficient??pair.r;
    var size=Math.abs(r);
    if(size<1e-12)return 'The '+(qualified?'qualified':'observed')+' coefficient was '+(r===0?'zero':'negligible')+'. There is no directional takeaway for these paired weeks.';
    var xTitle=pair.label.replace(/^Supplied /i,'')+' ('+pair.unit+')';
    var fit=!qualified||qualified.method==='pearson'?pair.fit?.map(([x,y])=>[x,y/durationFactor()]):null;
    var strength=size<.10?'very small':size<.30?'small':size<.50?'moderate':'strong';
    var R=xR();
    var direction=({higher_is_better:1,lower_is_better:-1})[R?.analysis_setup?.direction||R?.metric?.direction];
    var y=r>0?'higher':'lower';
    var interpretation=direction?' '+(r>0?'Higher':'Lower')+' '+ml()+' is '+(Math.sign(r)===direction?'favorable':'unfavorable')+' in this analysis.':'';
    return 'The '+(qualified?'qualified':'observed')+' coefficient was '+strength+' in magnitude and pointed toward '+y+' '+ml()
      +' as '+xTitle+' rises.'+interpretation+(evidence&&fit?' '+fittedRangeText(fit,xTitle,chartMetricAxis()):'');
  }
  return {constant:"At least one measure stayed constant across the comparable weeks.",
    insufficient_weeks:"Fewer than eight complete weeks had both measures.",
    no_overlap:"No eligible observations shared an agent, business date and work scope.",
    unavailable:"No eligible source values were available."}[pair.status]||"No usable result is available for this comparison.";
}
function metricPair(R,pair){
  var level=qualifiedLevelTest(pair);
  var scatter=level&&level.method!=='pearson'?{...pair,fit:null}:pair;
  var qualification=metricQualificationText(pair);
  var details=relationshipOverview(R.insights.metric_relationships,metricRelationshipCategory)
    +(qualification?'<h4>Facts</h4><p>'+esc(qualification)+'</p>':'')
    +(pair.status==='descriptive'?'<h4>Next step</h4><p>Check whether the pattern also appears within individual Lines of Business.</p>':'');
  return '<div id="g-metric-pair"><h4>'+esc(ML()+' and '+pair.label)+'</h4>'
    +'<p class="muted">'+n0(pair.weeks.length)+' comparable weeks</p>'
    +gSlideResult(gSlideTakeaway(metricPairStatus(pair),details),
      pair.weeks.length?(observedState(R).relationshipView==="table"?pairedWeeklyTable(pair):componentPlot({},scatter,pair)):'')
    +'<button type="button" class="g-linkbtn" data-chapter="g-metric-evidence-'+esc(pair.id)+'">See this comparison in Evidence</button></div>';
}
function selectMetricRelationship(R,id){
  var pair=R.insights.metric_relationships.find(function(candidate){return candidate.id===id;});
  if(!pair)return;
  observedState(R).relationship=pair.id;
  setRelationshipVariable("g-metric-choice",pair.id);
  document.getElementById("g-metric-pair").outerHTML=metricPair(R,pair);
  var chart=document.getElementById("g-metric-relationships-card");
  chart.querySelectorAll("[data-metric-relationship]").forEach(function(button){
    button.setAttribute("aria-pressed",String(button.dataset.metricRelationship===pair.id));
  });
  updateSelectedTakeaway(chart);
  gRefreshGuide();
  sizeChartTables();
}
function selectComponentRelationship(R,id){
  var links=R.insights.component_links,row=links?.rows.find(candidate=>candidate.column===id);
  if(!row)return;
  observedState(R).component=id;
  setRelationshipVariable("g-component-choice",id);
  document.getElementById("g-component-plot").outerHTML=componentPlot(links,row);
  updateSelectedTakeaway(document.getElementById("g-component-relationships"));
  gRefreshGuide();
  sizeChartTables();
}
function gSignificanceMatrix(pairs,chosen){
  var points=pairs.map(pair=>[pair,qualifiedLevelTest(pair)]).filter(([,test])=>test);
  var descriptive=pairs.filter(pair=>pair.status==='descriptive'&&!qualifiedLevelTest(pair));
  var head='<section id="g-significance-matrix" class="g-significance-matrix" aria-labelledby="g-matrix-title"><h4 id="g-matrix-title">Relationship strength and significance</h4>';
  return head+(points.length?'<p>Choose a measure to see its scatterplot. Position shows strength and significance. The arrow shows direction.</p>'
    :'<p>No comparison has qualified significance for this selection.</p>')
    +'<div class="g-matrix-layout"><span class="g-matrix-y">Relationship strength ↑</span><div class="g-matrix-y-ticks"><div class="g-matrix-y-scale">'
    +'<span style="--tick:0%">1</span><span style="--tick:35.7%">0.50</span><span style="--tick:50%">0.30</span><span style="--tick:83.3%">0.10</span><span style="--tick:100%">0</span></div></div><div class="g-matrix-plot">'
    +'<div class="g-matrix-quadrants" aria-hidden="true"><span>Stronger · inconclusive</span><span>Stronger · significant</span>'
    +'<span>Smaller · inconclusive</span><span>Smaller · significant</span></div><div class="g-matrix-points">'
    +points.map(function([pair,test]){
      var p=test.adjusted_p,mag=Math.abs(test.coefficient),significant=p<=.05,stronger=mag>=.30;
      var x=significant?50+50*(.05-p)/.05:50*(1-p)/.95;
      var y=stronger?50+50*(mag-.30)/.70:50*mag/.30;
      var direction=test.coefficient<0?'negative':test.coefficient>0?'positive':'zero';
      var label=[pair.label,direction+' direction',stronger?'stronger':'smaller',significant?'significant':'inconclusive'].join(', ');
      return '<button type="button" class="g-matrix-point'+(x>=50?' g-matrix-point-end':'')+(significant?' g-matrix-significant':'')+(significant&&stronger?' g-matrix-priority':'')+'" data-metric-relationship="'+esc(pair.id)
        +'" aria-controls="g-metric-pair" aria-pressed="'+String(chosen.id===pair.id)+'" aria-label="'+esc(label)+'" style="--point-x:'+x+'%;--point-y:'+y+'%">'
        +'<span aria-hidden="true">'+(direction==='negative'?'↓':direction==='positive'?'↑':'—')+'</span><span class="g-matrix-label">'+esc(pair.label)+(significant?'':' · Inconclusive')+'</span></button>';
    }).join('')+'</div></div><div class="g-matrix-x"><span>1</span><span>0.05</span><span>0</span></div><div class="g-matrix-axes">Significance →</div></div>'
    +'<p class="muted">Axis spacing changes at the quadrant boundaries.</p>'
    +(descriptive.length?'<p class="muted">Descriptive comparisons</p><div class="g-matrix-descriptive">'+descriptive.map(pair=>
      '<button type="button" class="btn secondary" data-metric-relationship="'+esc(pair.id)+'" aria-controls="g-metric-pair" aria-pressed="'+String(chosen.id===pair.id)+'">'
      +esc(pair.label)+'</button>').join('')+'</div>':'')+'</section>';
}
function metricRelationships(R){
  var pairs=R.insights.metric_relationships;
  if(!pairs||!pairs.length)return '';
  var chosen=pairs.find(function(pair){return pair.id===observedState(R).relationship;})||pairs[0];
  return '<section id="g-metric-relationships-card" class="g-chart-container-box" aria-labelledby="g-metric-relationships"><h3 id="g-metric-relationships">How other measures move with weekly performance</h3>'
    +'<div class="g-observed-filters">'+relationshipVariablePicker("g-metric-choice",pairs.map(pair=>[pair.id,pair.label]),chosen.id)
    +reportChartControls("relationship",observedState(R))+'</div>'+metricPair(R,chosen)+'</section>';
}
function metricRelationshipChanges(pair){
  var changes=pair.changes||[];
  if(!changes.length)return pair.weeks.length?'<p class="muted">No consecutive weeks have both measures.</p>':'';
  var outcomeUnit=metricKind()==="percent"?"percentage points":durationUnitName(false);
  var direction='A correlation summary is unavailable for these changes.';
  if(Number.isFinite(pair.change_r)){
    direction='Observed Pearson correlation across '+n0(changes.length)+' changes was '+componentStat(pair.change_r)+'.';
    if(Number.isFinite(pair.r)&&Math.abs(pair.r)>=1e-12&&Math.abs(pair.change_r)>=1e-12){
      direction+=' The direction '+(Math.sign(pair.r)===Math.sign(pair.change_r)?'matched':'differed from')
        +' the descriptive Pearson correlation across '+n0(pair.weeks.length)+' weekly levels ('+componentStat(pair.r)+').';
    }
  }
  var effect=pair.change_effect, slope='';
  if(effect){
    var incrementUnit=pair.unit==="supplied score"?"score units":pair.unit;
    if(effect.increment===1)incrementUnit=({contacts:"contact",surveys:"survey",seconds:"second","score units":"score unit"})[incrementUnit]||incrementUnit;
    var estimate=effect.estimate/durationFactor();
    slope='<p><strong>Descriptive slope.</strong> '+esc('A weekly change in '+pair.label.toLowerCase()+' that was '
      +componentStat(effect.increment)+' '+incrementUnit+' higher was associated with an estimated '
      +(estimate>0?'+':'')+componentStat(estimate)+' '+outcomeUnit+' difference in the weekly change in '+ml()+'.')+'</p>';
  }
  return '<details open class="g-values"><summary>Show consecutive-week changes ('+n0(changes.length)+')</summary>'
    +'<p>Each row compares two consecutive weeks with values for both measures. These are observed changes.</p>'
    +'<p>'+esc(direction)+'</p>'+slope
    +'<div class="scroll"><table><thead><tr><th scope="col">From week</th><th scope="col">To week</th>'
    +'<th scope="col">'+esc('Change in '+pair.label+' ('+pair.unit+')')+'</th>'
    +'<th scope="col">'+esc('Change in '+ML()+' ('+outcomeUnit+')')+'</th></tr></thead><tbody>'
    +changes.map(function(change){
      return '<tr><th scope="row">'+esc(change.from_week)+'</th><td>'+esc(change.to_week)+'</td>'
        +'<td>'+esc(componentStat(change.measure))+'</td><td>'+esc(componentStat(change.outcome/durationFactor()))+'</td></tr>';
    }).join('')+'</tbody></table></div></details>';
}
function pairedWeeklyTable(pair){
  return '<div class="scroll" tabindex="0" aria-label="Paired weekly values"><table><thead><tr><th scope="col">Week of</th><th scope="col">'+esc(pair.label+' ('+pair.unit+')')+'</th><th scope="col">'+esc(ML()+' ('+durationUnitName(true)+')')+'</th><th scope="col">Measure observations</th><th scope="col">KPI observations</th></tr></thead><tbody>'
      +pair.weeks.map(function(week){return '<tr><th scope="row">'+esc(week.start)+'</th><td>'+esc(componentStat(week.measure))+'</td><td>'+esc(componentStat(week.outcome/durationFactor()))+'</td><td>'+n0(week.measure_count)+'</td><td>'+n0(week.outcome_count)+'</td></tr>';}).join('')
      +'</tbody></table></div>';
}
function metricRelationshipEvidence(pairs){
  if(!pairs||!pairs.length)return '';
  var summary='<div class="scroll"><table><thead><tr><th>Measure</th><th>Status</th><th>Comparable weeks</th><th>Ranking share</th><th>Cumulative</th></tr></thead><tbody>'
    +pairs.map(pair=>{var priority=pair.strength_priority;
      return '<tr><th scope="row">'+esc(pair.label)+'</th><td>'+esc(metricRelationshipCategory(pair))+'</td><td>'+n0(pair.weeks.length)+'</td><td>'+(priority?n1(priority.share*100)+'%':'—')+'</td><td>'+(priority?n1(priority.cumulative*100)+'%':'—')+'</td></tr>';}).join('')+'</tbody></table></div>';
  return '<h3>Weekly metric relationship evidence</h3>'+chartScopeTitle(xR(),'Weekly relationships')
    +'<p>Each point represents one comparable week. Where shown, the fitted line describes the observed direction across the range.</p>'+summary+pairs.map(function(pair){
    var stat=pair.status==="descriptive"?' Pearson correlation '+componentStat(pair.r)+'.':'';
    var qualified=qualifiedLevelTest(pair);
    if(qualified)stat=' Qualified weekly-level test: '+LEVEL_TEST_METHODS[qualified.method]+'. Signed coefficient '+String(qualified.coefficient)
      +'. Adjusted p-value '+String(qualified.adjusted_p)+'.';
    else if(pair.status==='descriptive')stat+=' '+metricQualificationText(pair);
    var priority=pair.strength_priority;
    var ranking=priority?' Share of the descriptive Pearson strength ranking score '+n1(priority.share*100)+'%. Cumulative share '+n1(priority.cumulative*100)+'%.'
      +(priority.within_cutoff?' This row falls within the 80% ranking cutoff.':''):'';
    var basis=pair.matched?(pair.source==="D03"?" Survey response business dates.":" Quality evaluation business dates.")
      +" Only agent-days with matching Line of Business and contact driver contribute on either side."
      :" Complete business weeks from the active primary data.";
    return '<section class="g-relationship-evidence" id="g-metric-evidence-'+esc(pair.id)+'"><h4>'+esc(pair.label)+'</h4><p>'
      +esc(metricPairStatus(pair,true)+stat+ranking+(pair.file?' KPI source: '+pair.outcome_file+'. Measure source: '+pair.file+'.'+basis:''))
        +'</p>'+(pair.weeks.length?'<details open class="g-values"><summary>Show paired weekly values</summary>'+pairedWeeklyTable(pair)+'</details>':'')+metricRelationshipChanges(pair)+'</section>';
  }).join('');
}
function componentRelationships(R){
  var links=R.insights.component_links;
  if(!links?.rows.length)return '';
  var selected=observedState(R).component;
  var chosen=links.rows.find(function(row){return row.column===selected;})||links.rows[0];
  return '<section id="g-component-relationships" class="g-chart-container-box" aria-labelledby="g-component-title"><h3 id="g-component-title">How components move with weekly performance</h3>'
    +'<div class="g-observed-filters">'+relationshipVariablePicker("g-component-choice",links.rows.map(row=>[row.column,row.label]),chosen.column)
    +reportChartControls("components",observedState(R))+'</div>'
    +componentPlot(links,chosen)+'</section>';
}
function componentLinkEvidence(links){
  if(!links)return '';
  var sources={D01:'Contact records with talk, hold and after-call work recorded',D03:'Customer surveys with a supplied CSAT score and all compared ratings',D04:'Quality audits with a supplied QA score and all compared factors'};
  if(links.outcome==='pass_rate')sources[links.source]=links.source==='D03'
    ?'Customer surveys with a satisfaction outcome and all compared ratings'
    :'Quality audits with a pass outcome and all compared factors';
  return '<section id="g-component-relationship-evidence"><h3>Weekly component relationships</h3><p>'+esc(sources[links.source])+'. Each point pairs the component and outcome averages for one complete week. The fitted line shows how those values moved together. When a component contributes to the outcome, part of the relationship follows from how the outcome is calculated.</p>'
    +'<div class="scroll"><table><thead><tr><th>Component</th><th class="n">Correlation</th><th class="n">R squared</th><th class="n">Slope</th></tr></thead><tbody>'
    +links.rows.map(function(row){return '<tr><td>'+esc(row.label)+'</td><td class="n">'+componentStat(row.r)+'</td><td class="n">'+componentStat(row.r_squared)+'</td><td class="n">'+componentStat(row.slope)+'</td></tr>';}).join('')
    +'</tbody></table></div><details open><summary>'+n0(links.weeks.length)+' weeks compared</summary><p class="muted">Week start and observations used</p><ul>'
    +links.weeks.map(function(week){return '<li>'+esc(week.start)+' · '+n0(week.count)+'</li>';}).join('')+'</ul></details>'
    +links.rows.map(row=>'<section id="g-component-evidence-'+esc(row.column)+'"><h4>'+esc(row.label)+' weekly pairs</h4>'
      +componentPlot(links,row,null,true)+'</section>').join('')+'</section>';
}
function insComponents(I,R,evidence=false){var c=I.components;if(!c||!c.rows.length)return '';
  var qa=c.kind==='qa';
  var largest=Math.max(...c.rows.map(row=>row.share));
  var leaders=c.rows.filter(row=>row.share===largest);
  var message=largest>0?(leaders.length===1
    ?leaders[0].label+' accounted for '+n1(largest*100)+'% of the measured shortfall from the highest scores observed in the source file.'
    :n0(leaders.length)+' components tied for the largest share of the measured shortfall at '+n1(largest*100)+'% each.')
    :'There was no measured shortfall to rank in this selection.';
  var title='<h3>Measured component shortfalls</h3>'+(evidence?chartScopeTitle(R,'Component shortfall'):'');
  var noun=qa?'evaluations':'surveys',unit=qa?'points':'rating points';
  var basis='Each eligible record is compared with the highest value observed for that component in the source file.';
  var table='<div class="scroll"><table><thead><tr><th>Component</th><th>Eligible '+noun+'</th><th>Average</th><th>Observed source maximum</th><th>Shortfall ('+unit+')</th><th>Share</th></tr></thead><tbody>'
   +c.rows.map(p=>'<tr><th scope="row">'+esc(p.label)+'</th><td>'+n0(p.n)+'</td><td>'+componentStat(p.mean)+'</td><td>'+componentStat(p.full)
     +'</td><td>'+displayNumber(p.lost,1)+'</td><td>'+percentNumber(p.share*100)+'%</td></tr>').join('')+'</tbody></table></div>';
  if(evidence)return title+'<p>'+esc(message)+' '+basis+'</p>'+table;
  var state=observedState(R),bars=c.rows.map(row=>({key:row.label,value:row.lost}));
  var facts='<h4>Facts</h4><p>'+esc(basis)+'</p>'+leaders.map(row=>'<p>'+esc(row.label+': '+displayNumber(row.lost,1)+' '+unit
    +' across '+n0(row.n)+' eligible '+noun+'.')+'</p>').join('');
  return '<section id="g-shortfalls-panel">'+reportChartControls("shortfalls",state)
    +gSlideResult(gSlideTakeaway(message,facts),title+(state.shortfallsView==="table"?table:
      comparisonBars(bars,row=>displayNumber(row.value,1)+' '+unit,value=>displayNumber(value,1),'Measured component shortfall',true)) )+'</section>';
}
function componentMovementValue(value,source){
  return value===null?'—':source==='D01'?fcValue(value):componentStat(value)+(source==='D03'?' rating':' pts');
}
function componentMovementScope(m){
  var s=m.selection;
  return '<p class="g-movement-scope">'+esc(s.group?'Team lead '+s.group:'All eligible agents and observations')
    +' · Before From '+esc(s.before_start)+' Until '+esc(s.before_end)+' ('+n0(m.counts[0])+' observations)'
    +' · After From '+esc(s.after_start)+' Until '+esc(s.after_end)+' ('+n0(m.counts[1])+' observations)</p>';
}
function componentMovementChart(m,title){
  if(m.reason)return '<p>'+esc(m.reason)+'</p>';
  if(m.counts.some(count=>!count))return '<p>At least one period has no eligible component observations. Try another date range or team lead.</p>';
  var values=m.rows.flatMap(row=>[row.before,row.after]),low=Math.min(...values),high=Math.max(...values);
  var left=238,right=640,bottom=m.rows.length*30+8;
  var minimumSpan={D01:Math.max(1,.1*durationFactor()),D03:.1,D04:1}[m.source];
  var scale=Math.max(Math.abs(low),Math.abs(high),minimumSpan);
  var lo=low/scale,hi=high/scale,midpoint=(lo+hi)/2;
  var span=Math.max((hi-lo)*1.16,minimumSpan/scale);
  lo=Math.max(-Number.MAX_VALUE/scale,midpoint-span/2);
  hi=Math.min(Number.MAX_VALUE/scale,midpoint+span/2);
  if(m.source==='D01'&&lo<0){hi=Math.min(Number.MAX_VALUE/scale,hi-lo);lo=0;}
  function x(value){return lo===hi?(left+right)/2:left+(right-left)*(value/scale-lo)/(hi-lo);}
  var chart='<svg class="g-chart" viewBox="0 0 760 '+(bottom+42)+'" role="img" aria-label="'+esc(title)+'">';
  var ticks=lo===hi?[low]:Array.from({length:5},(_,i)=>(lo+(hi-lo)*i/4)*scale);
  ticks.forEach(function(value){
    var at=x(value);
    chart+='<line class="gc-grid" x1="'+at+'" x2="'+at+'" y1="5" y2="'+bottom+'"/>'
      +'<text x="'+at+'" y="'+(bottom+15)+'" text-anchor="middle">'+esc(componentMovementValue(value,m.source))+'</text>';
  });
  m.rows.forEach(function(row,i){
    var y=20+i*30,before=x(row.before),after=x(row.after),sign=Math.sign(after-before),tail=after-sign*Math.min(7,Math.abs(after-before));
    var change=row.change;
    var delta=change===null?'—':(change>0?'+':'')+(m.source==='D01'?componentStat(change/durationFactor())+' '+durationUnitSymbol():componentMovementValue(change,m.source));
    var title=row.label+' · Before '+componentMovementValue(row.before,m.source)+' · After '+componentMovementValue(row.after,m.source)+' · Change '+delta;
    chart+='<g><title>'+esc(title)+'</title><text x="224" y="'+(y+4)+'" text-anchor="end">'+esc(row.label)+'</text>'
      +'<line class="g-movement-line" x1="'+before+'" x2="'+after+'" y1="'+y+'" y2="'+y+'"/>'
      +'<circle class="g-movement-before" cx="'+before+'" cy="'+y+'" r="4"/>'
      +(sign?'<polygon class="g-movement-after" points="'+after+','+y+' '+tail+','+(y-4)+' '+tail+','+(y+4)+'"/>':'')
      +'<text class="g-movement-delta" x="746" y="'+(y+4)+'" text-anchor="end">'+esc(delta)+'</text></g>';
  });
  var axis={D01:'Component duration ('+durationUnitName(true)+')',D03:'Supplied component rating',D04:'Component score (Points)'};
  return chart+'<text x="'+((left+right)/2)+'" y="'+(bottom+34)+'" text-anchor="middle">'+esc(axis[m.source])+'</text></svg>';
}
function componentMovementTable(m,title){
  return '<div class="scroll" tabindex="0" aria-label="'+esc(title)+'"><table><thead><tr><th scope="col">Component</th><th scope="col">Before average</th><th scope="col">After average</th><th scope="col">Change</th></tr></thead><tbody>'
    +m.rows.map(function(row){return '<tr><th scope="row">'+esc(row.label)+'</th>'+[row.before,row.after,row.change].map(value=>'<td class="n">'+esc(componentMovementValue(value,m.source))+'</td>').join('')+'</tr>';}).join('')
    +'</tbody></table></div>';
}
function componentMovementEvidence(R,m){
  if(!m)return gShowsPanel(R,"component-movement")
    ?'<section id="g-component-movement-evidence">'+chartScopeTitle(R,'Applied comparison scope')+'</section>':'';
  var source=(gReportDatasets(R)||[]).find(item=>item.code===m.source);
  return '<section id="g-component-movement-evidence"><h4>Before and After component evidence</h4>'
    +'<p>Source '+esc(source?.file||m.source)+'. Each average pools eligible observations with component values in its date range. Where shown, the circle marks Before and the arrowhead marks After.</p>'
    +componentMovementScope(m)+(m.reason?'<p>'+esc(m.reason)+'</p>':'')+componentMovementTable(m,componentMovementTitle(R))+'</section>';
}
function movementFilterFields(R,draft){
  var m=R.insights.component_movement,start=R.scope.start,end=R.scope.end;
  return chartDateField('g-movement-before-start','Before From',draft.before_start,start,dayBefore(end))
    +chartDateField('g-movement-before-end','Before Until',draft.before_end,start,dayBefore(end))
    +chartDateField('g-movement-after-start','After From',draft.after_start,nextDay(draft.before_end),end)
    +chartDateField('g-movement-after-end','After Until',draft.after_end,nextDay(draft.before_end),end)
    +(m.groups.length?observedSelect('g-movement-group','Agent group by team lead',[['','All groups']].concat(m.groups.map(name=>[name,name])),draft.group):'');
}
function syncMovementDates(modal){
  var {before_start:start,before_end:end}=modal.draft,scope=modal.result.scope;
  var beforeValid=!!(start&&end&&scope.start<=start&&start<=end&&end<scope.end);
  for(var id of ['g-movement-after-start','g-movement-after-end']){
    var input=document.getElementById(id);
    input.disabled=!beforeValid;
    if(beforeValid)input.min=nextDay(end);
  }
}
function movementPreview(R,draft){
  var {before_start, before_end, after_start, after_end, group}=draft;
  var valid=!!(before_start&&before_end&&after_start&&after_end&&R.scope.start<=before_start&&before_start<=before_end
    &&before_end<after_start&&after_start<=after_end&&after_end<=R.scope.end);
  return {valid,text:valid?'Before '+before_start+' to '+before_end+' · After '+after_start+' to '+after_end+' · '+(group||'All groups')
    :'Choose two ordered, non-overlapping ranges within the report period.'};
}
function componentMovementTitle(R){
  var cut=observedState(R).baselineMovement,selected=R.insights?.component_movement?.selection;
  return cut&&selected&&['before_start','before_end','after_start','after_end'].every(key=>selected[key]===cut[key])
    ?'Performance comparison between the 1st and 2nd half of the baseline period'
    :'Performance comparison between the selected periods';
}
function componentMovement(R){
  var m=R.insights.component_movement,state=observedState(R),title=componentMovementTitle(R);
  if(!m)return gSlideTakeaway('Choose at least two report dates with an eligible component source to compare periods.');
  var comparable=m.rows.filter(row=>Number.isFinite(row.change)&&Number.isFinite(row.before)&&Number.isFinite(row.after));
  var takeaway='';
  if(!m.reason&&comparable.length){
    var greatest=Math.max(...comparable.map(row=>Math.abs(row.change)));
    var leaders=comparable.filter(row=>Math.abs(row.change)===greatest);
    if(greatest===0)takeaway='The compared component averages stayed the same across the two selected periods.';
    else if(leaders.length===1){
      var row=leaders[0],before=componentMovementValue(row.before,m.source),after=componentMovementValue(row.after,m.source);
      takeaway=before===after?row.label+' had the largest measured change. Both values display as '+after+'.'
        :row.label+' had the largest change, from '+before+' in the first period to '+after+' in the second.';
    }else takeaway=n0(leaders.length)+' components tied for the largest change in either direction.';
  }
  return '<section id="g-component-movement" class="g-chart-container-box" aria-labelledby="g-component-movement-title"><h3 id="g-component-movement-title" data-slide-content-title>'+esc(title)+'</h3>'
    +presentationScopeTitle(R,{agentGroup:m.selection.group?'Team lead '+m.selection.group:null})
    +'<div class="g-observed-filters">'+reportChartControls("movement",state)+'</div>'
    +(title.includes('selected periods')?componentMovementScope(m):'')
    +gSlideResult(gSlideTakeaway(takeaway||m.reason||'No component had eligible values in both periods.'),
      state.movementView==="table"?componentMovementTable(m,title)
      :componentMovementChart(m,title))
    +'<button type="button" id="g-movement-evidence-link" class="g-linkbtn" data-chapter="g-component-movement-evidence">See comparison in Evidence</button></section>';
}
function cartCondition(cart,step){
  var feature=cart.features[step.feature];
  if(step.threshold===null)return step.accepts_missing?'missing':'present';
  var operator={"<=":"at or below",">":"above","<":"below",">=":"at or above"}[step.operator]||step.operator;
  return operator+' '+step.threshold+' '+reportUnitSymbol(feature.unit)
    +(step.accepts_missing&&step.has_missing?' or no value recorded':'');
}
function cartConditions(cart,path,showFitValues){
  return '<ol>'+path.conditions.map(function(step){
    var feature=cart.features[step.feature];
    var value=showFitValues&&Number.isFinite(step.fit_value)?' · Fit '+fcValue(step.fit_value):'';
    return '<li>'+esc(feature.label+' ('+feature.source+') · '+cartCondition(cart,step)+value)+'</li>';
  }).join('')+'</ol>';
}
function cartWaterfall(cart,path,compact=false){
  var fitValues=[cart.fit_baseline,...path.conditions.map(step=>step.fit_value)];
  var values=[...fitValues,path.later.observed];
  var missing=!Number.isFinite(cart.fit_baseline)?'The fit baseline is missing.'
    :!path.conditions.every(step=>Number.isFinite(step.fit_value))?'One or more fitted steps are missing.'
    :!Number.isFinite(path.later.observed)?'The historical check result is missing.':'';
  if(missing)return '<p><strong>Chart unavailable.</strong> '+esc(missing)+'</p>'+cartPeriodTable(path);
  var comparable=[cart.fit_baseline,...cart.paths.flatMap(item=>[...item.conditions.map(step=>step.fit_value),item.later.observed])]
    .filter(Number.isFinite);
  if(Number.isFinite(cart.target))comparable.push(cart.target);
  var low=Math.min(...comparable),high=Math.max(...comparable);
  var width=640,height=compact?112:150,slot=width/values.length;
  var x=index=>slot*(index+.5);
  var y=value=>high===low?height/2:height-15-(height-30)*(value-low)/(high-low);
  var graph=Number.isFinite(cart.target)?'<line class="gc-target" x1="0" x2="'+width+'" y1="'+y(cart.target)+'" y2="'+y(cart.target)+'"/>':'';
  graph+='<line class="gc-line" x1="'+(x(0)-slot*.28)+'" x2="'+(x(0)+slot*.28)+'" y1="'+y(fitValues[0])+'" y2="'+y(fitValues[0])+'"/>';
  for(var i=1;i<fitValues.length;i++){
    var start=y(fitValues[i-1]),end=y(fitValues[i]),barLeft=x(i)-slot*.28;
    graph+='<line class="g-cart-connector" x1="'+(x(i-1)+slot*.28)+'" x2="'+barLeft+'" y1="'+start+'" y2="'+start+'"/>';
    graph+=start===end?'<line class="gc-line" x1="'+barLeft+'" x2="'+(x(i)+slot*.28)+'" y1="'+end+'" y2="'+end+'"/>'
      :'<rect class="g-cart-bar" x="'+barLeft+'" width="'+slot*.56+'" y="'+Math.min(start,end)+'" height="'+Math.abs(end-start)+'"/>';
  }
  var checkX=x(values.length-1),checkY=y(path.later.observed);
  graph+='<path class="g-cart-check" d="M '+checkX+' '+(checkY-6)+' l 6 6 -6 6 -6 -6 Z"/>';
  return '<div class="scroll" tabindex="0" aria-label="Historical path waterfall"><figure class="g-cart-stage'+(compact?' g-cart-compact':'')
    +'" style="margin:0;--cart-columns:'+values.length+';--cart-steps:'+path.conditions.length+'">'
    +'<div class="g-cart-labels"><strong>Fit baseline</strong><ol aria-label="Path conditions">'+path.conditions.map(function(step){
      var label=cart.features[step.feature].label;
      if(compact)return '<li><strong title="'+esc(label)+'">'+esc(label.length>22?label.slice(0,20)+'…':label)+'</strong></li>';
      return '<li><strong>'+esc(label)+'</strong><span>'+esc(cartCondition(cart,step))+'</span></li>';
    }).join('')+'</ol><strong>Historical check</strong></div>'
    +'<svg class="g-cart-plot" viewBox="0 0 '+width+' '+height+'" preserveAspectRatio="none" aria-hidden="true">'+graph+'</svg>'
    +'<div class="g-cart-values">'+values.map(value=>'<strong>'+esc(fcValue(value))+'</strong>').join('')+'</div>'
    +'<figcaption>'+esc(ML())+' by cumulative split. The diamond marks the observed result for the complete path on later dates.'
    +(Number.isFinite(cart.target)?' The dashed line marks the applicable target.':'')+'</figcaption></figure></div>';
}
function cartPeriodTable(path){
  var fit=path.fit,later=path.later;
  var result=value=>Number.isFinite(value)?esc(fcValue(value)):'Unavailable';
  return '<div class="scroll"><table><thead><tr><th scope="col">Period</th><th scope="col">Agent work cells</th>'
    +'<th scope="col">'+gCountLabel()+'</th><th scope="col">Observed '+esc(ML())+'</th><th scope="col">Fitted '+esc(ML())+'</th></tr></thead><tbody>'
    +'<tr><th scope="row">Fit period</th><td>'+n0(fit.cells)+'</td><td>'+n0(fit.observations)+'</td><td>'+result(fit.observed)+'</td><td>'+result(path.fitted)+'</td></tr>'
    +'<tr><th scope="row">Historical check period</th><td>'+n0(later.cells)+'</td><td>'+n0(later.observations)+'</td><td>'+result(later.observed)+'</td><td>—</td></tr></tbody></table></div>';
}
function cartStepTable(cart,path){
  var rows=[['Fit baseline','',cart.fit_baseline],...path.conditions.map(step=>[
    cart.features[step.feature].label,cartCondition(cart,step),step.fit_value]),['Historical check','Complete path',path.later.observed]];
  return '<div class="scroll" tabindex="0" aria-label="Path steps and values"><table><thead><tr><th scope="col">Step</th><th scope="col">Condition</th><th scope="col">'+esc(chartMetricAxis())+'</th></tr></thead><tbody>'
    +rows.map(([step,condition,value])=>'<tr><th scope="row">'+esc(step)+'</th><td>'+esc(condition)+'</td><td>'+esc(Number.isFinite(value)?fcValue(value):'Unavailable')+'</td></tr>').join('')
    +'</tbody></table></div>';
}
function cartPath(cart,id,tableMode){
  var path=cart.paths.find(item=>String(item.id)===id)||cart.paths[0];
  var target=!Number.isFinite(cart.target)?'No single applicable target for this report':
    (cart.target_rule==="at_or_below"?'At or below ':cart.target_rule==="at_or_above"?'At or above ':'')+fcValue(cart.target);
  var attainment=path.later.target_met===undefined?'':(path.later.target_met?'. The historical check met this target.':'. The historical check missed this target.');
  var facts='<h4>Facts</h4><p>'+esc(cart.later_dates.join(' to ')+' · '+n0(path.later.cells)+' agent work cells · '
    +n0(path.later.observations)+' '+gCountLabel().toLowerCase()+'.')+'</p><p>'+esc(target+attainment)+'</p>';
  var answer=Number.isFinite(path.later.observed)?'During the historical check, this profile recorded '+fcValue(path.later.observed)+'.'
    :'The historical check result is unavailable for this profile.';
  return gSlideResult(gSlideTakeaway(answer,facts),tableMode?cartPeriodTable(path):cartWaterfall(cart,path,true))
    +'<button type="button" class="g-linkbtn" data-chapter="g-cart-evidence-'+path.id+'">See this path in Evidence</button>';
}
function selectCartPath(R,id){
  var cart=R?.insights?.cart_profiles,selection=document.getElementById("g-cart-selection");
  if(!selection||!cart?.paths.some(path=>String(path.id)===id))return;
  observedState(R).cartPath=id;
  document.getElementById("g-cart-path").value=id;
  selection.innerHTML=cartPath(cart,id,observedState(R).cartView==="table");
  updateSelectedTakeaway(document.getElementById("g-cart-profiles"));
  gRefreshGuide();
}
function cartProfiles(R){
  var cart=R.insights.cart_profiles;
  if(!cart)return '';
  var saved=observedState(R).cartPath;
  var selection=cart.paths.some(path=>String(path.id)===saved)?saved:String(cart.paths[0]?.id);
  var body=cart.paths.length?'<p>'+n0(cart.paths.length)+' of '+n0(cart.terminal_count)+' paths have enough coverage in both historical periods. '
    +'Fit period '+esc(cart.fit_dates.join(' to '))+' · Historical check period '+esc(cart.later_dates.join(' to '))+'.</p>'
    +'<div class="g-observed-filters">'+observedSelect("g-cart-path","Terminal path",cart.paths.map((path,index)=>[String(path.id),"Path "+(index+1)]),selection)
    +reportChartControls("cart",observedState(R))+'</div>'
    +'<div id="g-cart-selection" aria-live="polite">'+cartPath(cart,selection,observedState(R).cartView==="table")+'</div>'
    :gSlideTakeaway(cart.reason)+'<button type="button" class="g-linkbtn" data-chapter="g-cart-evidence">See profile eligibility in Evidence</button>';
  return '<section id="g-cart-profiles" class="g-chart-container-box" aria-labelledby="g-cart-title"><h3 id="g-cart-title">Historical CART performance profiles</h3>'
    +''+body+'</section>';
}
function cartEvidence(cart){
  if(!cart)return '';
  var dates=cart.fit_dates?'<p>Fit period '+esc(cart.fit_dates.join(' to '))+'. Historical check period '+esc(cart.later_dates.join(' to '))+'.</p>':'';
  var features=cart.features.length?'<div class="scroll"><table><thead><tr><th scope="col">Input</th><th scope="col">Source and origin</th>'
    +'<th scope="col">Role</th><th scope="col">Available</th><th scope="col">Work cells without a value</th></tr></thead><tbody>'
    +cart.features.map(item=>'<tr><th scope="row">'+esc(item.label)+' ('+esc(item.unit)+')</th><td>'+esc(item.source+' · '+item.origin+(item.column?' · '+item.column:''))+'</td><td>'
      +esc(item.role)+'</td><td>'+esc(item.availability)+'</td><td>'+n0(item.missing)+'</td></tr>').join('')+'</tbody></table></div>':'';
  var paths=cart.paths.length?'<div class="scroll"><table><caption>Eligible terminal paths</caption><thead><tr><th>Path</th><th>Factor count</th><th>Historical check '+esc(ML())+'</th></tr></thead><tbody>'
    +cart.paths.map((path,index)=>'<tr><th scope="row">Path '+(index+1)+'</th><td>'+n0(path.conditions.length)+'</td><td>'+(Number.isFinite(path.later.observed)?esc(fcValue(path.later.observed)):'Unavailable')+'</td></tr>').join('')
    +'</tbody></table></div>':'';
  return '<section id="g-cart-evidence"><h3>Historical CART fit and coverage</h3><p>'+esc(cart.method)+' (scikit-learn '+esc(cart.library_version)+'). '
    +n0(cart.cells)+' agent work cells and '+n0(cart.observations)+' eligible observations from '+esc(cart.outcome_source)
    +'. A work cell is an agent, business date, Line of Business and contact driver. The fit weights each cell by the count used for the selected KPI.</p>'
    +'<p>Inputs are selected on fit dates. The selected KPI and its components are excluded. Roster, staffing and auxiliary inputs need historical work-cell attribution and availability before they can enter this view.</p>'
    +dates+(cart.reason?'<p>'+esc(cart.reason)+'</p>':'')+features+paths
    +cart.paths.map(function(path,index){
      return '<section id="g-cart-evidence-'+path.id+'"><h4>Path '+(index+1)+'</h4>'
        +(Number.isFinite(cart.fit_baseline)?'<p>Fit baseline '+esc(fcValue(cart.fit_baseline))+'.</p>':'')+cartConditions(cart,path,true)
        +'<details><summary>Show fit steps</summary>'+cartWaterfall(cart,path)+cartStepTable(cart,path)+'</details>'+cartPeriodTable(path)+'<p>Fit period '+n0(path.fit.agents)+' agents over '+n0(path.fit.dates)+' dates. Historical check period '+n0(path.later.agents)+' agents over '+n0(path.later.dates)+' dates.</p></section>';
    }).join('')+'</section>';
}
function gCh3(R){
  var I=R&&R.insights;
  if(!I)return gArt("chapter-factors",2,"Performance Factors","No group comparisons were tested for this selection.",'<p>See observed results by Line of Business and contact driver in What Happened.</p>',xb("Performance factors","na"));
  var legacy=S.page==="full-insights"||!Array.isArray(R.report_panels);
  var groups=legacy?insSegments(R):"",cohorts=legacy?insCohorts(I,R):"",mix=gShowsPanel(R,"period-change")?insMix(I,R):"";
  var relationships=gShowsPanel(R,"relationships");
  var body=gQuestionSlide("g-slide-relationships","Which measures moved with weekly "+ml()+"?",relationships?metricRelationships(R):"")
    +gQuestionSlide('g-factor-comparisons','How did each group compare with the rest on shared work?',groups?'<p>Compare the observed differences where groups handled similar work.</p>'
      +'<button type="button" class="g-linkbtn" data-chapter="g-evidence-comparisons">See comparison checks in Evidence</button>'
      +'<details open class="g-values" id="g-factor-groups"><summary>Compare groups</summary>'+groups+'</details>':'')
    +gQuestionSlide('g-factor-direct-gaps','What gaps showed up between specific groups?',legacy?directGapPanel(R):'')
    +gQuestionSlide('g-factor-agent-groups','How did ranked agent cohorts compare?',cohorts?'<details open class="g-values" id="g-factor-cohorts"><summary>Explore agent groups</summary>'
      +''+cohorts+'</details>':'')
    +gQuestionSlide('g-factor-period-change','What contributed to the change between periods?',mix?''+mix:'')
    +gQuestionSlide('g-slide-contact-performance','Which contact types have higher or lower '+ml()+'?',gShowsPanel(R,"contact-performance")?gContactPerformance(R):'')
    +gQuestionSlide('g-factor-driver-impact','Which contact drivers had the largest volume-weighted gaps?',gShowsPanel(R,'driver-impact')?insContactDriverImpact(I.contact_driver_impact,R):'')
    +gQuestionSlide('g-factor-constraints','Which controllable constraints were recorded most often?',gShowsPanel(R,'constraints')?insConstraints(I,R):'')
    +gQuestionSlide('g-factor-shortfalls','Which components accounted for the largest shortfalls?',gShowsPanel(R,'shortfalls')?insComponents(I,R):'')
    +gQuestionSlide('g-slide-component-movement','How did components change between the selected periods?',gShowsPanel(R,"component-movement")?componentMovement(R):"")
    +gQuestionSlide('g-slide-component-relationships','How did components move with the weekly result?',relationships?componentRelationships(R):"")
    +gQuestionSlide('g-slide-cart','What did the historical check show for each profile?',gShowsPanel(R,"cart")?cartProfiles(R):"");
  if(!body)body='<p>The selected questions have no available results in this scope. See Evidence for coverage.</p>';
  return gArt("chapter-factors",2,"Performance Factors","Compare groups, contact drivers and measures linked with "+ml()+".",body,xb("Performance factors","calc"));
}
function scenarioGlidepath(s,R){
  var weeks=(s.glidepath||{}).weeks;
  if(!weeks||!weeks.length)return '';
  var points=[{week:0,value:s.baseline}].concat(weeks),last=weeks[weeks.length-1];
  var references=[s.baseline,last.value,s.target].filter(Number.isFinite);
  var min=Math.min(...references),max=Math.max(...references),pad=Math.max((max-min)*.12,Number.EPSILON);
  var lo=min-pad,hi=max+pad;
  var left=76,right=604,top=18,bottom=120;
  function x(week){return left+(right-left)*week/last.week;}
  function y(value){return hi===lo?(top+bottom)/2:bottom-(bottom-top)*(value-lo)/(hi-lo);}
  var heading='Illustrative '+last.week+'-week glidepath';
  var ticks=[min,max].map(function(value){
    return '<line x1="'+left+'" x2="'+right+'" y1="'+y(value)+'" y2="'+y(value)+'" stroke="var(--line)"/>'
      +'<text x="'+(left-8)+'" y="'+(y(value)+4)+'" text-anchor="end">'+esc(fcValue(value))+'</text>';
  }).join('');
  var line=points.map(function(p){return x(p.week)+','+y(p.value);}).join(' ');
  var markers=points.map(function(p){
    var label=p.week?'Week '+p.week:'Baseline';
    return '<circle cx="'+x(p.week)+'" cy="'+y(p.value)+'" r="3.5" fill="var(--accent)"><title>'+esc(label+': '+fcValue(p.value))+'</title></circle>'
      +'<text x="'+x(p.week)+'" y="148" text-anchor="middle">'+label+'</text>';
  }).join('');
  return '<div><div class="g-chart-head"><strong>'+heading+'</strong><span class="muted">Equal improvement each week</span></div>'
    +''+'<svg class="g-chart" viewBox="0 0 640 162" role="img" aria-label="'+esc(heading+' for '+ml())+'">'+ticks
    +(Number.isFinite(s.target)?'<line class="gc-target" x1="'+left+'" x2="'+right+'" y1="'+y(s.target)+'" y2="'+y(s.target)+'"/><text x="'+right+'" y="'+(y(s.target)-4)+'" text-anchor="end">Target '+esc(fcValue(s.target))+'</text>':'')
    +'<polyline fill="none" stroke="var(--accent)" stroke-width="2" stroke-dasharray="5 4" points="'+line+'"/>'+markers+'</svg></div>';
}
function insScenario(I,R,evidence=false){var s=I.scenario;if(!s||!I.constraints)return '';
  if(s.blocked){
    var reason={"TARGET-REQUIRED":"An applicable target is needed to size the improvement.",
      "MAXIMUM-REQUIRED":"The metric needs a governed scale maximum to size the improvement.",
      "BASELINE-REQUIRED":"The selection has no eligible baseline for sizing.",
      "NO-LIFT":"The applicable requirement has no direction for sizing improvement."}[s.blocked]
      ||"The selected inputs do not support a lift estimate.";
    return evidence?'<h3>Conditional improvement scenario</h3><p>'+esc(reason)+'</p>'
      :gSlideTakeaway('Estimated improvement is unavailable.','<h4>Facts</h4><p>'+esc(reason)+'</p>');
  }
  var adoption=Math.round(s.adoption*100)+'%',tgt=fcValue(s.target),glidepath=scenarioGlidepath(s,R);
  var target=s.baseline_target_met===true?'The observed baseline already meets the '+tgt+' target.'
    :s.target_met===true?'The scenario meets the '+tgt+' target.':s.target_met===false?'The scenario falls short of the '+tgt+' target.':'';
  var nextStep=s.target_beyond_modeled_lift===true?'Review remaining constraints and involve the client or other parties who can help resolve those outside the team’s control.':'';
  if(s.target_met===false&&Number.isFinite(s.adoption_to_meet_target))target+=' The scenario reaches it at about '+Math.round(s.adoption_to_meet_target*100)+'% adoption.';
  if(s.target_beyond_modeled_lift===true)target+=' Required adoption rate: more than 100%.';
  var state=observedState(R);
  var table='<div class="scroll"><table><thead><tr><th>Week</th><th>'+esc(chartMetricAxis())+'</th></tr></thead><tbody>'
    +[{week:0,value:s.baseline},...(s.glidepath?.weeks||[])].map(row=>'<tr><th scope="row">'+(row.week||'Observed baseline')+'</th><td>'+esc(fcValue(row.value))+'</td></tr>').join('')+'</tbody></table></div>';
  var sizing='If the uploaded counts describe the baseline, the scenario allocates improvement room by controllable occurrence share and applies '+adoption+' adoption. The eight-week illustration spreads the modeled change evenly.';
  var incomplete=s.delivery_status==="incomplete";
  var answer=incomplete
    ?(s.total_lift>0?'The deliverable recommendations provide a partial modeled change of '+insDifferenceSize(s.total_lift)+'.'
      :'The selected recommendations do not establish a deliverable lift estimate.')
    :s.total_lift>0
    ?'At '+adoption+' adoption, modeled '+ml()+' is '+fcValue(s.after)+' from an observed baseline of '+fcValue(s.baseline)+'.'
    :'The model estimates zero improvement at '+adoption+' adoption.';
  var facts='<p>'+esc(sizing)+'</p>'+(target?'<p>'+esc(target)+'</p>':'')
    +(incomplete?'<p>Some required actions are absent from the selected recommendations. Allocated shares held out of the deliverable subtotal: '
      +esc(insDifferenceSize(s.withheld_lift))+'.</p>':'')
    +(s.total_lift>0?'<p>Conditional change '+esc(insSignedGap(s.after-s.baseline))+'.</p>':'')
    +(s.target_met===false?'<p>Remaining gap '+esc(insDifferenceSize(s.after-s.target))+'.</p>':'')
    +(nextStep?'<h4>Next step</h4><p>'+esc(nextStep)+'</p>':'');
  if(evidence)return '<h3>Conditional improvement scenario</h3><p>'+esc(answer)+'</p>'+facts+table;
  return '<section id="g-scenario-panel" class="g-chart-container-box g-help-scenario" aria-labelledby="g-help-scenario-title">'
   +(glidepath?'<div class="g-observed-filters">'+reportChartControls("scenario",state)+'</div>':'')
   +gSlideResult(gSlideTakeaway(answer,'<h4>Facts</h4>'+facts),
    '<h3 id="g-help-scenario-title">Conditional improvement scenario</h3>'+(glidepath?(state.scenarioView==="table"?table:glidepath):'<p>No improvement glidepath is available.</p>'))+'</section>';
}
function insActionTitle(c){
  return c.title||'Review '+(c.lever||c.category).toLowerCase();
}
function insActionStatus(c){return (c.status==='approved'?'Recommendation':'Draft recommendation')+' · '+(c.action_kind==='investigate'?'Investigation':'Action');}
var ACTION_CATEGORY_STYLES={"Human performance":"people","Process and knowledge":"process","Technology and infrastructure":"technology",
  "Workforce management":"workforce","Client constraints":"client"};
function actionLiftText(c,scenario){
  if(!Number.isFinite(c.lift))return c.lift_reason||'Conditional lift is unavailable for this action.';
  if(c.lift===0)return 'The model allocates zero lift to this action.';
  return 'Conditional lift '+insDifferenceSize(c.lift)+(Number.isFinite(scenario?.adoption)?' at '+Math.round(scenario.adoption*100)+'% adoption': '')
    +', assuming the undated constraint counts cover the baseline.';
}
function actionFollowups(c){
  return c.also_review?.length?'<h5>Also review</h5><ul>'+c.also_review.map(item=>'<li>'+esc(item.text)+'</li>').join('')+'</ul>':'';
}
function insCard(c,index,scenario){
  var pre=c.before_you_act?.length?'<p><strong>Before you act</strong> '+esc(c.before_you_act[0])+'</p>':'';
  var lift='<p class="g-card-lift">'+esc(actionLiftText(c,scenario))+'</p>';
  var shared=c.pool_allocations?.some(pool=>pool.actions>1)?'<p>Shares a constraint pool with other recommendations.</p>':'';
  var category=ACTION_CATEGORY_STYLES[c.category];
  return '<article class="x-card"'+(category?' data-action-category="'+category+'"':'')
    +'><div class="g-action-card-main"><h4>'+esc(insActionTitle(c))+'</h4>'
    +'<p class="muted">'+esc(c.category+' · '+insActionStatus(c))+'</p><p>'+esc(c.text)+'</p></div>'
    +'<div class="g-action-card-details">'+lift+(c.delivery_reason?'<p>'+esc(c.delivery_reason)+'</p>':'')+shared+pre+actionFollowups(c)+'</div>'
    +'<button type="button" class="g-linkbtn" data-chapter="g-action-evidence-'+index+'">View supporting Evidence</button></article>';
}
function insActionEvidence(c,index,scenario){
  var pre=(c.before_you_act||[]).length?'<p class="muted"><strong>Before you act</strong></p><ul>'+c.before_you_act.map(function(step){return '<li>'+esc(step)+'</li>';}).join('')+'</ul>':'';
  var lim=(c.limitations||[]).length?'<p class="muted">'+(c.limitations||[]).map(esc).join(' ')+'</p>':'';
  var lift='<p>'+esc(actionLiftText(c,scenario))+'</p>';
  var pools=(c.pool_allocations||[]).map(pool=>'<li>'+esc(pool.level2+' · '+displayNumber(pool.count,0,6)+' occurrences · '
    +percentNumber(pool.share*100)+'% of controllable occurrences · '+percentNumber(pool.allocation_fraction*100)
    +'% of pool allocated to this action')+'</li>').join('');
  var score=Number.isFinite(c.opportunity_score)?displayNumber(c.opportunity_score,1):'Unavailable';
  var ranking='<p>Priority score '+score+' · Urgency '+displayNumber(c.urgency,1)+' of 5. '
    +'Distinct contributing analyses '+n0(c.recurrence_analyses?.length||0)+'.</p>';
  var change=c.worsening_available?'<p>In scope, the first calendar half was '+esc(fcValue(c.first_half))+' and the second was '+esc(fcValue(c.second_half))+'.</p>'
    :'<p>'+esc(c.worsening_reason||'A change across calendar halves is unavailable for this opportunity.')+'</p>';
  var mon=c.monitoring&&c.monitoring.review_after_weeks?'<p class="muted">Review the result after '+c.monitoring.review_after_weeks+' weeks.</p>':'';
  var note=c.long_description?'<p>'+esc(c.long_description)+'</p>':'';
  var details=note+pre+lim+mon;
  var rank=c.rank?'Rank '+n0(c.rank)+' in this category'+(c.tied?' · Tied category score':'')
    +(c.overall_tied?' · Tied score among selected cards':''):'';
  return '<article class="x-card" id="g-action-evidence-'+index+'"><div class="g-chart-head"><span class="g-kpi-badge g-neutral">'+(c.status==='approved'?'Recommendation':'Draft recommendation')+'</span>'
    +(rank?'<span class="muted">'+rank+'</span>':'')+'</div><h4>'+esc(insActionTitle(c))+'</h4><p>'+esc(c.text)+'</p>'
    +lift+ranking+change+(c.delivery_reason?'<p>'+esc(c.delivery_reason)+'</p>':'')+(pools?'<ul>'+pools+'</ul>':'')+actionFollowups(c)
    +'<details class="g-values"><summary>Action details</summary><p>'+esc(c.opportunity_id)+' · Template revision '+n0(c.entry_version)+'.</p>'
    +'<p>Disposition '+esc(c.disposition||'selected')+' · Primary claim '+esc(c.claim_status||'descriptive')+'.</p>'
    +'<p>Supporting opportunity IDs '+esc((c.member_ids||[]).join(', '))+'.</p>'
    +(c.covered_followups?.length?'<p>Covered follow-ups stay in the trace because this recommendation is outside the shortlist.</p>':'')
    +details+'</details></article>';
}
function rankedActionSummary(I){
  return (I.cards||[]).filter(card=>card.opportunity_score>0).slice(0,5);
}
function actionRecommendationEvidence(I){
  var selected=I.cards||[],overflow=I.other_recommendations||[];
  var attribution=I.action_attribution,scope=attribution?.scope;
  if(!selected.length&&!overflow.length&&!attribution)return '';
  var context=Object.entries(I.action_context||{}).map(([role,value])=>{
    var label=role==='CV'?'Countervailing metric':'North-star metric';
    return '<li>'+esc(label+' · '+(value.metric?metricInfo(value.metric).label:'None defined')
      +' · '+(Number.isFinite(value.coefficient)?'weekly correlation '+componentStat(value.coefficient)+' from '
        +n0(value.weeks)+' paired weeks'+(value.source?' in '+value.source:''):'correlation unavailable ('+value.status.replaceAll('_',' ')+')')
      +' · expected '+value.expected_sign+' sign · '+n0(value.points)+' urgency points')+'</li>';
  }).join('');
  var routeNotes=(attribution?.routes||[]).map(item=>'<li>'+esc(item.rule+' · '+item.status+' · '+(item.reason||item.candidate||item.covering||''))+'</li>').join('');
  var dispositions=[...(attribution?.coverage||[]),...(attribution?.withheld||[])].map(item=>'<li>'+esc((item.title||item.finding||item.instance_id)
    +' · '+(item.reason||('Covered by '+item.covering)))+'</li>').join('');
  var basis=scope?'<p>'+esc(scope.period.join(' to ')+' · '+n0(scope.count)+' '+gCountLabel().toLowerCase())+'</p>':'';
  return '<h3>Recommendation evidence</h3>'+(context?'<p>These urgency inputs apply across the report.</p><ul>'+context+'</ul>':'')
    +basis+selected.map((card,index)=>insActionEvidence(card,index,I.scenario)).join('')
    +(overflow.length?'<h4>Other recommendations</h4>'+overflow.map((card,index)=>insActionEvidence(card,selected.length+index,I.scenario)).join(''):'')
    +((routeNotes||dispositions)?'<details><summary>Combination and candidate checks</summary><ul>'+routeNotes+dispositions+'</ul></details>':'');
}
function externalPriorityPanel(I,evidence=false){
  var result=I.external_potential,rows=result?.priorities;
  if(!result?.total_occurrences)return '';
  var scope=displayNumber(result.total_occurrences,0,6)+' recorded uncontrollable occurrences in the uploaded account counts. '
    +'If those undated counts cover the baseline, this reporting scenario uses '+Math.round(result.adoption*100)
    +'% adoption and allocates the same improvement room as the internal scenario. Adding the totals would double-count that room.';
  var total=Number.isFinite(result.total_potential)?insDifferenceSize(result.total_potential):'Unavailable';
  var table='<div class="scroll"><table><thead><tr><th>Rank</th><th>Recorded issue</th><th>Occurrences</th><th>Share</th><th>Intangible external potential</th></tr></thead><tbody>'
    +rows.map(row=>'<tr><td>'+n0(row.rank)+'</td><th scope="row">'+esc(row.title)+'</th><td>'+displayNumber(row.count,0,6)+'</td><td>'
      +percentNumber(row.share*100)+'%</td><td>'+(Number.isFinite(row.lift)?esc(insDifferenceSize(row.lift)):'Unavailable')+'</td></tr>').join('')+'</tbody></table></div>';
  var facts='<h4>Facts</h4><p>'+esc(scope)+'</p><p>Total intangible external potential '+esc(total)+'.</p>';
  var answer=rows.length?rows[0].title+' ranks first among recorded priorities for external involvement.'
    :'No classified constraint qualifies as a priority for external involvement.';
  var ledger=evidence?'<details><summary>All uncontrollable labels in the denominator</summary><ul>'
    +(result.pool_ledger||[]).map(row=>'<li>'+esc(row.label+' · '+displayNumber(row.count,0,6)+' occurrences · '+percentNumber(row.share*100)
      +'% · '+(row.priority?'Priority':'Outside the 80% priority set')+(row.unclassified?' · Needs classification':''))+'</li>').join('')+'</ul></details>':'';
  return evidence?'<h3>External priorities</h3><p>'+esc(answer)+'</p>'+facts+(rows.length?table:'')+ledger
    :rows.length?gSlideResult(gSlideTakeaway(answer,facts),table):gSlideTakeaway(answer,facts);
}
function gCh4(R){
  var I=R&&R.insights;
  if(!I)return gArt("chapter-help",4,"What Could Help","No recommendations are available for this selection.","",xb("What could help","na"));
  var cards=I.cards||[];
  var priority=rankedActionSummary(I)[0];
  var categoryTotals=Object.entries(I.category_lift||{});
  var actions=cards.length?'<section class="g-report-card" id="g-help-actions" aria-label="Recommended action cards">'+gSlideTakeaway(priority
    ?insActionTitle(priority)+' is the highest-scored recommendation at the applied adoption rate.'
    :'Review the evidence behind the eligible recommendations. None has a positive, available priority score.',
    categoryTotals.length?'<h4>Conditional lift by category</h4><ul>'+categoryTotals.map(([name,lift])=>'<li>'
      +'<span class="g-action-category-key" aria-hidden="true" data-action-category="'+esc(ACTION_CATEGORY_STYLES[name]||'')+'"></span>'
      +esc(name+' · '+insDifferenceSize(lift))+'</li>').join('')+'</ul>':'')
    +'<div class="g-help-actions">'+cards.map((c,index)=>insCard(c,index,I.scenario)).join('')+'</div></section>'
    :gSlideTakeaway('No playbook recommendations are available for this selection.');
  var factors=gHas(R,"factors")?'<button type="button" class="g-linkbtn" data-chapter="chapter-factors">Review the Performance Factors</button>':'';
  var scenario=gShowsPanel(R,"scenario")?insScenario(I,R):"";
  if(!scenario&&(S.page==="full-insights"||R.report_panels?.includes("scenario")))scenario=gSlideTakeaway('An improvement scenario needs a usable target gap and controllable constraints linked to actions.');
  var body=factors+gQuestionSlide("g-slide-scenario","What improvement does the scenario illustrate?",scenario)
    +gQuestionSlide("g-slide-actions","What operational areas should we improve in?",actions)
    +gQuestionSlide("g-slide-external","Which issues need client or external involvement?",externalPriorityPanel(I));
  return gArt("chapter-help",4,"What Could Help","Review the actions Athena selected from the playbook and any improvement the scenario illustrates.",body,xb("What could help","calc"));
}
function gCh5(R){
  var cv=R.coverage||{},A=R.target_assessment,I=R.insights,cards=[];
  var guide=["State the metric, the analysis dates and the scope when presenting the result."];
  if(A&&A.status==="published"&&A.multiple_targets)guide.push("Present the target results by effective period.");
  if(gHas(R,"factors")&&I)guide.push("Describe supported group differences as associations and identify the groups compared.");
  if(gHas(R,"ahead")&&R.forecast&&R.forecast.status==="published")guide.push("Identify the projected weeks and explain that the forecast assumes the recent pattern continues.");
  if(gHas(R,"help")&&I&&I.scenario&&!I.scenario.blocked)guide.push("Name the adoption rate when discussing the conditional improvement scenario.");
  var intro='<section aria-labelledby="g-presentation-guide"><h3 id="g-presentation-guide">How to present these results</h3><ul>'+guide.map(function(item){return '<li>'+esc(item)+'</li>';}).join("")+'</ul></section>';
  var files=gReportDatasets(R)?.length?'<details class="g-values"><summary>Data analyzed and source files</summary>'+dataSummaryHtml()+'</details>':'';
  if(cv.any_set_aside)cards.push(["Set aside and held",n0(cv.set_aside_contacts_in_scope)+" contacts in scope were set aside or held."]);
  if(cv.unattributed_contacts>0)cards.push(["Contacts without an agent",n0(cv.unattributed_contacts)+" contacts have no agent. They count in account and Line of Business results but not in agent comparisons."]);
  if(cv.collapsed_copies_in_scope>0)cards.push(["Exact duplicates",n0(cv.collapsed_copies_in_scope)+" duplicate rows were counted once and remain traceable."]);
  if(R.configuration&&R.configuration.confirmed_by)cards.push(["Account definitions","Configuration confirmed by "+R.configuration.confirmed_by+"."]);
  var srcAttr=xb("Supporting evidence","calc");
  var notes=cards.length?'<div class="x-ev">'+cards.map(function(c){return '<div class="g-mini-card"><h3>'+esc(c[0])+'</h3><p>'+esc(c[1])+'</p></div>';}).join("")+'</div>':'';
  var body=reportCard("g-evidence-guide",intro+chartScopeTitle(R,"Report dates")+notes)
    +reportCard("g-requirements-evidence",R.account_requirements?requirementsPanel(R,true):'')
    +reportCard("g-evidence-calculation",'<h3>Technical evidence</h3>'+files+xEvidence()+matchEvidence(R))
    +reportCard("g-trend-evidence",gReportViews(R).includes("time")?trendEvidence(R):'')
    +reportCard("g-stability-evidence",showsStability(R)?stabilityEvidence(R):'')
    +reportCard("g-volume-evidence",gReportViews(R).includes("time")&&Array.isArray(R.report_panels)&&gShowsPanel(R,"volume")?reportVolumeEvidence(R):'')
    +reportCard("g-hourly-evidence",R.hourly_heatmap&&gShowsPanel(R,"hourly")?gHourlyHeatmap(R):'')
    +reportCard("g-box-evidence",gShowsPanel(R,"groups")?gReportGroups(R,true):'')
    +reportCard("g-histogram-evidence",gShowsPanel(R,"distribution")?gHistogram(R,true):'')
    +reportCard("g-agents-evidence",S.page==="full-insights"||!Array.isArray(R.report_panels)?gAgentHeatmap(R,true):'')
    +reportCard("g-gaps-evidence",gHas(R,"factors")&&(S.page==="full-insights"||!Array.isArray(R.report_panels))?insSegments(R,true):'')
    +reportCard("g-cohorts-evidence",I&&gHas(R,"factors")?insCohorts(I,R,true):'')
    +reportCard("g-direct-gaps-evidence",I&&gHas(R,"factors")?insPairwise(I,null,true):'')
    +reportCard("g-mix-evidence",I&&gHas(R,"factors")&&gShowsPanel(R,"period-change")?insMix(I,R,true):'')
    +reportCard("g-driver-evidence",I&&gHas(R,"factors")&&gShowsPanel(R,"driver-impact")?insContactDriverImpact(I.contact_driver_impact,R,true):'')
    +reportCard("g-constraints-evidence",I&&gHas(R,"factors")&&gShowsPanel(R,"constraints")?insConstraints(I,R,true):'')
    +reportCard("g-shortfalls-evidence",I&&gHas(R,"factors")&&gShowsPanel(R,"shortfalls")?insComponents(I,R,true):'')
    +reportCard("g-evidence-projection",gHas(R,"ahead")?fcEvidence(R):'')
    +reportCard("g-contact-evidence",gHas(R,"factors")?gContactPerformance(R,true):'')
    +reportCard("g-scenario-evidence",I&&gHas(R,"help")?insScenario(I,R,true):'')
    +reportCard("g-evidence-comparisons",(I&&(gHas(R,"factors")||gHas(R,"help"))?insEvidence(I):'')+(gHas(R,"happened")?cldEvidence(I,gHas(R,"factors")):''))
    +reportCard("g-evidence-relationships",I&&gHas(R,"factors")?metricRelationshipEvidence(I.metric_relationships):'')
    +(I&&gHas(R,"factors")?componentMovementEvidence(R,I.component_movement)+componentLinkEvidence(I.component_links)+cartEvidence(I.cart_profiles):'')
    +reportCard("g-evidence-actions",I&&gHas(R,"help")?actionRecommendationEvidence(I):'')
    +reportCard("g-external-evidence",I&&gHas(R,"help")?externalPriorityPanel(I,true):'');
  if(R.current_actions?.length){
    body+=reportCard("g-evidence-current-actions",'<h3>Recorded actions (D07)</h3><div class="scroll"><table><thead><tr><th scope="col">Action</th><th scope="col">Recorded owner</th><th scope="col">Start</th><th scope="col">End</th><th scope="col">Registry status at report cutoff</th></tr></thead><tbody>'
      +R.current_actions.map(a=>'<tr><th scope="row">'+esc(a.id+' · '+a.title)+'</th><td>'+esc(a.owner||'Unavailable')+'</td><td>'+esc(a.start)+'</td><td>'+esc(a.end||'Open date range')+'</td><td>'+esc(a.status)+'</td></tr>').join('')+'</tbody></table></div>');
  }
  return gArt("chapter-evidence",5,"Evidence and presentation guide","Use this chapter to check the data, methods, and limits behind the results.",body,srcAttr);
}
var G_EVIDENCE_DETAILS=[
  ["g-volume-evidence","Busiest business dates","g-slide-daily","Handled contact counts by date. Use this table to locate periods of high workload."],
  ["g-hourly-evidence","Day and hour grid","g-slide-daily","Eligible results by business date and local hour in the applied time scope."],
  ["g-agents-evidence","Agent and group grid","g-slide-distribution","Agent and group values, with observation counts and source-specific measures."]
];
function gEvidenceSourceRoles(R,id){
  var state=observedState(R),I=R.insights;
  var roles={
    "g-slide-requirements":[["primary","Weighted KPI and effective-period comparisons"]],
    "g-slide-score-cutoff":[["primary","Eligible scores and cutoff results"]],
    "g-slide-volume":[["primary","Handled counts by business date"]],
    "g-slide-contact-performance":[["primary","Handled counts and KPI by contact type"]],
    "g-slide-group-totals":[["primary","KPI totals by group"]],
    "g-slide-distribution":[["primary","Pooled agent results and cohort membership"]],
    "g-factor-agent-groups":[["primary","Pooled agent values and cohort ranks"]],
    "g-factor-direct-gaps":[["primary","Observed group gaps and shared work mix"]],
    "g-factor-period-change":[["primary","KPI and work shares by period"]],
    "g-slide-scenario":I?.scenario&&!I.scenario.blocked?[["primary","Observed KPI baseline"],["D09","Recorded controllable constraints behind the modeled lift"]]:[]
  };
  if(id==="g-slide-daily"){
    var hasEvents=R.metric?.metric_id==="aht"?dailyAhtSelection(R,state).events.length
      :state.events&&trendSelection(R,state).events.length;
    return [["primary","Daily KPI values"],...(hasEvents?[["D08","Calendar events in the applied scope"]]:[])];
  }
  if(id==="g-slide-hourly"&&R.hourly_heatmap){
    return [["primary","KPI observations by business date and hour"],
      ...(R.hourly_heatmap.selection.lead?[["D06","Team lead assignment for the applied selection"]]:[])];
  }
  if(id==="g-slide-agents"){
    var agent=agentHeatmapSelection(R,state);
    if(agent)return [...new Set(agent.columns.map(column=>column.source))].map(code=>[code,"Measures in the applied heatmap"])
      .concat(["team_lead","manager_name"].includes(agent.group.id)?[["D06","Roster grouping for the applied heatmap"]]:[]);
  }
  if(id==="g-slide-groups"){
    var box=boxSelection(R,state);
    if(box&&box.groups.length)return [["primary","Values for the applied measure"],
      ...(!Object.hasOwn(OBSERVED_DIMENSIONS,box.dim)?[["D06","Roster grouping for the applied comparison"]]:[])];
  }
  if(id==="g-factor-comparisons"){
    var factor=factorSelection(R,state);
    if(factor)return [["primary","Group KPI and comparable work"],
      ...(!Object.hasOwn(OBSERVED_DIMENSIONS,factor.dim)?[["D06","Roster grouping for the applied comparison"]]:[])];
  }
  if(id==="g-slide-component-movement"&&I?.component_movement){
    var movement=I.component_movement;
    return [[movement.source,"Component observations in the applied periods"],
      ...(movement.selection.group?[["D06","Team lead assignment for the applied selection"]]:[])];
  }
  return roles[id]||[];
}
function gRefreshEvidenceSources(section,R){
  var datasets=gReportDatasets(R)||[],id=section.id.slice('evidence-'.length);
  var uses={
    "g-slide-relationships":["Weekly metric relationships"],"g-factor-driver-impact":["Contact driver impact"],
    "g-factor-constraints":["Constraint analysis"],"g-factor-shortfalls":["Component shortfalls"],
    "g-slide-component-relationships":["Weekly component relationships"],"g-slide-cart":["Historical CART profiles"],
    "g-slide-projection":["Forecast"]
  }[id]||[];
  var roles=gEvidenceSourceRoles(R,id),sources=datasets.flatMap(dataset=>{
    var names=(dataset.uses||[]).filter(use=>uses.includes(use));
    for(var [code,role] of roles){
      if(code===dataset.code||(code==='primary'&&dataset.primary))names.push(role);
    }
    return names.length?['<li>'+esc(dataset.code+' · '+dataset.file+' · '+names.join(', '))+'</li>']:[];
  });
  var block=section.querySelector('.g-evidence-sources')||document.createElement('div');
  block.className='g-evidence-sources';
  block.hidden=!sources.length;
  block.innerHTML=sources.length?'<strong>Sources and their roles</strong><ul>'+sources.join('')+'</ul>':'';
  var heading=section.querySelector(':scope > .g-report-card > :is(h3,h4)');
  if(heading)heading.after(block);
  else section.querySelector('.g-evidence-thumbnail').after(block);
}
function gOrganizeEvidence(R,page){
  var article=page.querySelector("#chapter-evidence");
  if(!article)return;
  var entries={
    "g-slide-requirements":["g-requirements-evidence"],
    "g-slide-daily":["g-trend-evidence"],"g-slide-stability":["g-stability-evidence"],
    "g-slide-hourly":["g-hourly-evidence"],"g-slide-volume":["g-volume-evidence"],
    "g-slide-groups":["g-box-evidence"],"g-slide-distribution":["g-histogram-evidence"],"g-slide-agents":["g-agents-evidence"],
    "g-slide-relationships":["g-evidence-relationships"],"g-factor-comparisons":["g-gaps-evidence","g-evidence-comparisons"],
    "g-slide-component-movement":["g-component-movement-evidence"],"g-slide-component-relationships":["g-component-relationship-evidence"],
    "g-slide-cart":["g-cart-evidence"],"g-slide-projection":["g-evidence-projection"],"g-slide-actions":["g-evidence-actions"],
    "g-slide-contact-performance":["g-contact-evidence"],"g-factor-agent-groups":["g-cohorts-evidence"],"g-factor-direct-gaps":["g-direct-gaps-evidence"],
    "g-factor-period-change":["g-mix-evidence"],"g-factor-driver-impact":["g-driver-evidence"],"g-factor-constraints":["g-constraints-evidence"],
    "g-factor-shortfalls":["g-shortfalls-evidence"],"g-slide-scenario":["g-scenario-evidence"],"g-slide-external":["g-external-evidence"]
  };
  var index=document.createElement("ol"),questions=document.createElement("div");
  index.className="g-evidence-index";
  for(var slide of page.querySelectorAll("#chapter-summary,#g-report-presentation .g-question-slide")){
    var id=slide.id,question=slide.querySelector(".g-slide-question")?.textContent||"Executive Summary",target="evidence-"+id;
    var li=document.createElement("li");
    li.innerHTML='<button class="g-linkbtn" type="button" data-chapter="'+target+'">'+esc(question)+'</button>';
    index.append(li);
    var section=document.createElement("section");
    section.id=target;
    section.className="g-evidence-question";
    section.setAttribute("aria-labelledby",target+"-title");
    section.innerHTML='<h3 id="'+target+'-title">'+esc(question)+'</h3><div data-evidence-claims></div>'
      +'<div class="g-evidence-thumbnail"><div class="g-evidence-preview" data-evidence-preview="'+id+'" aria-hidden="true" inert></div>'
      +'<button type="button" data-evidence-slide="'+id+'" aria-label="'+esc("Return to slide: "+question)+'"><span>Return to slide '+gIcon(RETURN_TO_SLIDE_ICON,16)+'</span></button></div>';
    var cards=(entries[id]||[]).map(key=>article.querySelector("#"+key)).filter(Boolean);
    if(cards.length)section.append(...cards);
    else if(id==="chapter-summary"){
      section.insertAdjacentHTML('beforeend','<p>Trace the briefing to the applicable requirements and the supporting chapter results.</p>');
    }

    else{
      var content=document.createElement("div");
      content.dataset.evidenceCopy=id;
      section.append(content);
    }
    questions.append(section);
  }
  for(var [entry,label,preferred,description] of G_EVIDENCE_DETAILS){
    var detail=article.querySelector("#"+entry);
    if(!detail)continue;
    var origin=page.querySelector("#"+preferred)?preferred:"chapter-happened";
    detail.insertAdjacentHTML("afterbegin",'<h3>'+esc(label)+'</h3><p>'+esc(description)+'</p>');
    detail.insertAdjacentHTML("beforeend",'<button class="g-linkbtn" type="button" data-evidence-slide="'+origin+'">Return to What Happened</button>');
    var row=document.createElement("li");
    row.innerHTML='<button class="g-linkbtn" type="button" data-chapter="'+entry+'">'+esc(label)+'</button>';
    index.append(row);
    questions.append(detail);
  }
  if(index.children.length){
    var contents=document.createElement("section");
    contents.innerHTML="<h3>Evidence by question</h3>";
    contents.append(index,questions);
    article.querySelector("#g-evidence-guide").after(contents);
  }
  for(var slide of page.querySelectorAll("#g-report-presentation .g-question-slide")){
    syncSlideSubtitle(slide);
    collectSlideControls(slide.querySelector(".g-slide-content"),slide.querySelector(".g-slide-toolbar"));
    syncTakeawayEvidence(slide);
  }
  for(var [i,card] of [...(R.insights?.cards||[]),...(R.insights?.other_recommendations||[])].entries()){
    var evidence=article.querySelector('#g-action-evidence-'+i);
    if(!evidence)continue;
    var finding=card.finding||'',basis={"cohort-worst-quartile":"g-cohort-evidence-quartiles","mix-shift":"g-mix-evidence"}[finding];
    if(finding.startsWith('constraint-'))basis='g-constraints-evidence';
    if(finding.startsWith('component-'))basis='g-shortfalls-evidence';
    for(var [target,label] of [[basis,'See the supporting result'],[card.lift?'g-scenario-evidence':null,'See the modeled lift basis']]){
      if(target&&article.querySelector('#'+target))evidence.insertAdjacentHTML('beforeend',
        '<button type="button" class="g-linkbtn" data-chapter="'+target+'">'+label+'</button>');
    }
  }
}
function syncTakeawayEvidence(slide,source=slide){
  if(!slide)return;
  var target='evidence-'+slide.id;
  var reportEvidence=document.getElementById('g-report-evidence');
  if(!reportEvidence?.contains(document.getElementById(target)))return;
  var aside=source.querySelector(".g-slide-takeaway")||slide.querySelector(".g-slide-takeaway");
  if(!aside)return;
  var footer=aside.querySelector('.g-takeaway-evidence')||document.createElement('footer');
  var links=[...source.querySelectorAll('[data-chapter]')].filter(node=>reportEvidence.contains(document.getElementById(node.dataset.chapter)));
  var link=footer.querySelector('button')||links.find(node=>node.id==='g-trend-evidence-link');
  for(var shortcut of links)if(shortcut!==link)shortcut.remove();
  if(!link){
    link=document.createElement('button');
    link.type='button';
    link.className='g-linkbtn';
  }
  footer.className='g-takeaway-evidence';
  link.dataset.chapter=target;
  link.textContent='Evidence';
  link.setAttribute('aria-label','Evidence for '+slide.querySelector('.g-slide-question').textContent);
  footer.replaceChildren(link);
  aside.append(footer);
}
function updateSelectedTakeaway(chart){
  var modal=S.modal?.chartMode==="focus"&&S.modal.card===chart?S.modal:null;
  var slide=(modal?.placeholder||chart).closest('.g-question-slide');
  syncTakeawayEvidence(slide,chart);
  if(modal)retainFocusedTakeaway(modal);
}
function gEvidenceCopy(source){
  var copy=source.cloneNode(true);
  var originals=source.querySelectorAll("select");
  copy.querySelectorAll("select").forEach((select,i)=>select.selectedIndex=originals[i].selectedIndex);
  for(var node of [copy,...copy.querySelectorAll("*")]){
    for(var name of ["id","for","aria-labelledby","aria-describedby","aria-controls","name"])node.removeAttribute(name);
    for(var attribute of [...node.attributes])if(attribute.name.startsWith("data-"))node.removeAttribute(attribute.name);
  }
  return copy;
}
function gPrepareEvidence(evidence,presentation){
  evidence.previewWidth=presentation.querySelector(".g-question-slide")?.offsetWidth||900;
  var R=xR();
  for(var section of evidence.querySelectorAll('.g-evidence-question')){
    var source=document.getElementById(section.id.slice("evidence-".length));
    var target=section.querySelector('[data-evidence-claims]');
    var claim=source.querySelector('.g-slide-takeaway,.g-summary-findings');
    if(claim&&target){
      var view=gEvidenceCopy(claim);
      view.querySelectorAll('button,footer').forEach(node=>node.remove());
      target.replaceChildren(view);
    }
    gRefreshEvidenceSources(section,R);
  }
  for(var holder of evidence.querySelectorAll("[data-evidence-copy]")){
    var source=document.getElementById(holder.dataset.evidenceCopy);
    var copy=gEvidenceCopy(source);
    copy.querySelectorAll(".g-slide-heading,.g-guide,.g-observed-filters,button,svg").forEach(node=>node.remove());
    holder.replaceChildren(...copy.childNodes);
    if(!holder.textContent.trim())holder.innerHTML='<p>No separate supporting detail is available for this question.</p>';
  }
}
function gShowEvidencePreviews(evidence){
  evidence.previewObserver?.disconnect();
  var observer=new IntersectionObserver(entries=>{
    for(var entry of entries){
      if(!entry.isIntersecting)continue;
      var holder=entry.target,source=document.getElementById(holder.dataset.evidencePreview);
      var slide=gEvidenceCopy(source);
      slide.querySelectorAll(".g-guide, button, .g-observed-filters").forEach(node=>node.remove());
      slide.style.width=evidence.previewWidth+"px";
      holder.replaceChildren(slide);
      var scale=Math.min(holder.clientWidth/slide.offsetWidth,holder.clientHeight/slide.offsetHeight);
      slide.style.transform="scale("+scale+")";
      observer.unobserve(holder);
    }
  });
  evidence.previewObserver=observer;
  for(var holder of evidence.querySelectorAll("[data-evidence-preview]")){
    holder.replaceChildren();
    observer.observe(holder);
  }
}
var G_CH=[["chapter-happened","Chapter 1","What Happened","1. What Happened"],["chapter-factors","Chapter 2","Performance Factors","2. Performance Factors"],["chapter-ahead","Chapter 3","What's Ahead","3. What's Ahead"],["chapter-help","Chapter 4","What Could Help","4. What Could Help"],["chapter-evidence","Chapter 5","Evidence and presentation guide","5. Evidence and presentation guide"]];
var G_KEY={"chapter-happened":"happened","chapter-factors":"factors","chapter-ahead":"ahead","chapter-help":"help","chapter-evidence":null};
function canOpenFullInsights(){return !!(S.result?.full_detail_sections&&!S.updSnap&&!S.analysisBusy);}
function canLeaveSettingsForFullInsights(){return canOpenFullInsights()&&!S.wiz&&!S.pendingNew&&!S.updateBusy&&!S.sample?.busy;}
function reportCard(id,html){return html?'<div class="g-report-card" id="'+id+'">'+html+'</div>':'';}
function gReportViews(R){return (S.page==="full-insights"&&R?.full_detail_views)||R?.views||[];}
function gReportDatasets(R){return (S.page==="full-insights"&&R?.full_detail_datasets_analyzed)||R?.datasets_analyzed;}
function gHas(R,k){return ((S.page==="full-insights"&&R?.full_detail_sections)||R?.sections||["happened"]).includes(k);}
function gVisibleChapters(){var R=xR(),n=0;return G_CH.filter(function(c){return G_KEY[c[0]]!==null&&gHas(R,G_KEY[c[0]]);}).map(function(c){var t=c.slice();n++;t[1]="Chapter "+n;t[3]=n+". "+c[2];return t;});}
function gSummaryReadout(R,tiles){
  var findings=[],A=R.target_assessment,I=R.insights,F=R.forecast;
  var observed=headlineText(R),destination="chapter-happened",label="Observed results";
  if(A?.status==="published"){
    var assessed=A.periods.filter(p=>p.target_met===true||p.target_met===false);
    var latest=assessed.reduce((last,p)=>!last||p.last_date>last.last_date?p:last,null);
    var breaches=A.periods.filter(function(p){return p.specification.conforms===false;});
    if(!A.overall?.classified&&latest){
      observed=(A.multiple_targets?'Targets changed during the report. ':ML()+' was '+fcValue(R.value)+' overall. ')
        +'Latest assessed target period, '+periodLabel(latest)+'. '
        +fcValue(latest.value)+' '+(latest.gap===0?'was on':latest.target_met?'met':'missed')+' the '+fcValue(latest.target)+' target.';
    }else if(A.overall?.classified&&A.overall.target_met===true&&A.overall.gap===0){
      observed=ML()+' was on target at '+fcValue(R.value)+'.';
    }
    if(breaches.length)observed+=' '+n0(breaches.length)+(breaches.length===1?" period fell":" periods fell")+" outside the applicable specification limits.";
    if(latest||breaches.length){
      destination="g-slide-requirements";label="Performance requirements";
    }
  }
  findings.push([destination,label,observed]);
  if(gHas(R,"ahead")&&F&&F.status==="published"){
    findings.push(["g-slide-projection","Conditional outlook",fcTrajectory(F)+' '+fcCallout(F)]);
  }
  var driver=I?.contact_driver_impact?.adverse?.[0];
  if(gHas(R,"factors")&&gShowsPanel(R,"driver-impact")&&driver){
    findings.push(["g-factor-driver-impact","Contact driver impact",driver.key+' contributed the largest unfavorable volume-weighted gap in the selected contact mix.']);
  }
  var help=I&&gHas(R,"help"),s=help&&gShowsPanel(R,"scenario")&&I.scenario,actions=help?I.cards||[]:[];
  if(s&&!s.blocked&&I.constraints&&(s.total_lift>0||s.target_beyond_modeled_lift)){
    var scenario=s.target_beyond_modeled_lift?'From the full-report baseline of '+fcValue(s.baseline)+', the required adoption rate to meet the '+fcValue(s.target)+' scenario target is more than 100%.'
      :'At '+Math.round(s.adoption*100)+'% of the linked modeled opportunity, the scenario puts '+ml()+' at '+fcValue(s.after)+'.';
    findings.push(["g-slide-scenario","Improvement scenario",scenario]);
  }
  var open=(R.current_actions||[]).filter(a=>a.status==='open'),ranked=help?rankedActionSummary(I):[];
  var current=open.length?'<ul>'+open.slice(0,3).map(a=>'<li>'+esc(a.title+(a.owner?' · '+a.owner:''))+'</li>').join('')+'</ul>'
    :'<p class="muted">'+(Array.isArray(R.current_actions)?'No actions were recorded as open at the report cutoff.':'Current actions registry is unavailable.')+'</p>';
  return '<section class="g-summary-readout g-slide-result" aria-label="Executive summary highlights">'
    +'<div class="g-slide-visual">'+tiles+'<h2>Key findings</h2><ul class="g-summary-findings">'+findings.map(function([target,label,finding]){
      return '<li>'+esc(finding)+' <button type="button" class="g-linkbtn" data-chapter="'+target+'">'+esc(label)+'</button></li>';
    }).join("")+'</ul></div>'
    +'<div class="g-summary-action"><h2>What to review</h2><h3>Recorded open actions</h3>'+current
    +'<h3>Recommended actions</h3>'+(ranked.length?'<ol>'+ranked.map(c=>'<li>'+esc(insActionTitle(c)+' · '+insActionStatus(c))+'</li>').join('')+'</ol>'
      :actions.length?'<p>Eligible reviews are available. No action has a positive, available priority score.</p>':'<p>No eligible recommendations are available.</p>')
    +(actions.length?'<button type="button" class="g-linkbtn" data-chapter="g-slide-actions">Review the action cards</button>':'')
    +(help&&I.external_potential?.priorities?.length?'<p><button type="button" class="g-linkbtn" data-chapter="g-slide-external">See priorities for external involvement</button></p>':'')+'</div>'
    +'</section>';
}
function gInsights(){
  S.xblocks=[];var R=xR();if(!R)return '<h1>Insights</h1>';
  var full=S.page==="full-insights";
  var tools='<div class="g-report-utilities">'+(full?'<button type="button" class="g-linkbtn" id="g-back-insights" data-go="insights">← Back to Insights</button>':'')
    +'</div>';
  if(R.value===null)return '<div class="g-insights-viewport-container">'+tools+withR(R,pageInsights)+'</div>';
  var views=gReportViews(R);
  var scoring=R.metric?.scoring;
  var scale=scoring?.scoring_type==="scale"?' · '+scoring.scale_start+'–'+scoring.scale_end+' scale':'';
  var assessment=R.target_assessment,overall=assessment?.overall;
  var reference=overall?.classified&&Number.isFinite(overall.target)
    ?'Target '+fcValue(overall.target)+' · '+(overall.gap===0?'On target':insDifferenceSize(overall.gap)+' '+(overall.gap>0?'above':'below')+' target')
    :assessment?.multiple_targets?'Target changes during the report period.':'';
  var tiles='<div class="g-kpi-tile"><div class="g-kpi-top"><span class="g-kpi-label">'+esc(ML()+scale)+'</span></div>'
    +'<div class="g-kpi-num">'+esc(fcValue(R.value))+'</div><div class="g-kpi-sub">'+n0(R.count)+' '+esc(gCountLabel(R).toLowerCase())+'</div>'
    +(reference?'<p>'+esc(reference)+'</p>':'')+'</div>';
  var cardDesc={"chapter-happened":views.indexOf("time")!==-1?"Observed daily "+ml()+".":"Observed "+ml()+" and group comparisons.","chapter-ahead":R.forecast&&R.forecast.status==="published"?"The next 13 weeks, if the recent pattern continues.":"No forecast is shown.","chapter-factors":R.insights?"Where "+ml()+" differs, with the evidence.":"Planned analytics · not calculated.","chapter-help":R.insights?"Actions the evidence supports.":"Planned analytics · not calculated.","chapter-evidence":"How each figure was produced."};
  var deck='<div class="g-light-grey-chapter-deck" id="summaryRoadmapDeck"><div class="g-deck-top-label-row"><h2>In this report</h2></div><div class="g-deck-cards-grid">'
   +gVisibleChapters().map(function(c){return '<button type="button" class="g-white-chapter-card" data-chapter="'+c[0]+'"><span class="g-card-ch-title">'+esc(c[2])+'</span><span class="g-card-ch-desc">'+esc(cardDesc[c[0]])+'</span></button>';}).join("")+'</div></div>';
  var h='<div class="g-insights-viewport-container" id="g-report-presentation"><nav id="g-slide-navigation" class="g-slide-nav" aria-label="Slide navigation">'
   +'<button type="button" data-slide-step="-1" aria-label="Previous slide" aria-keyshortcuts="ArrowLeft" hidden>'+gChevron(-1,20)+'</button>'
   +'<button type="button" data-slide-step="1" aria-label="Next slide" aria-keyshortcuts="ArrowRight">'+gChevron(1,20)+'</button></nav>'
   +'<section class="g-slide-frame" id="chapter-summary" aria-labelledby="g-sum-h"'+xb("Executive summary","calc")+'><header class="g-slide-heading">'
   +'<div class="g-report-headline-row"><div class="g-report-headline-block"><h1 id="g-sum-h" tabindex="-1">Executive Summary</h1>'
   +'</div>'+tools+'</div></header>'
   +'<div class="g-slide-content">'+gSummaryReadout(R,tiles)
   +'<p class="g-summary-report-evidence"><button type="button" class="g-linkbtn" data-chapter="chapter-evidence">See supporting evidence</button></p>'
   +'<div class="g-summary-bottom-dock">'+deck+'</div></div></section>'
   +gCh1(R)+(gHas(R,"factors")?gCh3(R):"")+(gHas(R,"ahead")?gCh2(R):"")+(gHas(R,"help")?gCh4(R):"")
   +'<p class="g-evidence-entry"><button type="button" class="btn secondary" data-chapter="chapter-evidence">Go through the details that build this presentation in the Evidence page</button></p></div>'
   +'<div class="g-insights-viewport-container" id="g-report-evidence" hidden><p class="g-evidence-return"><button type="button" class="g-linkbtn" id="g-return-from-evidence">← Back to presentation</button></p>'+gCh5(R)+'</div>';
  return h;
}
var G_SLIDE_NAV_LABELS={
  "g-slide-requirements":"Account requirements","g-slide-score-cutoff":"Score cutoffs",
  "g-slide-daily":"Daily trend","g-slide-stability":"Stability","g-slide-hourly":"Day and hour","g-slide-volume":"Busiest dates",
  "g-slide-group-totals":"Group totals","g-slide-groups":"Group distributions",
  "g-slide-distribution":"Agent distribution","g-slide-agents":"Agent and group heatmap",
  "g-slide-relationships":"Weekly relationships","g-factor-comparisons":"Group vs. rest",
  "g-factor-direct-gaps":"Group-to-group gaps","g-factor-agent-groups":"Agent cohorts",
  "g-factor-period-change":"Work mix and change","g-slide-contact-performance":"Contact type performance",
  "g-factor-driver-impact":"Contact driver impact","g-factor-constraints":"Controllable constraints",
  "g-factor-shortfalls":"Component shortfalls","g-slide-component-movement":"Component changes",
  "g-slide-component-relationships":"Component relationships","g-slide-cart":"Historical profiles",
  "g-slide-projection":"Conditional forecast","g-slide-scenario":"Improvement scenario",
  "g-slide-actions":"Recommended actions","g-slide-external":"External priorities"
};
function gBuildInsightsNav(presentation,previousNav){
  var nav=document.getElementById("g-insights-nav");
  var chapters=new Map(gVisibleChapters().map(c=>[c[0],c[2]]));
  var link=(id,label)=>'<button type="button" class="g-nav-btn" data-chapter="'+esc(id)+'">'+esc(label)+'</button>';
  nav.innerHTML='<li>'+link("chapter-summary","Executive Summary")+'</li>'+
    [...presentation.querySelectorAll(":scope > .g-chapter-article")].map(chapter=>{
      var title=chapters.get(chapter.id),listId="nav-"+chapter.id;
      var questions=[...chapter.querySelectorAll(".g-question-slide")].map(slide=>
        '<li>'+link(slide.id,G_SLIDE_NAV_LABELS[slide.id]||slide.querySelector("h3").textContent)+'</li>').join("");
      if(chapter.id==="chapter-happened"){
        questions+=G_EVIDENCE_DETAILS.filter(([entry])=>document.getElementById(entry)).map(([entry,label])=>
          '<li>'+link(entry,label+' in Evidence')+'</li>').join("");
      }
      var toggle=questions?'<button type="button" class="g-nav-btn g-chapter-toggle" data-chapter-toggle="'+listId
        +'" aria-controls="'+listId+'" aria-expanded="false" aria-label="'+esc(title+' questions')
        +'"><span aria-hidden="true">'+gChevron(1,16)+'</span></button>':'';
      return '<li><div class="g-insights-chapter-row">'+link(chapter.id,title)+toggle+'</div>'
        +(questions?'<ul class="g-insights-questions" id="'+listId+'" hidden>'+questions+'</ul>':'')+'</li>';
    }).join("")+'<li>'+link("chapter-evidence","Evidence")+'</li>';
  nav.hidden=false;
  nav.activeChapter=previousNav?.activeChapter;
  var open=previousNav?.querySelector('[data-chapter-toggle][aria-expanded="true"]')?.dataset.chapterToggle;
  var toggle=open&&nav.querySelector('[data-chapter-toggle="'+open+'"]');
  if(toggle)gSetChapterExpanded(toggle,true);
}
function gSetChapterExpanded(toggle,expanded){
  if(expanded){
    var open=toggle.closest("#g-insights-nav").querySelector('[data-chapter-toggle][aria-expanded="true"]');
    if(open&&open!==toggle)gSetChapterExpanded(open,false);
  }
  var list=document.getElementById(toggle.dataset.chapterToggle);
  if(!expanded&&list.contains(document.activeElement))toggle.focus({preventScroll:true});
  toggle.setAttribute("aria-expanded",String(expanded));
  list.hidden=!expanded;
}
function gMarkInsightsNav(id){
  var nav=document.getElementById("g-insights-nav");
  var link=nav?.querySelector('[data-chapter="'+id+'"]');
  if(!link)return;
  var current=nav.querySelector('[aria-current="location"]');
  if(current!==link){
    current?.removeAttribute("aria-current");
    link.setAttribute("aria-current","location");
  }
  var chapter=link.closest(".g-insights-questions")?.parentElement||link.closest("li");
  var chapterId=chapter.querySelector("[data-chapter]").dataset.chapter;
  if(nav.activeChapter!==chapterId){
    nav.activeChapter=chapterId;
    var open=nav.querySelector('[data-chapter-toggle][aria-expanded="true"]');
    var toggle=chapter.querySelector("[data-chapter-toggle]");
    if(toggle)gSetChapterExpanded(toggle,true);
    else if(open)gSetChapterExpanded(open,false);
  }
}
function gMeasureReportTopbar(presentation){
  var topbar=document.getElementById("topbar");
  var height=topbar.offsetHeight+"px",report=presentation.parentElement;
  if(report.style.getPropertyValue("--report-topbar")!==height)report.style.setProperty("--report-topbar",height);
  return topbar;
}
function gNav(){
  var presentation=document.getElementById("g-report-presentation");
  if(!presentation)return;
  var topbar=gMeasureReportTopbar(presentation);
  if(presentation.hidden){gMarkInsightsNav("chapter-evidence");return;}
  if(S.modal?.card?.classList.contains('g-daily-aht'))return;
  var slide=presentation.querySelector(".g-slide-frame");
  var clearance=slide?parseFloat(getComputedStyle(slide).scrollMarginTop)||0:0;
  var dock=topbar.getBoundingClientRect().top+clearance*(slide?.currentCSSZoom||1);
  var atEnd=(window.innerHeight+window.scrollY)>=document.documentElement.scrollHeight-4;
  gUpdateSlideNavigation(presentation,dock,atEnd);
  if(!S.modal)gCloseGuideOutsideView(dock);
}
function gUpdateSlideNavigation(presentation,dock,atEnd){
  var nav=presentation.querySelector("#g-slide-navigation");
  var slides=[...presentation.querySelectorAll(".g-slide-frame")];
  var boundary=dock+1; // Allow fractional pixels at the scroll destination.
  var active=0;
  for(var i=1;i<slides.length;i++){
    if(slides[i].getBoundingClientRect().top>boundary)break;
    active=i;
  }
  if(atEnd)active=slides.length-1;
  var current=slides[active].id;
  for(var chapter of presentation.querySelectorAll(":scope > .g-chapter-article")){
    var first=chapter.querySelector(".g-question-slide");
    var rect=chapter.getBoundingClientRect();
    if(rect.top<=boundary&&rect.bottom>boundary&&(!first||first.getBoundingClientRect().top>boundary))
      current=chapter.id;
  }
  gMarkInsightsNav(current);
  var previous=nav.firstElementChild,next=nav.lastElementChild;
  previous.hidden=active===0;
  previous.dataset.chapter=slides[active-1]?.id||"chapter-summary";
  previous.setAttribute("aria-label",active>1?"Previous slide":"Back to executive summary");
  next.dataset.chapter=slides[active+1]?.id||"chapter-evidence";
  next.setAttribute("aria-label",slides[active+1]?"Next slide":"Open Evidence");
}
function gReturnFromEvidence(){
  var page=document.getElementById("g-report-evidence"),presentation=document.getElementById("g-report-presentation");
  if(!page||!presentation)return;
  var origin=page.reportOrigin;
  page.previewObserver?.disconnect();
  page.hidden=true;
  presentation.hidden=false;
  sizeChartTables();
  window.scrollTo({top:origin?.top||0,behavior:"instant"});
  var nav=document.getElementById("g-insights-nav");
  nav.activeChapter=origin?.activeChapter;
  var toggle=origin?.openChapter&&nav.querySelector('[data-chapter-toggle="'+origin.openChapter+'"]');
  if(toggle)gSetChapterExpanded(toggle,true);
  else{
    var open=nav.querySelector('[data-chapter-toggle][aria-expanded="true"]');
    if(open)gSetChapterExpanded(open,false);
  }
  gNav();
  if(origin)nav.closest("nav").scrollTop=origin.sidebarScroll;
  (origin?.trigger?.isConnected?origin.trigger:document.getElementById("g-sum-h")).focus({preventScroll:true});
}
function gGoChapter(id,trigger){
  var el=document.getElementById(id);if(!el)return;var rm=window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if(el.closest("#g-report-presentation")?.hidden)gReturnFromEvidence();
  var evidence=el.closest("#g-report-evidence");
  if(evidence?.hidden){
    var presentation=document.getElementById("g-report-presentation");
    var nav=document.getElementById("g-insights-nav");
    evidence.reportOrigin={
      top:window.scrollY,trigger:trigger||document.activeElement,activeChapter:nav.activeChapter,
      sidebarScroll:nav.closest("nav").scrollTop,
      openChapter:nav.querySelector('[data-chapter-toggle][aria-expanded="true"]')?.dataset.chapterToggle
    };
    evidence.querySelector('#g-return-from-evidence').textContent=
      el.closest('#g-trend-evidence')&&xR()?.metric?.metric_id==="aht"?'← Return to Daily trend':'← Back to presentation';
    var guide=presentation.querySelector(".g-guide.is-open");
    if(guide){
      var originRect=evidence.reportOrigin.trigger?.getBoundingClientRect();
      gSetGuide(guide,false);
      if(originRect)evidence.reportOrigin.top+=evidence.reportOrigin.trigger.getBoundingClientRect().top-originRect.top;
    }
    gPrepareEvidence(evidence,presentation);
    gMeasureReportTopbar(presentation);
    presentation.hidden=true;
    evidence.hidden=false;
    gShowEvidencePreviews(evidence);
  }
  for(var parent=el;parent&&parent!==main;parent=parent.parentElement){if(parent.tagName==="DETAILS")parent.open=true;}
  var presentation=el.closest("#g-report-presentation");
  if(presentation){
    gMeasureReportTopbar(presentation);
    var slide=el.closest(".g-question-slide");
    if(slide)slide.style.setProperty("--report-heading-height",slide.querySelector(".g-slide-heading").offsetHeight+"px");
  }
  var behavior=rm||trigger?.dataset.slideStep||trigger?.closest("#g-insights-nav")?"instant":"smooth";
  if(id==="chapter-summary")window.scrollTo({top:0,behavior:behavior});
  else el.scrollIntoView({behavior:behavior,block:"start"});
  var hd=el.matches("h1,h2,h3,h4")?el:el.querySelector("h1,h2,h3,h4")||el;if(!hd.hasAttribute("tabindex"))hd.setAttribute("tabindex","-1");hd.focus({preventScroll:true});
  gNav();
}
function positionChartFilter(){
  if(!chartFilter)return;
  var anchor=chartFilter.trigger.getBoundingClientRect();
  if(!chartFilter.trigger.checkVisibility()||anchor.bottom<=0||anchor.top>=window.innerHeight){closeChartFilter();return;}
  positionChartPopover(chartFilter.panel,chartFilter.trigger);
}
window.addEventListener("scroll",gNav,{passive:true});
document.addEventListener("scroll",positionChartFilter,{capture:true,passive:true});
window.addEventListener("resize",function(){gNav();sizeChartTables();positionChartFilter();});
document.addEventListener("keydown",function(e){
  if(e.key==="Escape"&&chartFilter){e.preventDefault();closeChartFilter(true);return;}
  if(!S.modal&&!e.altKey&&!e.ctrlKey&&!e.metaKey&&!e.shiftKey&&e.target.matches?.("#g-sum-h,.g-slide-question")){
    var step={ArrowLeft:-1,ArrowRight:1}[e.key];
    var arrow=step&&document.querySelector('#g-slide-navigation [data-slide-step="'+step+'"]');
    if(arrow&&!arrow.hidden){e.preventDefault();arrow.click();return;}
  }
  if(e.key==="Escape"&&!S.modal){
    var guide=document.querySelector("#g-report-presentation .g-guide.is-open");
    if(guide){e.preventDefault();gSetGuide(guide,false,true);}
  }
});
/* ---- Settings dialog: tabs, accessibility, update analysis ---- */
var G_TABS=[["wizard","Session configuration"],["guides","Dataset Templates"],["sample","Inject sample configuration, data, and scope"]];
var G_TITLES={"dataset-loaded":"Dataset loaded","optional-dataset":"Dataset upload and details",dataset:"Dataset upload and details",wizard:"Session configuration",update:"Update analysis",json:"Continue from a configuration file",file:"Continue from a File",guides:"Dataset Templates",datasum:"Data analyzed",sample:"Inject sample configuration, data, and scope",export:"Export presentation"};
function gTemplateCard(template){
  var id=template.id,columns=template.columns,scroll=columns.length>7;
  var choices=template.needs_one_of;
  var note=choices.length?'<p id="template-note-'+id+'">Provide at least one '+(choices.length===2&&choices.every(group=>group.length===1)?'of these columns':'complete group')+': '+choices.map(group=>group.map(name=>'<code>'+esc(name)+'</code>').join(' and ')).join(' or ')+'.</p>':'';
  var rows=columns.map(column=>'<tr><th scope="row"><code>'+esc(column.name)+'</code></th><td>'+(column.optional?'Optional':'<strong>Required</strong>')
    +'</td><td><strong class="muted">'+esc(column.type)+'.</strong> '+esc(column.meaning)+'</td><td><code>'+esc(column.example)+'</code></td></tr>').join('');
  return '<details class="g-settings-template" name="athena-dataset-templates" data-template="'+id+'"><summary aria-labelledby="template-label-'+id+'">'
    +'<span class="g-settings-template-badge" aria-hidden="true">'+dsNum(id)+'</span><span class="g-settings-template-label"><strong id="template-label-'+id+'">'+esc(template.label)+'</strong><span class="muted">'+esc(template.description)+'</span></span>'
    +'<svg class="g-settings-template-chevron" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m4 6 4 4 4-4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></summary>'
    +'<div class="g-settings-template-body"><div class="g-settings-template-tools">'+(note||scroll?'<div class="muted">'+note+(scroll?'<p>'+columns.length+' fields · Scroll for more</p>':'')+'</div>':'')
    +'<a class="btn secondary" href="'+esc(template.template)+'" download aria-label="Download '+esc(template.label)+' CSV template">Download CSV template</a></div>'
    +'<div class="g-settings-template-table"'+(scroll?' tabindex="0" role="region" aria-label="'+esc(template.label)+' fields"':'')+'><table aria-labelledby="template-label-'+id+'"'+(note?' aria-describedby="template-note-'+id+'"':'')+'>'
    +'<colgroup><col><col><col><col></colgroup><thead><tr><th scope="col">Column header</th><th scope="col">Status</th><th scope="col">Description</th><th scope="col">Acceptable example</th></tr></thead><tbody>'+rows+'</tbody></table></div></div></details>';
}
function gGuidesTab(){return '<div class="g-settings-templates">'+S.cfg.guides.settings_templates.map(gTemplateCard).join('')+'</div>';}
/* ---- Sample injector (testing only): fills the setup, every sample dataset and the analysis scope. ---- */
function gSampleTab(){var T=S.sample||{};
  return '<div class="g-sample-note single-form"><strong>Inject sample configuration, data, and scope</strong><p>For testing only. Fills the account setup, the sample datasets and the analysis choices from the sample folder. Everything it adds is synthetic. It stops before the analysis runs.</p>'
   +(T.error?'<p class="notice" role="alert">'+esc(T.error)+'</p>':'')
   +'<label class="g-sample-set field"><span class="f">Sample set</span><select id="sample-set"'+(T.busy?' disabled':'')+'><option value="happy"'+((S.sampleSet||'happy')==='happy'?' selected':'')+'>Happy set: clean scenarios</option><option value="stress"'+(S.sampleSet==='stress'?' selected':'')+'>Stress set: data-quality and coverage scenarios</option></select></label>'
   +(T.confirm?'<p class="notice info" role="alert">This replaces your current setup and data in this session.</p><div class="actions"><button type="button" class="btn" id="sample-go">Replace and inject</button><button type="button" class="btn secondary" id="sample-cancel">Cancel</button></div>'
     :'<div class="actions"><button type="button" class="btn" id="sample-run"'+(T.busy?' disabled':'')+'>Inject sample configuration, data, and scope</button></div>')
   +(T.busy?'<p role="status">'+esc(T.step)+'</p>':'')+'</div>';}
async function injectSample(){
  var T=S.sample={busy:true,step:'Reading the sample setup…'},say=function(t){T.step=t;if(S.modal&&S.modal.tab==='sample')render();};
  try{
    var set=S.sampleSet==='stress'?'stress':'happy',r=await fetch('/api/sample?set='+set);if(!r.ok)throw Error('The sample setup could not be read.');
    var plan=await r.json(),setup=plan.setup,names=[setup.primary.file].concat(Object.values(setup.optional)),miss=names.filter(function(n){return plan.available.indexOf(n)<0;});
    if(miss.length)throw Error('These sample files were not found: '+miss.join(', ')+'. Check the sample folder.');
    var get=async function(n){var x=await fetch('/api/sample/file/'+encodeURIComponent(n)+'?set='+set);if(!x.ok)throw Error('Could not read '+n+'.');return new File([await x.blob()],n,{type:'text/csv'});};
    say('Starting a fresh session…');await endSession();S.sample=T;S.modal={tab:'sample',from:null};
    say('Setting up the account…');
    var A=setup.account,m=blankModel();m.acc={id:A.id,tz:A.timezone,covFrom:A.coverage_start||'',covLast:A.coverage_last||''};m.profile=wJ(setup.profile);openWizard(m,4);S.modal={tab:'sample',from:null};
    var v=await wizValidate();if(!(v&&v.ok))throw Error(Object.values(S.wiz.errors||{})[0]||'The sample account was not accepted.');
    wizUse();S.modal={tab:'sample',from:null};if(!S.bq)S.bq=S.cfg.business_questions[0].id;
    say('Loading '+setup.primary.module+' (the largest file, this can take a few seconds)…');S.grain=setup.primary.grain;
    await upload(await get(setup.primary.file));S.modal={tab:'sample',from:null};
    if(!(S.upload&&S.upload.ok))throw Error('The primary sample file was not accepted.'+(S.failed?' '+S.failed:''));
    var ids=Object.keys(setup.optional);
    for(var i=0;i<ids.length;i++){say('Loading '+ids[i]+'…');await uploadOptional(ids[i],await get(setup.optional[ids[i]]));S.modal={tab:'sample',from:null};
      var slot=optionalSlot(ids[i]);if(!(slot&&slot.upload&&slot.upload.ok))throw Error(ids[i]+' was not accepted.'+(slot&&slot.error?' '+slot.error:''));}
    say('Choosing the analysis scope…');
    var qs=function(id){return ((S.plan&&S.plan.questions)||[]).find(function(q){return q.id===id;});};
    var ok=function(q){return q.options.filter(function(o){return !o.availability||o.availability==='available';}).map(function(o){return o.id;});};
    await setAnswer('goal',ok(qs('goal')));
    var period=qs('scope_period');if(period&&period.bounds&&period.bounds.min)await setAnswer('scope_period',{start:period.bounds.min,end:period.bounds.max});
    if(qs('scope_lines_of_business'))await setAnswer('scope_lines_of_business',qs('scope_lines_of_business').options.map(function(o){return o.id;}));
    if(qs('scope_contact_types'))await setAnswer('scope_contact_types',qs('scope_contact_types').options.map(function(o){return o.id;}));
    if(qs('group_dimension'))await setAnswer('group_dimension','line_of_business');
    var t=setup.targets;S.analysisSetup={metric_id:'aht',direction:t.direction,periods:t.periods.map(function(p){return {effective_start:p.start,effective_end:nextDay(p.last),target:p.target,lower_specification_limit:t.lower_specification_limit,upper_specification_limit:t.upper_specification_limit};})};
    S.cockpitChosen=true;invalidateResult();await replan();
    gDismissSettings(()=>{S.sample=null;go('cockpit');});
  }catch(e){S.sample={error:String(e&&e.message||e)};if(!S.modal)S.modal={tab:'sample',from:null};render();}
}
function stagedConfigHtml(){
  if(!S.staged)return '';
  return '<div class="panel"><h2>Review before applying</h2>'+cfgSummaryDl(S.staged.summary)+targetsTable(S.staged.summary.targets)
    +(S.staged.warnings||[]).map(function(w){return '<p class="muted">'+esc(w.text)+(w.from?' ('+esc(w.from)+' to '+esc(dayBefore(w.to)||w.to)+')':'')+'</p>';}).join('')
    +(S.staged.changes&&S.staged.changes.length?'<strong>What changes</strong><ul class="plain">'+S.staged.changes.map(function(c){return '<li>'+esc(c)+'</li>';}).join('')+'</ul>':'')
    +'<div class="actions"><button class="btn" id="cfg-use" type="button">Apply configuration</button><button class="btn secondary" id="w-edit-staged" type="button">Edit in the guided form</button><button class="btn secondary" id="cfg-discard" type="button">Discard</button></div></div>';
}

function gModal(){
  if(S.modal.chartMode)return chartDialogHtml(S.modal);
  var tab=S.modal.tab,body,exporting=tab==="export",fileOptions=tab==="file",settings=['wizard','guides','sample','file'].includes(tab);
  if(tab==="dataset-loaded")body=datasetLoadedDialog();else if(tab==="optional-dataset")body=optionalDatasetDialog();else if(tab==="dataset")body=datasetDialog();else if(tab==="wizard")body=S.cfg.configuration_storage==="session"?(S.wiz?wizardHtml():configLandingHtml(true)):legacyConfigHtml();
  else if(tab==="json")body=configLandingHtml();else if(tab==="guides")body=gGuidesTab();else if(tab==="sample")body=gSampleTab();
  else if(fileOptions)body=(S.cfgIssues&&S.cfgIssues.length?cfgIssuesHtml(S.cfgIssues):'')+stagedConfigHtml()
    +'<div class="actions"><button type="button" class="btn" id="g-import-config">Import a configuration</button><input id="acctfile" type="file" accept=".json,application/json" hidden><a class="btn secondary" href="/api/account-template" download="session_configuration_template.json">Download configuration template</a></div>';
  else if(exporting)body='<p id="g-export-availability">Coming soon</p><div class="g-export-formats"><button type="button" class="btn secondary" disabled>Export to standalone HTML</button><button type="button" class="btn secondary" disabled>Export to PowerPoint file</button></div>';
  else body=dataSummaryHtml();
  var loaded=tab==='dataset-loaded',dsv=(tab==='dataset'||tab==='optional-dataset')?dsView(tab):null,dataset=!!dsv||loaded||tab==='datasum',form=tab==='wizard'&&!!S.wiz&&S.cfg.configuration_storage==='session';
  var rail=dataset||exporting||fileOptions?'':'<nav class="g-modal-sidebar" aria-label="Settings sections"><div><h2>Settings</h2>'
   +G_TABS.map(function(x){var locked=(S.updateBusy||(S.sample&&S.sample.busy))&&x[0]!==tab;return '<button type="button" class="g-modal-tab-btn'+(x[0]===tab?' g-active':'')+'" data-mtab="'+x[0]+'"'+(x[0]===tab?' aria-current="true"':'')+(locked?' disabled aria-disabled="true"':'')+'>'+esc(x[1])+'</button>';}).join("")
   +'<div class="g-settings-report-action"><button type="button" class="g-modal-tab-btn" id="g-full-detail"'+(canLeaveSettingsForFullInsights()?'':' disabled aria-describedby="g-full-detail-note"')+'>Full-detail Insights</button>'
   +(canLeaveSettingsForFullInsights()?'':'<p class="g-settings-action-note" id="g-full-detail-note">'+(canOpenFullInsights()?'Finish editing to open the full report.':'Run an analysis to open the full report.')+'</p>')
   +'</div></div></nav>';
  return {
    className:'g-settings-modal'+(settings?' g-settings-workflow':'')+(dsv?' g-dataset-modal':'')+(loaded?' g-loaded-modal':'')+(tab==='datasum'?' g-sum-modal':'')+(form?' g-form-modal':'')+(exporting?' g-export-modal':'')+(fileOptions?' g-file-modal':''),
    description:exporting?'g-export-availability':null,
    html:rail+'<div class="g-modal-body-wrap">'+(dsv?dsHeader(dsv):'<div class="g-modal-header-bar">' +'<h3 id="g-modal-h" tabindex="-1">'+esc(G_TITLES[tab])+'</h3><button class="g-modal-close-icon" id="g-modal-close" type="button" aria-label="'+(loaded||exporting?'Close':tab==='datasum'?'Close data summary':dataset?'Close dataset details':'Close settings')+'">×</button></div>')+(form?'<nav class="profile-jumpbar" aria-label="Configuration sections">'+[['profile-account','1. Account & coverage'],['profile-business','2. Business & schedule'],['profile-delivery','3. Delivery & support']].map(v=>'<button type="button" data-profile-jump="'+v[0]+'">'+v[1]+'</button>').join('')+'</nav>':'')+'<div class="g-modal-scroll-pane">'+body+'</div>'+(dsv?dsFooter(dsv):'')+(form?'<div class="profile-actions"><button type="button" class="btn secondary" id="w-cancel">Close without applying</button><button type="button" class="btn" id="w-close">Save and close</button></div>':'')+'</div>'
  };
}
function datasetLoadedDialog(){var u=S.upload&&S.upload.ok?S.upload:null;if(!u)return '<p>This dataset is no longer loaded.</p>';
  return '<p><strong>'+esc(u.summary.file)+'</strong> is loaded as your primary dataset.</p><p class="muted">'+n0(u.summary.rows)+' rows. No analysis has run yet. Add optional datasets first, or continue to choose what to analyse.</p><div class="loaded-actions"><button type="button" class="btn secondary" id="dl-add">Add datasets</button><button type="button" class="btn" id="dl-continue">Continue to Analysis Cockpit</button></div>';}
function workspaceFocus(id,block='nearest'){var el=document.getElementById(id)||document.querySelector('.g-workspace-header h1');if(!el)return;if(!el.hasAttribute('tabindex'))el.setAttribute('tabindex','-1');el.focus({preventScroll:true});el.scrollIntoView({block:block});}
function primaryCardId(){return S.upload&&S.upload.ok?'dataset-'+(S.upload.grain==='contact'?'D01':'D02'):null;}
function gOpenSettings(tab,opener){
  var a=opener||document.activeElement;
  var origin=tab==="export"&&opener?opener.getBoundingClientRect():null;
  closeDrawer();
  if(!tab)tab="wizard";if(tab==="json")tab="wizard";
  S.modal={tab:tab,from:a&&a.id?a.id:null};if(tab==="update"){S.updateFailed=null;S.updateBusy=false;if(!S.updSnap)S.updSnap={answers:JSON.parse(JSON.stringify(S.answers||{})),analysisSetup:S.analysisSetup?wJ(S.analysisSetup):null,displayUnit:S.displayUnit,cockpitChosen:!!S.cockpitChosen,analysisMapping:S.analysisMapping?wJ(S.analysisMapping):null,plan:S.plan,result:S.result,confirmed:S.confirmed};}
  S.modalFresh=true;render();
  if(origin)animateModalOpening(origin);
}
function animateModalOpening(origin){
  var dialog=document.getElementById("g-dialog");
  if(!dialog?.animate||window.matchMedia("(prefers-reduced-motion: reduce)").matches||!origin.width||!origin.height)return;
  var final=dialog.getBoundingClientRect();
  if(!final.width||!final.height)return;
  var surface=document.createElement("div");
  surface.id="g-modal-motion";
  surface.className="g-modal-motion";
  surface.setAttribute("aria-hidden","true");
  Object.assign(surface.style,{left:final.left+"px",top:final.top+"px",width:final.width+"px",height:final.height+"px"});
  dialog.parentElement.append(surface);
  var dx=origin.left+origin.width/2-final.left-final.width/2;
  var dy=origin.top+origin.height/2-final.top-final.height/2;
  var opening=surface.animate([
    {transform:"translate("+dx+"px,"+dy+"px) scale("+origin.width/final.width+","+origin.height/final.height+")",borderRadius:"36px",opacity:1},
    {transform:"scale(1.015)",borderRadius:"14px",opacity:1,offset:.76},
    {transform:"scale(1)",borderRadius:"14px",opacity:0}
  ],{duration:300,easing:"cubic-bezier(.2,.8,.2,1)"});
  opening.finished.then(()=>surface.remove(),()=>surface.remove());
  dialog.animate([{opacity:0},{opacity:0,offset:.62},{opacity:1}],{duration:300});
}
function gCloseSettings(){
  if(!S.modal||S.sample?.busy)return;
  gDismissSettings(gFinishCloseSettings);
}
function gDismissSettings(finish){
  var state=S.modal,dialog=document.getElementById("g-dialog"),scrim=dialog?.parentElement;
  if(state?.closing)return;
  if(!dialog?.classList.contains("g-settings-workflow")||matchMedia("(prefers-reduced-motion: reduce)").matches){finish();return;}
  var panel=getComputedStyle(dialog);
  dialog.style.setProperty("--settings-close-opacity",panel.opacity);
  dialog.style.setProperty("--settings-close-transform",panel.transform);
  scrim.style.setProperty("--settings-scrim-opacity",getComputedStyle(scrim,"::before").opacity);
  state.closing=true;scrim.classList.add("g-settings-closing");
  var exit=dialog.getAnimations().find(animation=>animation.animationName==="g-settings-close");
  var complete=function(){if(S.modal===state){state.closing=false;finish();}};
  if(exit)exit.finished.then(complete,complete);else complete();
}
function gFinishCloseSettings(){
  if(S.modal?.chartMode){closeChartDialog();return;}
  if(S.modal?.tab==="export"){
    var opener=S.modal.from;
    S.modal=null;
    render();
    (document.getElementById(opener)||main).focus({preventScroll:true});
    return;
  }
  if(S.pendingNew){closeNewDraft();return;}var loadedClose=!!(S.modal&&S.modal.tab==='dataset-loaded');if(S.modal&&S.modal.tab==='dataset'){uploadGeneration++;S.busy=false;}if(S.modal&&S.modal.tab==='optional-dataset'){var optionalClosing=optionalSlot(S.optionalEditing);optionalClosing.generation++;optionalClosing.busy=false;}
  var from=S.modal&&S.modal.from;S.workflowStart=false;
  if(S.wiz){wizardGeneration++;saveWiz();S.wiz=null;try{var raw=sessionStorage.getItem(WKEY);if(raw)S.wizDraft=JSON.parse(raw);}catch(e){}}
  var sn=S.updSnap;S.updSnap=null;S.modal=null;S.updateFailed=null;S.updateBusy=false;updateGeneration++;configStageGeneration++;
  if(sn){planGeneration++;S.answers=sn.answers;S.analysisSetup=sn.analysisSetup;S.displayUnit=sn.displayUnit||'seconds';S.cockpitChosen=sn.cockpitChosen;S.analysisMapping=sn.analysisMapping;S.mappingIssues=null;S.plan=sn.plan;S.result=sn.result;S.confirmed=sn.confirmed;}
  render();
  var el=from?document.getElementById(from):null;(el&&!el.disabled?el:main).focus({preventScroll:true});
  if(loadedClose&&S.page==='data')workspaceFocus(primaryCardId());
}
var gScrimPointer=null;
document.addEventListener("pointerdown",function(e){gScrimPointer=e.button===0&&e.target.id==="g-scrim"?e.pointerId:null;});
document.addEventListener("pointercancel",function(){gScrimPointer=null;});
for(const eventType of ["click","keydown","input","change"]){
  document.addEventListener(eventType,function(e){
    if(S.modal?.closing&&e.target.closest?.("#g-scrim")){e.preventDefault();e.stopImmediatePropagation();}
  },true);
}
document.addEventListener("click",function(e){
  if(chartFilter&&!chartFilter.panel.contains(e.target)&&!chartFilter.trigger.contains(e.target))closeChartFilter();
  var openGuide=document.querySelector(".g-guide.is-open");
  if(openGuide&&!openGuide.contains(e.target))gSetGuide(openGuide,false);
  var backdropClick=e.target.id==="g-scrim"&&e.pointerId===gScrimPointer;gScrimPointer=null;
  if(backdropClick&&S.modal){gCloseSettings();return;}
  var t=e.target.closest("button");if(!t)return;
  var id=t.id;
  if(t.dataset.guidePage!==undefined){
    var owner=t.closest(".g-guide"),forward=t.getAttribute("aria-label")==="Next guide";
    owner.dataset.page=t.dataset.guidePage;
    gRenderGuide(owner,owner.closest(".g-question-slide"));
    positionChartPopover(owner.lastElementChild,owner.firstElementChild,true);
    (forward?owner.lastElementChild.querySelector(".g-guide-pages button:last-child"):owner.lastElementChild.querySelector(".g-guide-pages button")).focus({preventScroll:true});
    return;
  }
  if(t.dataset.relationshipStep){
    if(t.getAttribute('aria-disabled')==='true')return;
    var choice=t.closest('[data-chart-selection]').querySelector('select');
    var option=choice.options[choice.selectedIndex+Number(t.dataset.relationshipStep)];
    if(option){
      choice.value=option.value;
      choice.dispatchEvent(new Event('change',{bubbles:true}));
      t.focus({preventScroll:true});
    }
    return;
  }
  if(t.dataset.chartView){
    var result=xR(),chart=REPORT_CHART_CONTROLS[t.dataset.chartView],state=observedState(result);
    state[chart.view]=reportViews(t.dataset.chartView,state).next[0];
    redrawObservedChart(chart.id,chart.render(result));
    return;
  }
  if(t.hasAttribute("data-guide-toggle")){
    var guide=t.parentElement,open=t.getAttribute("aria-expanded")!=="true";
    var other=document.querySelector("#g-report-presentation .g-guide.is-open");
    if(other&&other!==guide)gSetGuide(other,false);
    gSetGuide(guide,open,true);return;
  }
  if(t.dataset.chartExplore||t.dataset.chartExpand){openChartDialog(t);return;}
  if(id==="g-trend-cancel"||t.hasAttribute("data-close-daily-explore")){closeChartFilter(true);return;}
  if(t.dataset.chapter&&S.modal?.chartMode==="focus"){
    var expandedFrom=S.modal.from;
    closeChartDialog();
    gGoChapter(t.dataset.chapter,document.getElementById(expandedFrom)||t);
    return;
  }
  if(id==="g-export-presentation"){gOpenSettings("export",t);return;}
  if(id==="g-full-detail"){if(canLeaveSettingsForFullInsights())gDismissSettings(()=>go("full-insights"));return;}
  if(id==="s-datasum"){gOpenSettings("datasum");return;}
  if(id==="sample-run"){if(S.sample&&S.sample.busy)return;if(S.config||S.upload){S.sample={confirm:true};render();}else injectSample();return;}
  if(id==="sample-go"){if(!(S.sample&&S.sample.busy))injectSample();return;}
  if(id==="sample-cancel"){S.sample=null;render();return;}
  if(id==="h-file"){gOpenSettings(S.cfg.configuration_storage==="session"?"file":"wizard",t);return;}
  if(id==="g-import-config"){document.getElementById("acctfile").click();return;}
  if(id==="s-settings"||id==="g-edit-cfg"||id==="h-config"){
    gOpenSettings("wizard");return;
  }
  if(id==="g-config-next"){S.workflowStart=false;S.modal=null;S.cockpit=false;S.page="data";if(!S.bq)S.bq=S.cfg.business_questions[0].id;replan();return;}
  if(id==="mapping-add"){if(S.updateBusy)return;var v=wJ(S.analysisMapping[S.analysisMapping.length-1]);delete v.target;delete v.target_rule;delete v.lower_specification_limit;delete v.upper_specification_limit;S.analysisMapping.push(v);invalidateResult();S.mappingIssues="Review the new target period.";replan();return;}
  if(t.dataset.mappingRemove!==undefined){if(S.updateBusy)return;S.analysisMapping.splice(+t.dataset.mappingRemove,1);invalidateResult();replan();return;}
  if(id==="g-modal-close"||id==="dataset-done"){gCloseSettings();return;}
  if(id==="dataset-replace"){var fi=document.getElementById("file");if(fi)fi.click();return;}
  if(id==="dl-continue"||id==="g-open-ck"){go("cockpit");return;}
  if(id==="dl-add"){S.modal=null;render();workspaceFocus("optional-tier-h","center");return;}
  if(t.dataset.mtab&&S.modal){if(S.updateBusy&&t.dataset.mtab!==S.modal.tab)return;S.modal.tab=t.dataset.mtab;if(t.dataset.mtab==="update"){S.updateFailed=null;S.updateBusy=false;if(!S.updSnap)S.updSnap={answers:JSON.parse(JSON.stringify(S.answers||{})),analysisSetup:S.analysisSetup?wJ(S.analysisSetup):null,displayUnit:S.displayUnit,cockpitChosen:!!S.cockpitChosen,analysisMapping:S.analysisMapping?wJ(S.analysisMapping):null,plan:S.plan,result:S.result,confirmed:S.confirmed};}S.modalFresh=true;render();return;}
  if(id==="g-ck-cancel"||id==="g-ck-cancel2"){S.cockpit=false;go("data");return;}
  if(id==="g-ck-go"){S.cockpit=false;go("data");return;}
  if(id==="g-upd-start"){updateGeneration++;S.modal=null;S.updSnap=null;S.updateFailed=null;S.updateBusy=false;gStartAnalysis();return;}
  if(id==="g-upd-cancel"){if(!S.modal)cancelModification();else gCloseSettings();return;}
  if(t.dataset.grain||t.dataset.datasetDetails){S.grain=t.dataset.grain||t.dataset.datasetDetails;S.datasetExpanded=false;gOpenSettings("dataset");return;}
  if((id==='workspace-edit-setup'||id==='workspace-back-config')&&S.config){gOpenSettings('wizard');if(S.wizDraft)resumeWizard();else openWizard(modelFromConfig(S.config),1);return;}
  if(t.dataset.modify){beginModification(t.dataset.modify);return;}
  if(id==="w-cancel"){gCloseSettings();return;}
  if(id==="dataset-more"){S.datasetExpanded=!S.datasetExpanded;render();return;}
  if(id==="dataset-remove"){S.updSnap=null;updateGeneration++;abandonUpload();invalidateResult();S.plan=null;S.modal=null;S.cockpit=false;S.page="data";render();return;}
  if(t.dataset.metricRelationship){selectMetricRelationship(xR(),t.dataset.metricRelationship);return;}
  if(t.dataset.chapterToggle){
    gSetChapterExpanded(t,t.getAttribute("aria-expanded")!=="true");
    return;
  }
  if(id==="g-return-from-evidence"){gReturnFromEvidence();return;}
  if(t.dataset.evidenceSlide){
    var origin=document.getElementById("g-report-evidence").reportOrigin;
    if(origin?.trigger?.closest(".g-question-slide")?.id===t.dataset.evidenceSlide)gReturnFromEvidence();
    else gGoChapter(t.dataset.evidenceSlide,t);
    return;
  }
  if(t.dataset.chapter){gGoChapter(t.dataset.chapter,t);return;}
});
document.addEventListener("keydown",function(e){
  var pop=document.getElementById("w-tzpop");
  if(e.key==="Escape"){if(e.defaultPrevented||(pop&&!pop.hidden))return;if(S.modal){e.preventDefault();gCloseSettings();return;}if(!drawer.hidden)xCloseDrawer();return;}
  if(e.key==="Tab"&&S.modal){
    var d=document.getElementById("g-dialog");if(!d)return;
    var f=[].slice.call(d.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),summary,[tabindex]:not([tabindex="-1"])')).filter(function(x){return x.checkVisibility?x.checkVisibility():x.getClientRects().length>0;});
    if(!f.length)return;var first=f[0],last=f[f.length-1],cur=document.activeElement;
    if(!d.contains(cur)){e.preventDefault();first.focus();}
    else if(e.shiftKey&&(cur===first||cur.id==="g-modal-h")){e.preventDefault();last.focus();}
    else if(!e.shiftKey&&cur===last){e.preventDefault();first.focus();}
  }
});
function renderModal(){
  var scrim=document.getElementById('g-scrim');
  if(!S.modal){if(scrim)scrim.remove();return;}
  if(S.modal.closing&&scrim?.modalState===S.modal)return;
  if(!scrim){
    scrim=document.createElement('div');
    scrim.id='g-scrim';scrim.className='g-modal-scrim';
    main.append(scrim);
  }
  // Keep the opening animation through renders of the same dialog.
  var dialog=scrim.firstElementChild;
  if(scrim.modalState!==S.modal){
    scrim.classList.remove("g-settings-closing");
    dialog=document.createElement('div');
    dialog.id='g-dialog';
    dialog.setAttribute('role','dialog');
    dialog.setAttribute('aria-modal','true');
    dialog.setAttribute('aria-labelledby','g-modal-h');
    scrim.replaceChildren(dialog);
    scrim.modalState=S.modal;
  }
  var view=gModal();
  var profileWasOpen=dialog.querySelector('.g-current-profile')?.open;
  var openedTemplate=S.modal.tab==="guides"?dialog.querySelector(".g-settings-template[open]"):null;
  var templateId=openedTemplate?.dataset.template,fieldScroll=openedTemplate?.querySelector(".g-settings-template-table").scrollTop;
  dialog.className=view.className;
  fitSettingsWorkflow(dialog);
  if(view.description)dialog.setAttribute('aria-describedby',view.description);
  else dialog.removeAttribute('aria-describedby');
  dialog.innerHTML=view.html;
  if(profileWasOpen)dialog.querySelector('.g-current-profile')?.setAttribute('open','');
  if(templateId){
    var card=dialog.querySelector('[data-template="'+templateId+'"]');
    if(card){card.open=true;card.querySelector(".g-settings-template-table").scrollTop=fieldScroll;}
  }
  if(S.modal.chartMode==="focus"){
    var pane=dialog.querySelector(".g-modal-scroll-pane");
    if(S.modal.toolbar)pane.before(S.modal.toolbar);
    S.modal.card.querySelectorAll(".g-table-preview").forEach(node=>node.classList.remove("g-table-preview"));
    pane.append(S.modal.card);
  }
}
function fitSettingsWorkflow(dialog){
  if(!dialog?.classList.contains("g-settings-workflow"))return;
  var scale=dialog.parentElement.getBoundingClientRect().height/dialog.parentElement.offsetHeight||1;
  dialog.style.setProperty("--settings-max-width",Math.max(0,innerWidth/scale-36)+"px");
  dialog.style.setProperty("--settings-max-height",Math.max(0,Math.min(850,innerHeight/scale-36))+"px");
}
window.addEventListener("resize",()=>fitSettingsWorkflow(document.getElementById("g-dialog")));
function setModalBackground(){
  ["side","topbar","page","drawer"].forEach(function(i){var el=document.getElementById(i);if(el)el.inert=!!S.modal;});
  document.documentElement.classList.toggle("g-trend-dialog-open",!!S.modal?.chartMode);
}
function renderShell(){
  finishCockpitDrag(false);
  if(S.page==="data"&&!S.bq)S.page="home";
  if(S.page==="insights"&&!S.result&&!(S.updSnap&&S.updSnap.result))S.page="home";
  if(S.page==="full-insights"&&!canOpenFullInsights())S.page="home";
  var act=document.activeElement,keep=null;if(act&&act.closest&&((S.modal&&act.closest("#g-dialog"))||(S.cockpit&&act.id&&act.closest("#cockpit-form"))))keep={id:act.id,name:act.getAttribute("name"),value:act.getAttribute("value")};
  var previousInsightsNav=document.getElementById("g-insights-nav");
  var sidebarScroll=previousInsightsNav?.closest("nav").scrollTop;
  renderSide();renderTop();
  var pages={home:gHome,data:gData,insights:gInsights,"full-insights":gInsights};
  var report=S.page==="insights"||S.page==="full-insights";
  document.body.classList.toggle("athena-task-page",S.cockpit||S.page==="data");
  main.classList.toggle("g-main-wide",report);
  var page=document.getElementById('page');
  if(!page||page.parentElement!==main){
    page=document.createElement('div');page.id='page';page.className='g-page';
    main.replaceChildren(page);
  }
  var evidence=page.querySelector("#g-report-evidence");
  var sameReport=report&&page.reportMode===S.page&&page.reportResult===xR();
  var keepEvidence=sameReport&&evidence&&!evidence.hidden;
  if(!keepEvidence){
    closeChartFilter();
    evidence?.previewObserver?.disconnect();
    page.innerHTML=(pages[S.page]||gHome)();
    page.reportMode=report?S.page:null;
    page.reportResult=report?xR():null;
  }
  renderModal();
  setModalBackground();
  saveDraft();
  if(S.wizFocus){var fe=S.wizFocus==="w-first"?(main.querySelector(".wiz [data-w], .wiz input, .wiz button")||main):document.getElementById(S.wizFocus);S.wizFocus=null;if(fe){for(var parent=fe.parentElement;parent;parent=parent.parentElement)if(parent.tagName==='DETAILS')parent.open=true;fe.focus({preventScroll:false});}}
  else if(S.modal&&S.modalFresh){S.modalFresh=false;var hh=document.getElementById("g-modal-h");if(hh)hh.focus();}
  else if(keep){var el2=keep.id?document.getElementById(keep.id):(keep.name?document.querySelector('#g-dialog [name="'+keep.name+'"]'+(keep.value!==null?'[value="'+keep.value+'"]':'')):null);if(el2)el2.focus({preventScroll:true});}
  if(S.cockpit)cockpitGeometry();
  if(report){
    var presentation=page.querySelector("#g-report-presentation");
    if(presentation){
      if(keepEvidence&&previousInsightsNav&&!previousInsightsNav.hidden){
        document.getElementById("g-insights-nav").replaceWith(previousInsightsNav);
      }else gBuildInsightsNav(presentation,sameReport?previousInsightsNav:null);
      if(!keepEvidence)gOrganizeEvidence(xR(),page);
      gNav();
      if(sameReport)document.querySelector("#side>nav").scrollTop=sidebarScroll||0;
      sizeChartTables();
    }
  }
}

function upload(file){
  // Replacing a file starts a new analysis input for this tab.  Release the
  // superseded temporary handle without touching uploads owned by other tabs.
  // It also invalidates a still-running prior inspection before it can write
  // its late response back into the fresh analysis.
  S.selectorFilters={};var uploadRequest=++uploadGeneration,expectedGrain=S.modal&&S.modal.tab==='dataset'?S.grain:null;
  // Selection commits the existing destructive replacement boundary. A released
  // input can no longer be restored by scope Cancel or dialog close.
  S.updSnap=null;updateGeneration++;S.updateFailed=null;S.updateBusy=false;
  invalidateResult();planGeneration++;
  var replacedUploadId=S.upload&&S.upload.upload_id;
  releaseUpload(replacedUploadId);
  busy(1);var fin=function(){setTimeout(function(){busy(-1);},0);};
  S.busy=true;S.uploadingFile=file.name;S.uploadingGrain=expectedGrain;S.failed=null;S.upload=null;
  // a new file re-scopes, but a target the user typed is theirs to keep; only a value filled in from a
  // saved configuration is cleared, so the configuration matched to the new file can supply its own
  ["scope_lines_of_business","scope_contact_types","scope_period","group_dimension"].forEach(function(k){delete S.answers[k];});
  if(S.plan&&S.plan.prefilled&&S.plan.prefilled.target)delete S.answers.target;
  S.plan=null;
  render();
  var p=file.arrayBuffer().then(function(buf){return api("/api/inspect",buf,{raw:true,headers:Object.assign({"Content-Type":"application/octet-stream","X-Filename":file.name},dateHeaders())});}).then(function(r){
    if(uploadRequest!==uploadGeneration){
      if(r.status===200&&r.body&&r.body.upload_id)releaseUpload(r.body.upload_id);
      return;
    }
    S.busy=false;
    if(r.status!==200){S.failed=r.body.message||"Try again.";render();return replan().then(function(){render();});}
    S.upload=r.body;if(!S.upload.ok){render();return replan().then(function(){render();});}if(expectedGrain&&S.upload.ok&&S.upload.grain!==expectedGrain){releaseUpload(S.upload.upload_id);S.upload=null;S.failed='This file uses a different dataset layout. Choose its matching dataset card.';render();return;}if(S.shell==="sidebar"&&S.upload.ok){S.cockpit=false;S.page="data";S.modal={tab:"dataset-loaded",from:null};S.modalFresh=true;}return replan();
  }).catch(function(){if(uploadRequest!==uploadGeneration)return;S.busy=false;S.failed="The connection was lost. Try again.";render();return replan().then(function(){render();});});
  p.then(fin,fin);return p;
}
document.addEventListener("click",function(e){
  var t=e.target.closest("button");if(!t)return;
  if(t.dataset.go&&!t.disabled){go(t.dataset.go);return;}
  if(t.dataset.bq){if(S.shell==="sidebar"){invalidateResult();abandonUpload();S.answers={};S.draftNote=null;}S.bq=t.dataset.bq;replan().then(function(){go("data");});return;}
  if(t.dataset.all){var q=S.plan.questions.filter(function(x){return x.id===t.dataset.all;})[0];setAnswer(q.id,q.options.map(function(o){return o.id;}));return;}
  if(t.id==="analyze"){
    if(S.analysisBusy||(S.cockpit&&!targetReady()))return;
    S.analysisBusy=true;S.failed=null;render();
    var resultRequest=++resultGeneration;
    var body=Object.assign(planBody(),{upload_id:S.upload.upload_id,optional_uploads:optionalUploadIds(),constraint_setup:constraintSetup()});
    if(S.shell==="sidebar"){
      body.full_detail=true;
      if(body.answers.report_questions===undefined&&!(body.answers.goal||[]).some(id=>id!=="performing")){
        body.answers={...body.answers,report_questions:[]};
      }
    }
    var submitted=JSON.stringify(body);
    api("/api/result",body).then(function(r){
      if(resultRequest!==resultGeneration)return;
      S.analysisBusy=false;
      if(r.status===200){
        S.updSnap=null;S.result=r.body;S.failed=null;S.view="overview";
        if(r.body.account_requirements||r.body.insights?.component_movement||r.body.hourly_heatmap)observedState(r.body).resultRequest=submitted;
        go("insights");
      }else{S.failed=(r.body&&r.body.message)||"Review the analysis setup.";render();}
    }).catch(function(){if(resultRequest!==resultGeneration)return;S.analysisBusy=false;S.failed="The connection was lost. Try again.";render();});
    return;
  }
  if(t.id==="change"){invalidateResult();go("data");return;}
  if(t.id==="menu-toggle"){document.body.classList.toggle("menu-open");renderTop();return;}
  if(t.id==="s-end"){endSession();return;}
  if(t.id==="h-continue"){if(S.shell==="sidebar"&&S.upload&&S.upload.ok){S.page="home";S.cockpit=true;render();}else go("data");return;}
  if(t.id==="h-view"){go("insights");return;}
  if(t.id==="h-discard"){discardDraft();return;}
  if(t.id==="cfg-use"){gDismissSettings(useStaged);return;}
  if(t.id==="cfg-discard"){clearStagedConfig();render();return;}
  if(t.id==="cfg-end"){endSession();return;}
  if(t.id==="show-evidence"){openDrawer(xEvidence());return;}
  if(t.id==="show-data"&&S.shell==="sidebar"){go("data");return;}
  if(t.id==="show-data"){openDrawer(xData());return;}
  if(t.id==="drawer-close"){xCloseDrawer();return;}
  if(t.dataset.view){S.view=t.dataset.view;render();}
});
document.addEventListener("change",function(e){
  var t=e.target;
  if(t.id==="file"&&t.files[0]){upload(t.files[0]);return;}
  if(t.id==='optional-file'&&t.files[0]){uploadOptional(S.optionalEditing,t.files[0]);return;}
  if(t.id==="acctfile"&&t.files[0]&&S.cfg.configuration_storage==="session"){stageConfig(t.files[0]);return;}
  if(t.id==="acctfile"&&t.files[0]){var f=t.files[0];f.arrayBuffer().then(function(b){return api("/api/account",b,{raw:true,headers:{"Content-Type":"application/json"}});}).then(function(r){S.acctIssues=r.body.issues;S.cfg.profiles=r.body.profiles;render();});return;}
  if(t.id==="confirm"){S.confirmed=t.checked;render();return;}
  if(t.hasAttribute('data-report-question')){updateCockpitQuestions(t.closest('#cockpit-form'));return;}
  if(t.dataset.q){var q=S.plan.questions.filter(function(x){return x.id===t.dataset.q;})[0];
    if(q.type==="multi"){var cur=(S.answers[q.id]||[]).slice(),i=cur.indexOf(t.value);if(t.checked&&i===-1)cur.push(t.value);if(!t.checked&&i!==-1)cur.splice(i,1);setAnswer(q.id,cur.length?cur:null);}
    else setAnswer(q.id,t.value);return;}
  if(t.dataset.confirm){var id3=t.dataset.confirm,c3=Object.assign({},S.answers[id3]||{});c3.confirmed=t.checked;setAnswer(id3,c3);return;}
  if(t.dataset.num||t.dataset.unit){var id=t.dataset.num||t.dataset.unit,cur2=Object.assign({},S.answers[id]||{});
    if(t.dataset.num)cur2.value=t.value===""?undefined:Number(t.value);else cur2.unit=t.value;
    if(cur2.value===undefined&&cur2.unit===undefined)setAnswer(id,null);else setAnswer(id,cur2);return;}
  if(t.dataset.date){var id2=t.dataset.date,c2=Object.assign({},S.answers[id2]||{});c2[t.dataset.end==="1"?"end":"start"]=t.value;setAnswer(id2,c2);}
});
document.addEventListener("dragover",function(e){var d=e.target.closest("#drop,#optional-drop");if(d){e.preventDefault();d.classList.add("over-drop");}});
document.addEventListener("dragleave",function(e){var d=e.target.closest("#drop,#optional-drop");if(d)d.classList.remove("over-drop");});
document.addEventListener("drop",function(e){var d=e.target.closest("#drop,#optional-drop");if(d){e.preventDefault();d.classList.remove("over-drop");if(e.dataTransfer.files[0]){if(d.id==='optional-drop')uploadOptional(S.optionalEditing,e.dataTransfer.files[0]);else upload(e.dataTransfer.files[0]);}}});
// Public Pages entry point. The existing report renderer consumes one completed synthetic run.
const originalRenderSide = renderSide;
renderSide = function(){
  originalRenderSide();
  for(const id of ["s-home","s-data","s-cockpit","s-settings"]){
    document.getElementById(id)?.closest("li")?.remove();
  }
  const mode = S.page === "full-insights" ? "full-insights" : "insights";
  const switcher = document.createElement("div");
  switcher.className = "demo-modes";
  switcher.setAttribute("role","group");
  switcher.setAttribute("aria-label","Detail level");
  for(const [destination,label] of [["insights","Standard"],["full-insights","Full detail"]]){
    const button = document.createElement("button");
    button.className = "g-nav-btn";
    button.type = "button";
    button.dataset.go = destination;
    button.setAttribute("aria-pressed",String(mode === destination));
    button.textContent = label;
    switcher.append(button);
  }
  const footer = document.querySelector(".g-sidebar-footer");
  document.querySelector("#side>nav").before(switcher);
  footer.innerHTML = '<p class="demo-scope">Synthetic sample<br>Fixed report scope</p>';
};
const originalRenderTop = renderTop;
renderTop = function(){
  originalRenderTop();
  const status = document.querySelector("#g-status span:last-child");
  if(status)status.textContent = "Synthetic demo";
};
const demo = JSON.parse(document.getElementById("demo-result").textContent);
S.cfg = demo.config;
S.result = demo.result;
S.optionalUploads.D08 = {upload:{ok:true,upload_id:"synthetic-d08"}};
S.shell = "sidebar";
S.page = "insights";
document.body.className = "shell-sidebar";
render();
