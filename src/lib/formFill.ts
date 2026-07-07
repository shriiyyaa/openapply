import type { Profile } from '../types'

/**
 * Magic Fill — a bookmarklet that fills employer application forms (Workday,
 * Greenhouse, Lever, Naukri, anything) with the user's saved details.
 *
 * Why a bookmarklet: a static site cannot script other origins, and a browser
 * extension is a whole separate distribution. A bookmarklet the user drags to
 * their bookmarks bar runs as a user script on any page — no install, no store
 * review, works today. The user's data is embedded in the bookmarklet itself,
 * so it never touches a server.
 *
 * Matching heuristics: for every visible input/textarea, we look at its name,
 * id, placeholder, aria-label, autocomplete attribute, and associated <label>
 * text, and match against per-field regexes. Values are set via the native
 * setter + input/change events so React/Angular-controlled forms register it.
 */
export function buildMagicFillBookmarklet(profile: Profile): string {
  const parts = (profile.fullName ?? '').trim().split(/\s+/)
  const data = {
    first: parts[0] ?? '',
    last: parts.length > 1 ? parts[parts.length - 1] : '',
    full: profile.fullName ?? '',
    email: profile.email ?? '',
    phone: profile.phone ?? '',
    linkedin: profile.linkedin ?? '',
    web: profile.portfolio ?? '',
    salary: profile.salaryExpectation ?? '',
    notice: profile.noticePeriod ?? '',
  }

  const script = `(function(){
var D=${JSON.stringify(data)};
var R=[
[/first[\\s_-]?name|given[\\s_-]?name|fname/i,'first'],
[/last[\\s_-]?name|family[\\s_-]?name|surname|lname/i,'last'],
[/full[\\s_-]?name|your[\\s_-]?name|^name$|candidate[\\s_-]?name|legal[\\s_-]?name/i,'full'],
[/e[\\s_-]?mail/i,'email'],
[/phone|mobile|contact[\\s_-]?(no|num)|^tel/i,'phone'],
[/linked[\\s_-]?in/i,'linkedin'],
[/portfolio|personal[\\s_-]?(web)?site|website|github/i,'web'],
[/salary|compensation|expected[\\s_-]?(ctc|pay)|\\bctc\\b|remuneration/i,'salary'],
[/notice[\\s_-]?period|start[\\s_-]?date|availab|joining/i,'notice']
];
var AC={'given-name':'first','family-name':'last','name':'full','email':'email','tel':'phone','url':'web'};
function ctx(el){
var s=(el.name||'')+' '+(el.id||'')+' '+(el.placeholder||'')+' '+(el.getAttribute('aria-label')||'');
if(el.id){var l=document.querySelector('label[for="'+el.id.replace(/"/g,'')+'"]');if(l)s+=' '+l.textContent;}
var p=el.closest('label');if(p)s+=' '+p.textContent;
return s.slice(0,300);}
function setVal(el,v){
var proto=el.tagName==='TEXTAREA'?window.HTMLTextAreaElement.prototype:window.HTMLInputElement.prototype;
var d=Object.getOwnPropertyDescriptor(proto,'value');
if(d&&d.set){d.set.call(el,v);}else{el.value=v;}
el.dispatchEvent(new Event('input',{bubbles:true}));
el.dispatchEvent(new Event('change',{bubbles:true}));}
var n=0;
document.querySelectorAll('input:not([type=hidden]):not([type=file]):not([type=checkbox]):not([type=radio]):not([type=submit]):not([type=password]),textarea').forEach(function(el){
if(el.value)return;
var key=null;
var ac=(el.getAttribute('autocomplete')||'').toLowerCase();
if(AC[ac])key=AC[ac];
if(!key){var c=ctx(el);for(var i=0;i<R.length;i++){if(R[i][0].test(c)){key=R[i][1];break;}}}
if(key&&D[key]){setVal(el,D[key]);n++;el.style.outline='2px solid #7c3aed';}
});
alert('OpenApply Magic Fill: '+n+' field'+(n===1?'':'s')+' filled (highlighted purple). Review before submitting!');
})();`

  return 'javascript:' + encodeURIComponent(script.replace(/\n/g, ''))
}
