// caption_helper.cjs — inject caption bar + intro card into a Playwright page
// CommonJS (.cjs) de tranh loi require extension trong Playwright Node script.
const CAP_CSS = `
#cap-bar{position:fixed;left:0;right:0;bottom:0;z-index:2147483647;
  background:rgba(15,23,42,.82);color:#fff;font:600 16px/1.5 system-ui,'Segoe UI',sans-serif;
  padding:10px 16px;text-align:center;pointer-events:none;letter-spacing:.2px;
  text-shadow:0 1px 2px rgba(0,0,0,.6)}
#intro-card{position:fixed;inset:0;z-index:2147483646;display:none;align-items:center;justify-content:center;
  background:rgba(2,6,23,.72)}
#intro-card .box{max-width:560px;background:#0f172a;color:#e2e8f0;border:1px solid #334155;
  border-radius:14px;padding:28px 32px;box-shadow:0 20px 60px rgba(0,0,0,.5);text-align:center}
#intro-card h2{margin:0 0 10px;font-size:22px;color:#38bdf8}
#intro-card p{margin:0;font-size:15px;line-height:1.6;color:#cbd5e1}
`;
const CAP_INIT = `(function(){
  var s=document.createElement('style'); s.textContent=${JSON.stringify(CAP_CSS)}; document.head.appendChild(s);
  var bar=document.createElement('div'); bar.id='cap-bar'; bar.style.display='none'; document.body.appendChild(bar);
  var card=document.createElement('div'); card.id='intro-card';
  card.innerHTML='<div class="box"><h2></h2><p></p></div>'; document.body.appendChild(card);
  window.setCap=function(t){ if(t){bar.textContent=t; bar.style.display='block';} else {bar.style.display='none';} };
  window.showIntro=function(o){ card.querySelector('h2').textContent=(o&&o.title)||''; card.querySelector('p').textContent=(o&&o.desc)||''; card.style.display='flex'; };
  window.hideIntro=function(){ card.style.display='none'; };
})();`;
module.exports = { CAP_CSS, CAP_INIT };
