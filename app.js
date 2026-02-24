function fmtDate(d){
  if(!d) return "—";
  const dt = new Date(d);
  if(Number.isNaN(dt.getTime())) return d;
  const dd = String(dt.getDate()).padStart(2,"0");
  const mm = String(dt.getMonth()+1).padStart(2,"0");
  const yy = dt.getFullYear();
  return `${dd}/${mm}/${yy}`;
}

function ruleStatus(val, rule){
  // rule: {min?:number, max?:number, type:"range"|"min"|"max"|"visual"}
  if(rule.type === "visual"){
    return { ok:true, display:"PASS" };
  }
  if(typeof val !== "number" || Number.isNaN(val)){
    return { ok:false, display:"NA" };
  }
  if(rule.type === "range"){
    const ok = val >= rule.min && val <= rule.max;
    return { ok, display: ok ? "PASS" : "FAIL" };
  }
  if(rule.type === "min"){
    const ok = val >= rule.min;
    return { ok, display: ok ? "PASS" : "FAIL" };
  }
  if(rule.type === "max"){
    const ok = val <= rule.max;
    return { ok, display: ok ? "PASS" : "FAIL" };
  }
  return { ok:false, display:"NA" };
}

function num(id){
  const el = document.getElementById(id);
  if(!el) return NaN;
  const n = Number(el.value);
  return Number.isFinite(n) ? n : NaN;
}

function setText(id, val){
  const el = document.getElementById(id);
  if(el) el.textContent = val;
}

const PARAMS = [
  {name:"Appearance", method:"Visual", spec:"Clear & Bright", unit:"—", rule:{type:"visual"}, value:()=>"Clear & Bright"},
  {name:"Viscosity @ 40°C", method:"ASTM D445", spec:"2.0 – 4.5", unit:"cSt", rule:{type:"range", min:2.0, max:4.5}, value:()=>num("visc")},
  {name:"Flash Point (PMCC)", method:"ASTM D93", spec:"Min 35", unit:"°C", rule:{type:"min", min:35}, value:()=>num("flash")},
  {name:"Density @ 15°C", method:"ASTM D1298", spec:"0.810 – 0.845", unit:"g/cc", rule:{type:"range", min:0.810, max:0.845}, value:()=>num("density")},
  {name:"Water Content", method:"ASTM D6304", spec:"Max 200", unit:"ppm", rule:{type:"max", max:200}, value:()=>num("water")},
  {name:"Sediments", method:"ASTM D473", spec:"Max 0.05", unit:"% m/m", rule:{type:"max", max:0.05}, value:()=>num("sed")},
  {name:"Cetane Index", method:"ASTM D4737", spec:"Min 46", unit:"—", rule:{type:"min", min:46}, value:()=>num("cetane")},
];

