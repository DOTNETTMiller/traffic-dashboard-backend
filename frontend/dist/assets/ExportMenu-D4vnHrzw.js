import{r as y,j as s,t as e,s as h,f as b}from"./index-C8xRFaXu.js";function B({events:v,messages:g,onClose:f}){const[m,k]=y.useState("csv"),[l,C]=y.useState(!0),[p,D]=y.useState("all"),[d,w]=y.useState(!1),x=()=>{if(p==="all")return v;const t=new Date;let i;switch(p){case"24h":i=new Date(t-24*60*60*1e3);break;case"7d":i=new Date(t-7*24*60*60*1e3);break;case"30d":i=new Date(t-30*24*60*60*1e3);break;default:return v}return v.filter(n=>n.startTime?new Date(n.startTime)>=i:!0)},E=()=>{const t=x(),i=["ID","Event Type","Severity","State","Corridor","Location","Description","Latitude","Longitude","Direction","Lanes Affected","Start Time","End Time"];l&&i.push("Message Count","Latest Message");const n=t.map(a=>{const j=[a.id,a.eventType||"",a.severity||a.severityLevel||"",a.state||"",a.corridor||"",`"${(a.location||"").replace(/"/g,'""')}"`,`"${(a.description||"").replace(/"/g,'""')}"`,a.latitude||"",a.longitude||"",a.direction||"",a.lanesAffected||"",a.startTime||"",a.endTime||""];if(l){const S=g[a.id]||[];j.push(S.length);const $=S[S.length-1];j.push($?`"${$.content.replace(/"/g,'""')}"`:"")}return j.join(",")}),o=[i.join(","),...n].join(`
`),r=new Blob([o],{type:"text/csv;charset=utf-8;"}),c=document.createElement("a"),u=URL.createObjectURL(r);c.setAttribute("href",u),c.setAttribute("download",`corridor-events-${b(new Date,"yyyy-MM-dd-HHmmss")}.csv`),c.style.visibility="hidden",document.body.appendChild(c),c.click(),document.body.removeChild(c)},T=()=>{const t=x(),i={exportDate:new Date().toISOString(),dateRange:p,totalEvents:t.length,events:t.map(u=>({...u,messages:l?g[u.id]||[]:void 0}))},n=JSON.stringify(i,null,2),o=new Blob([n],{type:"application/json"}),r=document.createElement("a"),c=URL.createObjectURL(o);r.setAttribute("href",c),r.setAttribute("download",`corridor-events-${b(new Date,"yyyy-MM-dd-HHmmss")}.json`),r.style.visibility="hidden",document.body.appendChild(r),r.click(),document.body.removeChild(r)},L=()=>{const t=x(),i=`
      <!DOCTYPE html>
      <html>
        <head>
          <title>DOT Corridor Communicator Report</title>
          <style>
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              margin: 40px;
              color: #1f2937;
            }
            h1 {
              color: #1e40af;
              border-bottom: 3px solid #3b82f6;
              padding-bottom: 10px;
              margin-bottom: 20px;
            }
            h2 {
              color: #374151;
              margin-top: 30px;
              margin-bottom: 15px;
            }
            .header {
              margin-bottom: 30px;
            }
            .summary {
              background: #f3f4f6;
              padding: 20px;
              border-radius: 8px;
              margin-bottom: 30px;
            }
            .summary-grid {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 20px;
              margin-top: 15px;
            }
            .summary-item {
              text-align: center;
            }
            .summary-value {
              font-size: 32px;
              font-weight: bold;
              color: #1e40af;
            }
            .summary-label {
              font-size: 14px;
              color: #6b7280;
              margin-top: 5px;
            }
            .event {
              border: 1px solid #e5e7eb;
              border-radius: 8px;
              padding: 15px;
              margin-bottom: 15px;
              page-break-inside: avoid;
            }
            .event-header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 10px;
            }
            .event-type {
              font-weight: bold;
              font-size: 16px;
              color: #1f2937;
            }
            .severity {
              padding: 4px 12px;
              border-radius: 12px;
              font-size: 12px;
              font-weight: 600;
              text-transform: uppercase;
            }
            .severity-high {
              background: #fecaca;
              color: #991b1b;
            }
            .severity-medium {
              background: #fed7aa;
              color: #9a3412;
            }
            .severity-low {
              background: #d1fae5;
              color: #065f46;
            }
            .event-details {
              font-size: 14px;
              color: #4b5563;
              line-height: 1.6;
            }
            .event-detail-row {
              margin: 5px 0;
            }
            .label {
              font-weight: 600;
              color: #374151;
            }
            .footer {
              margin-top: 50px;
              padding-top: 20px;
              border-top: 2px solid #e5e7eb;
              font-size: 12px;
              color: #6b7280;
              text-align: center;
            }
            @media print {
              body { margin: 20px; }
              .event { page-break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>DOT Corridor Communicator Report</h1>
            <p>Generated: ${b(new Date,"MMMM dd, yyyy HH:mm:ss")}</p>
            <p>Date Range: ${p==="all"?"All Events":p==="24h"?"Last 24 Hours":p==="7d"?"Last 7 Days":"Last 30 Days"}</p>
          </div>

          <div class="summary">
            <h2>Summary Statistics</h2>
            <div class="summary-grid">
              <div class="summary-item">
                <div class="summary-value">${t.length}</div>
                <div class="summary-label">Total Events</div>
              </div>
              <div class="summary-item">
                <div class="summary-value">${t.filter(o=>(o.severity||o.severityLevel||"").toString().toLowerCase()==="high").length}</div>
                <div class="summary-label">High Severity</div>
              </div>
              <div class="summary-item">
                <div class="summary-value">${l?Object.values(g).flat().length:0}</div>
                <div class="summary-label">Total Messages</div>
              </div>
            </div>
          </div>

          <h2>Event Details</h2>
          ${t.map(o=>{const r=(o.severity||o.severityLevel||"medium").toString().toLowerCase(),c=r==="high"||r==="major"?"severity-high":r==="medium"||r==="moderate"?"severity-medium":"severity-low";return`
              <div class="event">
                <div class="event-header">
                  <span class="event-type">${o.eventType||"Unknown"}</span>
                  <span class="severity ${c}">${r}</span>
                </div>
                <div class="event-details">
                  <div class="event-detail-row">
                    <span class="label">Location:</span> ${o.location||"N/A"}
                  </div>
                  <div class="event-detail-row">
                    <span class="label">State:</span> ${o.state||"N/A"} |
                    <span class="label">Corridor:</span> ${o.corridor||"N/A"}
                  </div>
                  <div class="event-detail-row">
                    <span class="label">Description:</span> ${o.description||"N/A"}
                  </div>
                  <div class="event-detail-row">
                    <span class="label">Direction:</span> ${o.direction||"N/A"} |
                    <span class="label">Lanes Affected:</span> ${o.lanesAffected||"N/A"}
                  </div>
                  ${o.startTime?`
                    <div class="event-detail-row">
                      <span class="label">Start Time:</span> ${b(new Date(o.startTime),"MMM dd, yyyy HH:mm")}
                    </div>
                  `:""}
                  ${l&&g[o.id]&&g[o.id].length>0?`
                    <div class="event-detail-row">
                      <span class="label">Messages:</span> ${g[o.id].length} message(s)
                    </div>
                  `:""}
                </div>
              </div>
            `}).join("")}

          <div class="footer">
            <p>DOT Corridor Communicator - Traffic Event Management System</p>
            <p>This report was automatically generated and contains ${t.length} event(s)</p>
          </div>
        </body>
      </html>
    `,n=window.open("","_blank");n.document.write(i),n.document.close(),n.onload=()=>{n.print()}},M=async()=>{w(!0);try{const t=x();switch(m){case"csv":E(),h(`Exported ${t.length} events to CSV`,"success");break;case"json":T(),h(`Exported ${t.length} events to JSON`,"success");break;case"pdf":L(),h(`Generated PDF report with ${t.length} events`,"success");break;default:break}setTimeout(()=>{w(!1),f()},1e3)}catch(t){console.error("Export failed:",t),w(!1),h("Export failed. Please try again.","error")}};return s.jsxs("div",{style:{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0, 0, 0, 0.5)",backdropFilter:"blur(4px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1e4,animation:"fadeIn 0.2s ease-out"},children:[s.jsxs("div",{style:{background:e.colors.glassDark,backdropFilter:"blur(20px)",border:`1px solid ${e.colors.border}`,borderRadius:"16px",boxShadow:e.shadows.xl,padding:e.spacing.xl,minWidth:"500px",maxWidth:"600px",animation:"slideUp 0.3s ease-out"},children:[s.jsxs("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:e.spacing.lg,paddingBottom:e.spacing.md,borderBottom:`2px solid ${e.colors.border}`},children:[s.jsx("h2",{style:{margin:0,fontSize:"24px",fontWeight:"700",color:e.colors.text},children:"Export Data"}),s.jsx("button",{onClick:f,style:{background:"transparent",border:"none",fontSize:"28px",color:e.colors.textSecondary,cursor:"pointer",padding:"4px 8px",lineHeight:1},children:"✕"})]}),s.jsxs("div",{style:{marginBottom:e.spacing.lg},children:[s.jsx("label",{style:{display:"block",fontSize:"14px",fontWeight:"600",color:e.colors.text,marginBottom:e.spacing.sm},children:"Export Format"}),s.jsx("div",{style:{display:"grid",gridTemplateColumns:"repeat(3, 1fr)",gap:e.spacing.sm},children:[{value:"csv",label:"CSV",icon:"📊",desc:"Spreadsheet data"},{value:"json",label:"JSON",icon:"📄",desc:"Raw data"},{value:"pdf",label:"PDF",icon:"📑",desc:"Print report"}].map(t=>s.jsxs("button",{onClick:()=>k(t.value),style:{padding:e.spacing.md,borderRadius:"12px",border:`2px solid ${m===t.value?e.colors.accentBlue:e.colors.border}`,background:m===t.value?`${e.colors.accentBlue}20`:e.colors.glassLight,cursor:"pointer",transition:`all ${e.transitions.fast}`,textAlign:"center"},children:[s.jsx("div",{style:{fontSize:"32px",marginBottom:e.spacing.xs},children:t.icon}),s.jsx("div",{style:{fontSize:"14px",fontWeight:"700",color:e.colors.text,marginBottom:"2px"},children:t.label}),s.jsx("div",{style:{fontSize:"11px",color:e.colors.textSecondary},children:t.desc})]},t.value))})]}),s.jsxs("div",{style:{marginBottom:e.spacing.lg},children:[s.jsx("label",{style:{display:"block",fontSize:"14px",fontWeight:"600",color:e.colors.text,marginBottom:e.spacing.sm},children:"Date Range"}),s.jsxs("select",{value:p,onChange:t=>D(t.target.value),style:{width:"100%",padding:e.spacing.md,fontSize:"14px",border:`2px solid ${e.colors.border}`,borderRadius:"12px",background:e.colors.glassLight,color:e.colors.text,cursor:"pointer",outline:"none"},children:[s.jsx("option",{value:"all",children:"All Events"}),s.jsx("option",{value:"24h",children:"Last 24 Hours"}),s.jsx("option",{value:"7d",children:"Last 7 Days"}),s.jsx("option",{value:"30d",children:"Last 30 Days"})]})]}),s.jsxs("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:e.spacing.md,background:e.colors.glassLight,borderRadius:"12px",marginBottom:e.spacing.lg},children:[s.jsxs("div",{children:[s.jsx("div",{style:{fontSize:"14px",fontWeight:"600",color:e.colors.text},children:"Include Messages"}),s.jsx("div",{style:{fontSize:"12px",color:e.colors.textSecondary,marginTop:"2px"},children:"Export messages along with events"})]}),s.jsx("button",{onClick:()=>C(!l),style:{width:"48px",height:"24px",borderRadius:"12px",border:`2px solid ${l?e.colors.accentBlue:e.colors.border}`,background:l?e.colors.accentBlue:e.colors.gray[300],position:"relative",cursor:"pointer",transition:`all ${e.transitions.fast}`},children:s.jsx("div",{style:{position:"absolute",top:"1px",left:l?"calc(100% - 21px)":"1px",width:"18px",height:"18px",borderRadius:"50%",background:"white",boxShadow:e.shadows.sm,transition:`all ${e.transitions.fast}`}})})]}),s.jsxs("div",{style:{padding:e.spacing.md,background:`${e.colors.accentBlue}10`,border:`1px solid ${e.colors.accentBlue}`,borderRadius:"12px",marginBottom:e.spacing.lg},children:[s.jsx("div",{style:{fontSize:"13px",color:e.colors.text,marginBottom:e.spacing.xs},children:s.jsx("strong",{children:"Export Summary:"})}),s.jsxs("div",{style:{fontSize:"12px",color:e.colors.textSecondary},children:[x().length," events • ",m.toUpperCase()," format",l?" • Including messages":""]})]}),s.jsxs("div",{style:{display:"flex",gap:e.spacing.md},children:[s.jsx("button",{onClick:f,disabled:d,style:{flex:1,padding:`${e.spacing.md} ${e.spacing.lg}`,fontSize:"14px",fontWeight:"600",border:`2px solid ${e.colors.border}`,borderRadius:"12px",background:e.colors.glassLight,color:e.colors.text,cursor:d?"not-allowed":"pointer",opacity:d?.5:1,transition:`all ${e.transitions.fast}`},children:"Cancel"}),s.jsx("button",{onClick:M,disabled:d,style:{flex:2,padding:`${e.spacing.md} ${e.spacing.lg}`,fontSize:"14px",fontWeight:"600",border:"none",borderRadius:"12px",background:d?e.colors.gray[400]:e.colors.accentBlue,color:"#111827",cursor:d?"not-allowed":"pointer",transition:`all ${e.transitions.fast}`,boxShadow:d?"none":e.shadows.md},onMouseEnter:t=>{d||(t.currentTarget.style.transform="translateY(-2px)",t.currentTarget.style.boxShadow=e.shadows.lg)},onMouseLeave:t=>{d||(t.currentTarget.style.transform="translateY(0)",t.currentTarget.style.boxShadow=e.shadows.md)},children:d?"Exporting...":`Export as ${m.toUpperCase()}`})]})]}),s.jsx("style",{children:`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `})]})}export{B as default};
