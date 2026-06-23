import { useState, useRef, useEffect } from "react";

const BRAND_NAME     = "Haushaltgeräte W.Schippert AG";
const BRAND_INITIALS = "WS";
const WEBHOOK_URL    = "https://hook.eu1.make.com/5jweud94qmd5kgxrmu7lhpmv9qjcnbzj";

const APPLIANCES = [
  { id: "geschirrspueler", name: "Geschirrspüler", icon: "ti-droplet"   },
  { id: "waschmaschine",   name: "Waschmaschine",  icon: "ti-refresh"   },
  { id: "backofen",        name: "Backofen",        icon: "ti-flame"     },
  { id: "glaskeramik",     name: "Glaskeramik",     icon: "ti-circle"    },
  { id: "dampfabzug",      name: "Dampfabzug",      icon: "ti-wind"      },
  { id: "steamer",         name: "Steamer",         icon: "ti-cloud"     },
  { id: "quooker",         name: "Quooker",         icon: "ti-droplet"   },
  { id: "waeschetrockner", name: "Wäschetrockner",  icon: "ti-sun"       },
  { id: "combisteamer",    name: "Combisteamer",    icon: "ti-layers"    },
  { id: "kuehlschrank",    name: "Kühlschrank",     icon: "ti-snowflake" },
  { id: "tiefkuehler",     name: "Tiefkühler",      icon: "ti-snowflake" },
  { id: "anderes",         name: "Anderes Gerät",   icon: "ti-tool"      },
];

const makeSystemPrompt = (geraet) => `
Du bist ein freundlicher, kompetenter Kundenberater der Firma "${BRAND_NAME}" in der Schweiz.
Das defekte Gerät des Kunden ist: ${geraet}.

DIAGNOSEPROZESS (maximal 4–5 Fragen, immer nur EINE pro Nachricht):
1. Frage nach dem genauen Symptom
2. Frage nach dem Gerätealter (in Jahren)
3. Frage nach der Marke
4. Frage bei Bedarf nach Fehlercodes oder sichtbaren Schäden
5. Gib danach eine klare Empfehlung

REPARATUR vs. NEUKAUF (Schweizer Markt):
- Gerät < 5 Jahre → Reparatur fast immer sinnvoll
- 5–10 Jahre → Reparatur meist sinnvoll, ausser offensichtlicher Totalschaden
- > 10–12 Jahre → Eher Neukauf empfehlen
- Ausnahme: Premium-Marken (Miele, V-Zug, Gaggenau) Lebensdauer 15–20 Jahre
- Typische Reparaturkosten Schweiz: CHF 150–500

SPRACHE: Klares Hochdeutsch, freundlich, kurze Antworten (2–4 Sätze), EINE Frage pro Nachricht.

FORMULAR-TRIGGER: Nach der Empfehlung frage ob der Kunde eine Auftragsanfrage stellen möchte.
Wenn ja: Schreibe am Ende exakt [FORMULAR_ZEIGEN]
Bei Notfall (Gas, Brand): Sofort 118 empfehlen.
`.trim();