function generate(){
  // header fields
  setText("r_customer", document.getElementById("customer")?.value || "—");
  setText("r_sample", document.getElementById("sampleName")?.value || "—");
  setText("r_reportNo", document.getElementById("reportNo")?.value || "—");
  setText("r_reportDate", fmtDate(document.getElementById("reportDate")?.value));
  setText("r_spec", document.getElementById("specStd")?.value || "—");

  // build param table
  const tbody = document.querySelector("#paramTable tbody");
  tbody.innerHTML = "";
  let failCount = 0;

  for(const p of PARAMS){
    const v = p.value();
    const status = ruleStatus(typeof v === "string" ? NaN : v, p.rule);
    if(!status.ok) failCount++;

    const tr = document.createElement("tr");
    const resultDisplay =
      (typeof v === "number" && Number.isFinite(v)) ? String(v)
      : (typeof v === "string" ? v : "NA");

    tr.innerHTML = `
      <td>${p.name}</td>
      <td>${p.method}</td>
      <td>${p.spec}</td>
      <td>${p.unit}</td>
      <td>${resultDisplay}</td>
      <td class="${status.ok ? "status-pass" : "status-fail"}">${status.display}</td>
    `;
    tbody.appendChild(tr);
  }

  // overall status
  const overall = document.getElementById("overall");
  const dot = overall?.querySelector(".dot");
  const label = overall?.querySelector("span:last-child");
  if(dot && label){
    if(failCount === 0){
      dot.className = "dot";
      label.textContent = "NORMAL";
    }else{
      dot.className = "dot bad";
      label.textContent = "NOT OK";
    }
  }

  // distillation points
  const points = [
    ["IBP", num("d_ibp")],
    ["5%", num("d_5")],
    ["10%", num("d_10")],
    ["20%", num("d_20")],
    ["30%", num("d_30")],
    ["40%", num("d_40")],
    ["50%", num("d_50")],
    ["60%", num("d_60")],
    ["70%", num("d_70")],
    ["80%", num("d_80")],
    ["90%", num("d_90")],
    ["95%", num("d_95")],
  ];

  const dtbody = document.querySelector("#distTable tbody");
  dtbody.innerHTML = "";
  for(const [k,t] of points){
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${k}</td><td>${Number.isFinite(t) ? t : "NA"}</td>`;
    dtbody.appendChild(tr);
  }

  drawDistillation(points);
}

function drawDistillation(points){
  const canvas = document.getElementById("distChart");
  if(!canvas) return;
  const ctx = canvas.getContext("2d");

  // Make canvas crisp on high DPI
  const cssW = canvas.clientWidth || 700;
  const cssH = canvas.clientHeight || 260;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const w = cssW, h = cssH;

  const data = points.map(([k, t]) => {
    const x = (k === "IBP") ? 0 : Number(String(k).replace("%",""));
    return { x, y: t };
  }).filter(p => Number.isFinite(p.y));

  ctx.clearRect(0, 0, w, h);

  const pad = { l: 55, r: 15, t: 15, b: 45 };
  const pw = w - pad.l - pad.r;
  const ph = h - pad.t - pad.b;

  if(data.length === 0) return;

  const ys = data.map(d => d.y);
  const xmin = 0, xmax = 95;
  const ymin = Math.min(...ys) - 10;
  const ymax = Math.max(...ys) + 10;

  // axes
  ctx.strokeStyle = "#444";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad.l, pad.t);
  ctx.lineTo(pad.l, pad.t + ph);
  ctx.lineTo(pad.l + pw, pad.t + ph);
  ctx.stroke();

  // grid + ticks
  ctx.font = "12px system-ui";
  ctx.fillStyle = "#222";
  ctx.strokeStyle = "#e6e6e6";

  // y ticks
  for(let i = 0; i <= 5; i++){
    const yv = ymin + (i * (ymax - ymin) / 5);
    const y = pad.t + ph - ((yv - ymin) / (ymax - ymin)) * ph;
    ctx.beginPath();
    ctx.moveTo(pad.l, y);
    ctx.lineTo(pad.l + pw, y);
    ctx.stroke();
    ctx.fillText(String(Math.round(yv)), 8, y + 4);
  }

  // x ticks
  const xticks = [0,10,20,30,40,50,60,70,80,90,95];
  for(const xv of xticks){
    const x = pad.l + ((xv - xmin) / (xmax - xmin)) * pw;
    ctx.beginPath();
    ctx.moveTo(x, pad.t);
    ctx.lineTo(x, pad.t + ph);
    ctx.stroke();
    ctx.fillText(String(xv), x - 8, pad.t + ph + 20);
  }
  ctx.fillText("% recovery", pad.l + pw/2 - 30, pad.t + ph + 38);

  ctx.save();
  ctx.translate(16, pad.t + ph/2 + 28);
  ctx.rotate(-Math.PI/2);
  ctx.fillText("Temperature (°C)", 0, 0);
  ctx.restore();

  // line
  ctx.strokeStyle = "#1a1a1a";
  ctx.lineWidth = 2;
  ctx.beginPath();
  data.slice().sort((a,b)=>a.x-b.x).forEach((d, i) => {
    const x = pad.l + ((d.x - xmin) / (xmax - xmin)) * pw;
    const y = pad.t + ph - ((d.y - ymin) / (ymax - ymin)) * ph;
    if(i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // points
  ctx.fillStyle = "#1a1a1a";
  for(const d of data){
    const x = pad.l + ((d.x - xmin) / (xmax - xmin)) * pw;
    const y = pad.t + ph - ((d.y - ymin) / (ymax - ymin)) * ph;
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function resetToday(){
  const el = document.getElementById("reportDate");
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth()+1).padStart(2,"0");
  const dd = String(now.getDate()).padStart(2,"0");
  el.value = `${yyyy}-${mm}-${dd}`;
  generate();
}

// Wire buttons
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("btnGenerate")?.addEventListener("click", generate);
  document.getElementById("btnPrint")?.addEventListener("click", () => window.print());
  document.getElementById("btnToday")?.addEventListener("click", resetToday);

  // initial
  resetToday();

  // re-draw chart after resize so it scales nicely
  window.addEventListener("resize", () => {
    generate();
  });
});