const Avatar = ({ size = 34 }) => (
  <div style={{ width:size, height:size, borderRadius:"50%", background:"var(--brand-bg)", border:"0.5px solid var(--brand-border)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
    <span style={{ fontSize:Math.round(size*0.37), fontWeight:500, color:"var(--brand-text)", letterSpacing:-0.5 }}>{BRAND_INITIALS}</span>
  </div>
);

export default function ServiceChatbot() {
  const [phase,      setPhase]      = useState("welcome");
  const [appliance,  setAppliance]  = useState(null);
  const [messages,   setMessages]   = useState([]);
  const [input,      setInput]      = useState("");
  const [loading,    setLoading]    = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form,       setForm]       = useState({ name:"", phone:"", email:"", plz:"", ort:"", brand:"", year:"", note:"" });
  const [photoName,  setPhotoName]  = useState("");
  const [formError,  setFormError]  = useState("");
  const messagesEndRef = useRef(null);
  const inputRef       = useRef(null);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior:"smooth" }); }, [messages, loading]);

  // Ruft den lokalen Backend-Proxy auf (hält API-Key sicher)
  const callAPI = async (allMsgs, geraetName) => {
    const resp = await fetch("/api/claude", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model:    "claude-sonnet-4-6",
        max_tokens: 1000,
        system:   makeSystemPrompt(geraetName),
        messages: allMsgs.map(m => ({ role:m.role, content:m.content }))
      })
    });
    const data = await resp.json();
    return data.content?.[0]?.text ?? "";
  };

  const selectAppliance = async (a) => {
    setAppliance(a); setPhase("chat"); setLoading(true);
    const initMsg = { role:"user", content:`Mein ${a.name} ist defekt.`, hidden:true };
    setMessages([initMsg]);
    try {
      const text  = await callAPI([initMsg], a.name);
      const show  = text.includes("[FORMULAR_ZEIGEN]");
      const clean = text.replace("[FORMULAR_ZEIGEN]","").trim();
      setMessages(prev => [...prev, { role:"assistant", content:clean }]);
      if (show) setTimeout(() => setPhase("form"), 1000);
    } catch {
      setMessages(prev => [...prev, { role:"assistant", content:`Guten Tag! Ich helfe Ihnen gerne mit Ihrem ${a.name}. Was ist das genaue Problem?` }]);
    }
    setLoading(false);
    setTimeout(() => inputRef.current?.focus(), 300);
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg = { role:"user", content:input.trim() };
    const allMsgs = [...messages, userMsg];
    setMessages(allMsgs); setInput(""); setLoading(true);
    try {
      const text  = await callAPI(allMsgs, appliance.name);
      const show  = text.includes("[FORMULAR_ZEIGEN]");
      const clean = text.replace("[FORMULAR_ZEIGEN]","").trim();
      setMessages(prev => [...prev, { role:"assistant", content:clean }]);
      if (show) setTimeout(() => setPhase("form"), 1200);
    } catch {
      setMessages(prev => [...prev, { role:"assistant", content:"Es tut mir leid, es gab ein technisches Problem. Bitte versuchen Sie es nochmals." }]);
    }
    setLoading(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleKey = (e) => { if (e.key==="Enter"&&!e.shiftKey) { e.preventDefault(); sendMessage(); } };

  const submitForm = async () => {
    if (!form.name.trim() || !form.phone.trim()) { setFormError("Bitte geben Sie Name und Telefon an."); return; }
    setFormError(""); setSubmitting(true);
    const ki_diagnose = messages.filter(m=>!m.hidden&&m.role==="assistant").map(m=>m.content).join("\n---\n");
    fetch(WEBHOOK_URL, {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({ geraet:appliance?.name??"", name:form.name, telefon:form.phone, email:form.email, plz:form.plz, ort:form.ort, marke:form.brand, baujahr:form.year, hinweise:form.note, foto:photoName, datum:new Date().toLocaleDateString("de-CH"), uhrzeit:new Date().toLocaleTimeString("de-CH",{hour:"2-digit",minute:"2-digit"}), ki_diagnose })
    }).catch(()=>{});
    setSubmitting(false);
    setPhase("done");
  };

  const resetAll = () => {
    setPhase("welcome"); setAppliance(null); setMessages([]); setInput("");
    setForm({ name:"",phone:"",email:"",plz:"",ort:"",brand:"",year:"",note:"" });
    setPhotoName(""); setFormError(""); setSubmitting(false);
  };

  const card = { background:"var(--color-background-primary)", borderRadius:16, boxShadow:"0 4px 32px rgba(0,0,0,0.10)", overflow:"hidden", width:"100%", maxWidth:480 };

  // ── DONE ────────────────────────────────────────────────────────────────
  if (phase==="done") return (
    <div style={card}>
      <div style={{padding:"2.5rem 1.5rem",textAlign:"center"}}>
        <div style={{width:60,height:60,borderRadius:"50%",background:"var(--color-background-success)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 1rem"}}>
          <i className="ti ti-check" style={{fontSize:30,color:"var(--color-text-success)"}}/>
        </div>
        <h2 style={{fontSize:20,fontWeight:500,margin:"0 0 8px"}}>Anfrage erhalten!</h2>
        <p style={{fontSize:14,color:"var(--color-text-secondary)",margin:"0 0 1.5rem",lineHeight:1.6}}>
          Vielen Dank, <strong>{form.name}</strong>. Wir melden uns so bald wie möglich unter <strong>{form.phone}</strong>.
        </p>
        <div style={{background:"var(--color-background-secondary)",borderRadius:8,padding:"0.875rem 1rem",textAlign:"left",fontSize:13,lineHeight:1.7,color:"var(--color-text-secondary)"}}>
          <div style={{fontWeight:500,color:"var(--color-text-primary)",marginBottom:4}}>Ihre Anfrage</div>
          <div>Gerät: {appliance?.name}{form.brand?` · ${form.brand}`:""}{form.year?` (${form.year})`:""}</div>
          {form.ort&&<div>Ort: {form.plz} {form.ort}</div>}
          {photoName&&<div>Foto: {photoName}</div>}
        </div>
        <button onClick={resetAll} style={{marginTop:"1.25rem",fontSize:13,color:"var(--color-text-secondary)",background:"none",border:"0.5px solid var(--color-border-secondary)",borderRadius:8,padding:"7px 18px",cursor:"pointer"}}>
          Neue Anfrage stellen ↩
        </button>
      </div>
    </div>
  );

  // ── WELCOME ──────────────────────────────────────────────────────────────
  if (phase==="welcome") return (
    <div style={card}>
      <div style={{padding:"1.5rem 1rem 2rem"}}>
        <div style={{textAlign:"center",marginBottom:"1.5rem"}}>
          <div style={{display:"flex",justifyContent:"center",marginBottom:"0.75rem"}}><Avatar size={54}/></div>
          <h1 style={{fontSize:17,fontWeight:500,margin:"0 0 4px"}}>{BRAND_NAME}</h1>
          <p style={{fontSize:13,color:"var(--color-text-secondary)",margin:0}}>Gerät defekt? Wählen Sie Ihr Gerät — wir helfen weiter.</p>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
          {APPLIANCES.map(a => (
            <button key={a.id} onClick={()=>selectAppliance(a)}
              style={{background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:8,padding:"14px 8px 10px",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:6,fontSize:12,fontWeight:500,color:"var(--color-text-secondary)",textAlign:"center",lineHeight:1.3,transition:"background 0.12s,border-color 0.12s,color 0.12s"}}
              onMouseEnter={e=>{e.currentTarget.style.background="var(--brand-bg)";e.currentTarget.style.borderColor="var(--brand-border)";e.currentTarget.style.color="var(--brand-text)"}}
              onMouseLeave={e=>{e.currentTarget.style.background="var(--color-background-primary)";e.currentTarget.style.borderColor="var(--color-border-tertiary)";e.currentTarget.style.color="var(--color-text-secondary)"}}>
              <i className={`ti ${a.icon}`} style={{fontSize:22}}/>
              <span>{a.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  // ── CHAT + FORM ──────────────────────────────────────────────────────────
  return (
    <div style={{...card, display:"flex", flexDirection:"column", height:570}}>
      <div style={{display:"flex",alignItems:"center",gap:10,padding:"11px 14px",borderBottom:"0.5px solid var(--color-border-tertiary)",flexShrink:0}}>
        <Avatar size={34}/>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:13,fontWeight:500,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{BRAND_NAME}</div>
          <div style={{fontSize:11,color:"var(--color-text-secondary)"}}>{appliance?.name} · {phase==="form"?"Auftragsformular":"Online"}</div>
        </div>
        {phase==="chat"&&(
          <button onClick={()=>setPhase("form")} style={{fontSize:12,fontWeight:500,color:"var(--brand-text)",background:"var(--brand-bg)",border:"none",borderRadius:8,padding:"5px 10px",cursor:"pointer",whiteSpace:"nowrap"}}>
            Anfrage stellen →
          </button>
        )}
        <button onClick={resetAll} style={{background:"none",border:"none",cursor:"pointer",color:"var(--color-text-tertiary)",fontSize:18,padding:4,lineHeight:1}}>
          <i className="ti ti-x"/>
        </button>
      </div>

      {phase==="chat"&&(<>
        <div style={{flex:1,overflowY:"auto",padding:14,display:"flex",flexDirection:"column",gap:10}}>
          {messages.filter(m=>!m.hidden).map((msg,i)=>(
            <div key={i} style={{display:"flex",justifyContent:msg.role==="user"?"flex-end":"flex-start",gap:8,alignItems:"flex-end"}}>
              {msg.role==="assistant"&&<Avatar size={28}/>}
              <div style={{maxWidth:"78%",padding:"9px 13px",borderRadius:msg.role==="user"?"16px 16px 3px 16px":"16px 16px 16px 3px",background:msg.role==="user"?"var(--brand-bg)":"var(--color-background-secondary)",color:msg.role==="user"?"var(--brand-text)":"var(--color-text-primary)",fontSize:14,lineHeight:1.55,wordBreak:"break-word"}}>
                {msg.content}
              </div>
            </div>
          ))}
          {loading&&(
            <div style={{display:"flex",alignItems:"flex-end",gap:8}}>
              <Avatar size={28}/>
              <div style={{padding:"10px 14px",background:"var(--color-background-secondary)",borderRadius:"16px 16px 16px 3px",display:"flex",gap:4,alignItems:"center"}}>
                {[0,0.2,0.4].map((d,i)=><span key={i} style={{width:6,height:6,borderRadius:"50%",background:"var(--color-text-tertiary)",display:"block",animation:`blink 1.2s ease-in-out ${d}s infinite`}}/>)}
              </div>
            </div>
          )}
          <div ref={messagesEndRef}/>
        </div>
        <div style={{padding:"10px 12px",borderTop:"0.5px solid var(--color-border-tertiary)",flexShrink:0}}>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <input ref={inputRef} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={handleKey} placeholder="Ihre Nachricht…" disabled={loading}/>
            <button onClick={sendMessage} disabled={loading||!input.trim()}
              style={{width:36,height:36,borderRadius:"50%",border:"none",flexShrink:0,background:input.trim()&&!loading?"var(--brand-bg)":"var(--color-background-secondary)",cursor:input.trim()&&!loading?"pointer":"default",display:"flex",alignItems:"center",justifyContent:"center"}}>
              <i className="ti ti-send" style={{fontSize:16,color:input.trim()&&!loading?"var(--brand-text)":"var(--color-text-tertiary)"}}/>
            </button>
          </div>
        </div>
      </>)}

      {phase==="form"&&(<>
        <div style={{flex:1,overflowY:"auto",padding:"14px 16px"}}>
          <p style={{margin:"0 0 12px",fontSize:13,color:"var(--color-text-secondary)"}}>Felder mit * sind erforderlich.</p>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <div style={{gridColumn:"1/-1"}}>
              <label style={{fontSize:12,color:"var(--color-text-secondary)",display:"block",marginBottom:3}}>Name *</label>
              <input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="Vorname Nachname"/>
            </div>
            <div>
              <label style={{fontSize:12,color:"var(--color-text-secondary)",display:"block",marginBottom:3}}>Telefon *</label>
              <input value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} placeholder="079 000 00 00"/>
            </div>
            <div>
              <label style={{fontSize:12,color:"var(--color-text-secondary)",display:"block",marginBottom:3}}>E-Mail</label>
              <input value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} placeholder="name@mail.ch"/>
            </div>
            <div>
              <label style={{fontSize:12,color:"var(--color-text-secondary)",display:"block",marginBottom:3}}>PLZ</label>
              <input value={form.plz} onChange={e=>setForm(f=>({...f,plz:e.target.value}))} placeholder="8400"/>
            </div>
            <div>
              <label style={{fontSize:12,color:"var(--color-text-secondary)",display:"block",marginBottom:3}}>Ort</label>
              <input value={form.ort} onChange={e=>setForm(f=>({...f,ort:e.target.value}))} placeholder="Winterthur"/>
            </div>
            <div>
              <label style={{fontSize:12,color:"var(--color-text-secondary)",display:"block",marginBottom:3}}>Marke</label>
              <input value={form.brand} onChange={e=>setForm(f=>({...f,brand:e.target.value}))} placeholder="Miele, Bosch, V-Zug…"/>
            </div>
            <div>
              <label style={{fontSize:12,color:"var(--color-text-secondary)",display:"block",marginBottom:3}}>Baujahr</label>
              <input value={form.year} onChange={e=>setForm(f=>({...f,year:e.target.value}))} placeholder="2018"/>
            </div>
            <div style={{gridColumn:"1/-1"}}>
              <label style={{fontSize:12,color:"var(--color-text-secondary)",display:"block",marginBottom:3}}>Foto des Geräts / Defekts</label>
              <label style={{display:"flex",alignItems:"center",gap:8,padding:"9px 12px",cursor:"pointer",border:"0.5px dashed var(--color-border-secondary)",borderRadius:8,fontSize:13,color:"var(--color-text-secondary)",background:"var(--color-background-secondary)"}}>
                <i className="ti ti-photo" style={{fontSize:16,flexShrink:0}}/>
                <span>{photoName||"Foto hochladen (optional)"}</span>
                <input type="file" accept="image/*" onChange={e=>setPhotoName(e.target.files?.[0]?.name||"")} style={{display:"none"}}/>
              </label>
            </div>
            <div style={{gridColumn:"1/-1"}}>
              <label style={{fontSize:12,color:"var(--color-text-secondary)",display:"block",marginBottom:3}}>Zusätzliche Hinweise</label>
              <textarea value={form.note} onChange={e=>setForm(f=>({...f,note:e.target.value}))} placeholder="Fehlercode, weitere Details…" rows={2} style={{resize:"vertical"}}/>
            </div>
          </div>
          {formError&&<p style={{color:"var(--color-text-danger)",fontSize:12,margin:"8px 0 0"}}>{formError}</p>}
        </div>
        <div style={{padding:"10px 12px",borderTop:"0.5px solid var(--color-border-tertiary)",display:"flex",gap:8,flexShrink:0}}>
          <button onClick={()=>setPhase("chat")} style={{fontSize:13,color:"var(--color-text-secondary)",background:"none",border:"0.5px solid var(--color-border-secondary)",borderRadius:8,padding:"8px 14px",cursor:"pointer"}}>
            ← Zurück
          </button>
          <button onClick={submitForm} disabled={submitting} style={{flex:1,fontSize:14,fontWeight:500,color:"var(--color-text-success)",background:"var(--color-background-success)",border:"none",borderRadius:8,padding:"8px 16px",cursor:submitting?"default":"pointer",opacity:submitting?0.7:1}}>
            {submitting?"Wird gesendet…":"Anfrage absenden ↗"}
          </button>
        </div>
      </>)}
    </div>
  );
}


