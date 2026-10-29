import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, BarChart3, Building2,
  Check, ChevronDown, CircleHelp, Clock3, Database, Download, Droplets,
  FileText, Filter, Gauge, Leaf, Menu, Plus, RefreshCw, Search, Settings2,
  ShieldCheck, Table2, Trash2, Wifi, X, Zap
} from 'lucide-react';
import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis
} from 'recharts';

const API = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '') + '/api';
const fmt = (n, digits = 1) => Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: digits });
const dateLabel = (value) => {
  if (!value) return '—';
  const d = new Date(String(value).replace(' ', 'T'));
  return Number.isNaN(d.getTime()) ? String(value).replace('T', ' ').slice(0, 16) : d.toLocaleString('en-IN', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit', hour12:false });
};
const navItems = [
  { id:'overview', label:'Overview', icon:Activity, group:'CAMPUS' },
  { id:'energy', label:'Energy analytics', icon:BarChart3, group:'CAMPUS' },
  { id:'buildings', label:'Buildings', icon:Building2, group:'CAMPUS' },
  { id:'readings', label:'Readings ledger', icon:Table2, group:'DATA' },
  { id:'alerts', label:'Anomaly review', icon:AlertTriangle, group:'DATA' },
  { id:'database', label:'Database explorer', icon:Database, group:'DATA' },
  { id:'reports', label:'Reports & savings', icon:FileText, group:'TOOLS' }
];
const buildingColors = ['#2f6b4f', '#c56b43', '#6c8a9b', '#9c8757'];
const defaultForm = () => ({ building:'Library', recordedAt:new Date().toISOString().slice(0,16), energyKwh:'9.2' });

async function api(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: { ...(options.body ? {'Content-Type':'application/json'} : {}), ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || `Request failed (${response.status})`);
  return data;
}

export default function App() {
  const [page, setPage] = useState('overview');
  const [summary, setSummary] = useState(null);
  const [buildings, setBuildings] = useState([]);
  const [hourly, setHourly] = useState([]);
  const [readings, setReadings] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [health, setHealth] = useState({status:'checking', message:'Checking connection'});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState(defaultForm);
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState('');
  const [buildingFilter, setBuildingFilter] = useState('All buildings');
  const [sourceFilter, setSourceFilter] = useState('All sources');
  const [alertReviewed, setAlertReviewed] = useState(() => {
    try { return JSON.parse(localStorage.getItem('campuspulse-reviewed') || '[]'); } catch { return []; }
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError('');
    try {
      const [h, s, b, hr, r, a] = await Promise.all([
        api('/health'), api('/summary'), api('/buildings'), api('/hourly'), api('/readings'), api('/alerts')
      ]);
      setHealth({status:'online', message:'MonetDB connected'});
      setSummary(s); setBuildings(b); setHourly(hr); setReadings(r); setAlerts(a);
    } catch (e) {
      setHealth({status:'offline', message:'API unavailable'});
      setError(`${e.message}. Make sure MonetDB is running, the backend is started, and demo data has been seeded.`);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!success) return;
    const id = setTimeout(() => setSuccess(''), 3500);
    return () => clearTimeout(id);
  }, [success]);

  const filteredReadings = useMemo(() => readings.filter(r => {
    const q = search.toLowerCase().trim();
    const matchesSearch = !q || [r.building, r.source, r.recordedAt, r.energyKwh].some(v => String(v ?? '').toLowerCase().includes(q));
    const matchesBuilding = buildingFilter === 'All buildings' || r.building === buildingFilter;
    const matchesSource = sourceFilter === 'All sources' || String(r.source).toLowerCase() === sourceFilter.toLowerCase();
    return matchesSearch && matchesBuilding && matchesSource;
  }), [readings, search, buildingFilter, sourceFilter]);

  const title = {
    overview:['Campus overview','A measured look at the campus footprint.'],
    energy:['Energy analytics','Find the rhythm behind campus consumption.'],
    buildings:['Building performance','Compare sites, spot heavy usage, and focus attention.'],
    readings:['Readings ledger','Every stored record, searchable and exportable.'],
    alerts:['Anomaly review','A lightweight review queue for unusual readings.'],
    database:['Database explorer','Inspect the rows and aggregates returned by MonetDB.'],
    reports:['Reports & savings','Turn usage patterns into practical next steps.']
  }[page] || ['Campus overview','A measured look at the campus footprint.'];

  async function addReading(e) {
    e.preventDefault(); setAdding(true); setError('');
    try {
      await api('/readings', {method:'POST', body:JSON.stringify({...form, energyKwh:Number(form.energyKwh)})});
      setSuccess('Reading saved to MonetDB.');
      setForm(defaultForm());
      await load(true);
      setPage('readings');
    } catch (e) { setError(e.message); }
    finally { setAdding(false); }
  }

  function exportCsv(rows = filteredReadings, filename = 'campuspulse-readings.csv') {
    if (!rows.length) { setError('There are no rows to export with the current filters.'); return; }
    const columns = ['id','building','recordedAt','energyKwh','source'];
    const csv = [columns.join(','), ...rows.map(row => columns.map(k => `"${String(row[k] ?? '').replaceAll('"','""')}"`).join(','))].join('\r\n');
    const blob = new Blob(['\ufeff' + csv], {type:'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
    setSuccess(`Exported ${rows.length} row${rows.length === 1 ? '' : 's'} to CSV.`);
  }

  function reviewAlert(alert) {
    const key = `${alert.building}|${alert.recordedAt}|${alert.energyKwh}`;
    const next = alertReviewed.includes(key) ? alertReviewed.filter(k => k !== key) : [...alertReviewed, key];
    setAlertReviewed(next);
    localStorage.setItem('campuspulse-reviewed', JSON.stringify(next));
  }

  async function deleteReading(id) {
    try {
      await api(`/readings/${id}`, {method:'DELETE'});
      setDeleteTarget(null); setSuccess('Manual reading deleted from MonetDB.'); await load(true);
    } catch (e) { setError(e.message); setDeleteTarget(null); }
  }

  const unreadAlerts = alerts.filter(a => !alertReviewed.includes(`${a.building}|${a.recordedAt}|${a.energyKwh}`)).length;
  const activeNav = (id) => { setPage(id); setMobileOpen(false); setError(''); setSuccess(''); };

  return <div className="app-shell">
    <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
      <div className="brand-row">
        <div className="brand-mark"><span className="brand-leaf"><Activity size={19}/></span></div>
        <div className="brand-copy"><strong>campus<span>pulse</span></strong><small>OPERATIONS STUDIO</small></div>
        <button className="mobile-close icon-button" aria-label="Close menu" onClick={() => setMobileOpen(false)}><X size={17}/></button>
      </div>
      <div className="campus-selector"><div className="campus-monogram">V</div><div><strong>Campus / Demo</strong><small>Energy programme</small></div><ChevronDown size={14}/></div>
      {['CAMPUS','DATA','TOOLS'].map(group => <div className="nav-group" key={group}>
        <div className="nav-caption">{group}</div>
        {navItems.filter(item => item.group === group).map(item => {
          const Icon = item.icon;
          return <button key={item.id} className={`nav-item ${page === item.id ? 'active' : ''}`} onClick={() => activeNav(item.id)}>
            <Icon size={17} strokeWidth={1.8}/><span>{item.label}</span>
            {item.id === 'alerts' && unreadAlerts > 0 && <span className="nav-count">{unreadAlerts}</span>}
          </button>;
        })}
      </div>)}
      <div className="sidebar-spacer"/>
      <div className="sidebar-tip"><div className="tip-icon"><Leaf size={17}/></div><div><strong>Small changes add up.</strong><p>Track patterns before they become waste.</p></div></div>
      <div className="connection-card">
        <span className={`connection-dot ${health.status}`}/><div className="connection-copy"><strong>{health.status === 'online' ? 'MonetDB connected' : health.status === 'checking' ? 'Checking database…' : 'Database unavailable'}</strong><small>{health.status === 'online' ? 'Live query connection' : health.status === 'checking' ? 'Checking API health' : 'Check backend & database'}</small></div>
        <button className="tiny-refresh" title="Check connection again" onClick={() => load(true)}><RefreshCw size={14}/></button>
      </div>
      <div className="sidebar-foot">CAMPUSPULSE <span>·</span> BUILD 02</div>
    </aside>

    {mobileOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMobileOpen(false)}/>}
    <main className="main-content">
      <header className="topbar">
        <div className="topbar-left"><button className="mobile-menu icon-button" aria-label="Open menu" onClick={() => setMobileOpen(true)}><Menu size={20}/></button><div className="breadcrumb">CAMPUS OPERATIONS <span>/</span> {page.toUpperCase()}</div><h1>{title[0]}</h1><p className="page-subtitle">{title[1]}</p></div>
        <div className="topbar-actions"><div className={`status-chip ${health.status}`}><span className="connection-dot"/>{health.status === 'online' ? 'Database online' : health.status === 'checking' ? 'Checking' : 'Offline'}</div><button className="button button-quiet" onClick={() => load()} disabled={loading}><RefreshCw size={15} className={loading ? 'spin' : ''}/><span>{loading ? 'Refreshing' : 'Refresh'}</span></button></div>
      </header>

      <div className="notice-strip"><div className="notice-icon"><Database size={16}/></div><div><strong>Academic demonstration dataset</strong><span>All included readings are labelled sample data. No live campus meters are connected.</span></div><span className="notice-tag">SIMULATED</span></div>
      {error && <div className="toast toast-error" role="alert"><AlertTriangle size={17}/><span>{error}</span><button aria-label="Dismiss error" onClick={() => setError('')}><X size={15}/></button></div>}
      {success && <div className="toast toast-success" role="status"><Check size={17}/><span>{success}</span><button aria-label="Dismiss message" onClick={() => setSuccess('')}><X size={15}/></button></div>}

      {page === 'overview' && <Overview summary={summary} buildings={buildings} hourly={hourly} readings={readings} alerts={alerts} loading={loading} onNavigate={activeNav} onExport={() => exportCsv(readings,'campuspulse-latest-readings.csv')}/>}
      {page === 'energy' && <EnergyPage buildings={buildings} hourly={hourly} readings={readings} onExport={() => exportCsv(readings,'campuspulse-energy-readings.csv')}/>}
      {page === 'buildings' && <BuildingsPage buildings={buildings} readings={readings} onNavigate={activeNav}/>}
      {page === 'readings' && <ReadingsPage readings={filteredReadings} allCount={readings.length} search={search} setSearch={setSearch} buildingFilter={buildingFilter} setBuildingFilter={setBuildingFilter} sourceFilter={sourceFilter} setSourceFilter={setSourceFilter} onExport={() => exportCsv()} onDelete={setDeleteTarget} form={form} setForm={setForm} onSubmit={addReading} adding={adding} loading={loading}/>}
      {page === 'alerts' && <AlertsPage alerts={alerts} reviewed={alertReviewed} onReview={reviewAlert} onNavigate={activeNav}/>}
      {page === 'database' && <DatabasePage readings={readings} summary={summary} buildings={buildings} loading={loading} onExport={() => exportCsv(readings,'campuspulse-database-export.csv')} onNavigate={activeNav}/>}
      {page === 'reports' && <ReportsPage summary={summary} buildings={buildings} readings={readings} hourly={hourly} onExport={() => exportCsv(readings,'campuspulse-campus-report.csv')} onNavigate={activeNav}/>}
      <footer className="app-footer"><div><span className="footer-mark"><Activity size={14}/></span><strong>CampusPulse</strong><span>Campus energy, made visible.</span></div><span>React · Express · MonetDB <i>•</i> Academic prototype</span></footer>
    </main>
    {deleteTarget && <div className="modal-backdrop" role="presentation" onMouseDown={e => {if(e.target === e.currentTarget) setDeleteTarget(null);}}><section className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="delete-title"><div className="modal-icon"><Trash2 size={21}/></div><h2 id="delete-title">Delete this reading?</h2><p>This removes the selected manual reading from MonetDB. Seeded sample readings cannot be deleted from this screen.</p><div className="modal-actions"><button className="button button-quiet" onClick={() => setDeleteTarget(null)}>Cancel</button><button className="button button-danger" onClick={() => deleteReading(deleteTarget)}>Delete reading</button></div></section></div>}
  </div>;
}

function MetricCard({icon:Icon,label,value,detail,accent='moss',trend}) {
  return <article className={`metric-card accent-${accent}`}><div className="metric-top"><span className="metric-icon"><Icon size={18} strokeWidth={1.8}/></span>{trend && <span className="metric-trend">{trend}</span>}</div><p className="metric-label">{label}</p><div className="metric-value">{value ?? '—'}</div><p className="metric-detail">{detail}</p></article>;
}
function PanelHeading({title,subtitle,action}) { return <div className="panel-heading"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{action}</div>; }
function Empty({loading=false, text='No records to show yet.'}) { return <div className="empty-state"><div className="empty-illustration"><Database size={22}/></div><strong>{loading ? 'Loading records…' : text}</strong><span>{loading ? 'Fetching results from MonetDB.' : 'Try refreshing or adding a reading.'}</span></div>; }
function ChartTooltip({active,payload,label}) { if (!active || !payload?.length) return null; return <div className="chart-tooltip"><strong>{label}</strong>{payload.map((p,i)=><div key={i}><span style={{background:p.color || p.fill}}/>{p.name}: <b>{fmt(p.value)} kWh</b></div>)}</div>; }
function Overview({summary,buildings,hourly,readings,alerts,loading,onNavigate,onExport}) {
  const peak = [...buildings].sort((a,b)=>Number(b.totalKwh)-Number(a.totalKwh))[0];
  return <>
    <div className="section-intro"><div><span className="section-kicker">AT A GLANCE <span>—</span> 01</span><h2>Today's campus, <em>in context.</em></h2><p>A practical snapshot of recorded energy usage across the demo campus.</p></div><button className="button button-outline" onClick={onExport}><Download size={15}/> Export readings</button></div>
    <section className="metrics-grid">
      <MetricCard icon={Zap} label="Energy recorded" value={`${fmt(summary?.totalKwh)} kWh`} detail="Sum of all stored readings" accent="moss"/>
      <MetricCard icon={Building2} label="Buildings monitored" value={fmt(summary?.buildings,0)} detail="Distinct campus locations" accent="clay"/>
      <MetricCard icon={Table2} label="Stored readings" value={fmt(summary?.readings,0)} detail="Rows returned by MonetDB" accent="blue"/>
      <MetricCard icon={Gauge} label="Average reading" value={`${fmt(summary?.averageKwh)} kWh`} detail="Mean per stored record" accent="gold"/>
    </section>
    <section className="overview-grid">
      <article className="panel panel-large"><PanelHeading title="Where the energy goes" subtitle="Total recorded kWh by campus building" action={<button className="text-link" onClick={() => onNavigate('buildings')}>Building details <ArrowUpRight size={14}/></button>}/><div className="chart-wrap chart-tall">{buildings.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={buildings} margin={{top:18,right:12,left:-16,bottom:4}}><CartesianGrid strokeDasharray="2 6" vertical={false} stroke="#e7e4dc"/><XAxis dataKey="building" tick={{fill:'#787c73',fontSize:11}} axisLine={false} tickLine={false}/><YAxis tick={{fill:'#787c73',fontSize:10}} axisLine={false} tickLine={false}/><Tooltip content={<ChartTooltip/>}/><Bar dataKey="totalKwh" name="Energy" radius={[5,5,0,0]} maxBarSize={56}>{buildings.map((b,i)=><Cell key={b.building} fill={buildingColors[i%buildingColors.length]}/>)}</Bar></BarChart></ResponsiveContainer> : <Empty loading={loading}/>}</div><div className="chart-footnote"><span className="legend-dot moss-dot"/> <span>Consumption accumulated across stored readings</span><span className="footnote-spacer"/><span>{readings.length} rows in dataset</span></div></article>
      <article className="panel"><PanelHeading title="Reading rhythm" subtitle="Average reading by hour of day" action={<span className="mini-unit">kWh</span>}/><div className="chart-wrap chart-tall">{hourly.length ? <ResponsiveContainer width="100%" height="100%"><LineChart data={hourly} margin={{top:18,right:8,left:-18,bottom:4}}><CartesianGrid strokeDasharray="2 6" vertical={false} stroke="#e7e4dc"/><XAxis dataKey="label" tick={{fill:'#787c73',fontSize:10}} axisLine={false} tickLine={false} interval="preserveStartEnd"/><YAxis tick={{fill:'#787c73',fontSize:10}} axisLine={false} tickLine={false}/><Tooltip content={<ChartTooltip/>}/><Line type="monotone" dataKey="averageKwh" name="Average" stroke="#c56b43" strokeWidth={2.4} dot={{r:3,fill:'#c56b43',strokeWidth:0}} activeDot={{r:5}}/></LineChart></ResponsiveContainer> : <Empty loading={loading}/>}</div><div className="insight-note"><span className="insight-mark"><Activity size={15}/></span><div><strong>{peak ? `${peak.building} has the highest total` : 'Waiting for readings'}</strong><p>{peak ? `${fmt(peak.totalKwh)} kWh recorded in this dataset. Compare the buildings to spot opportunities.` : 'Once data is available, building comparisons will appear here.'}</p></div></div></article>
    </section>
    <section className="overview-bottom">
      <article className="panel"><PanelHeading title="Latest records" subtitle="Most recent entries from the database" action={<button className="text-link" onClick={() => onNavigate('readings')}>Open ledger <ArrowUpRight size={14}/></button>}/><ReadingsTable rows={readings.slice(0,6)} loading={loading} compact/></article>
      <article className="panel"><PanelHeading title="Needs a closer look" subtitle="Readings above 1.7× their building average" action={<span className="alert-count">{alerts.length} flagged</span>}/>{alerts.length ? <div className="alert-preview">{alerts.slice(0,4).map((a,i)=><div className="alert-preview-row" key={`${a.building}-${a.recordedAt}-${i}`}><span className="alert-symbol"><AlertTriangle size={15}/></span><div className="alert-preview-copy"><strong>{a.building}</strong><small>{dateLabel(a.recordedAt)} · {fmt(a.energyKwh)} kWh</small></div><span className="severity-tag">Review</span></div>)}<button className="text-link alert-open" onClick={() => onNavigate('alerts')}>Review flagged readings <ArrowUpRight size={14}/></button></div> : <Empty text="No unusual readings flagged."/>}</article>
    </section>
  </>;
}
function EnergyPage({buildings,hourly,readings,onExport}) {
  const total = readings.reduce((s,r)=>s+Number(r.energyKwh||0),0);
  const peak = [...hourly].sort((a,b)=>b.averageKwh-a.averageKwh)[0];
  return <><div className="section-intro"><div><span className="section-kicker">ANALYSIS <span>—</span> 02</span><h2>Understand the <em>load curve.</em></h2><p>Read patterns by hour and compare accumulated consumption.</p></div><button className="button button-outline" onClick={onExport}><Download size={15}/> Export CSV</button></div>
    <div className="metrics-grid three-metrics"><MetricCard icon={Zap} label="Energy in current dataset" value={`${fmt(total)} kWh`} detail="Calculated from visible readings"/><MetricCard icon={Clock3} label="Hours represented" value={fmt(hourly.length,0)} detail="Distinct hours with records" accent="clay"/><MetricCard icon={ArrowUpRight} label="Highest hourly average" value={peak ? `${fmt(peak.averageKwh)} kWh` : '—'} detail={peak ? `Observed at ${peak.label}` : 'No hourly data yet'} accent="gold"/></div>
    <div className="single-chart-grid"><article className="panel"><PanelHeading title="Hourly consumption profile" subtitle="Average energy reading for each hour represented in the data"/><div className="chart-wrap chart-extra-tall">{hourly.length ? <ResponsiveContainer width="100%" height="100%"><LineChart data={hourly} margin={{top:20,right:20,left:0,bottom:5}}><CartesianGrid strokeDasharray="3 6" vertical={false} stroke="#e7e4dc"/><XAxis dataKey="label" tick={{fill:'#787c73',fontSize:11}} axisLine={false} tickLine={false}/><YAxis tick={{fill:'#787c73',fontSize:11}} axisLine={false} tickLine={false}/><Tooltip content={<ChartTooltip/>}/><Line type="monotone" dataKey="averageKwh" name="Average" stroke="#2f6b4f" strokeWidth={3} dot={{r:4,fill:'#f5f3ed',stroke:'#2f6b4f',strokeWidth:2}} activeDot={{r:6}}/></LineChart></ResponsiveContainer> : <Empty/>}</div></article></div>
    <article className="panel"><PanelHeading title="Building energy comparison" subtitle="Totals and average reading for each location"/><div className="building-cards">{buildings.map((b,i)=><div className="building-card" key={b.building}><div className="building-card-top"><span className="building-index">0{i+1}</span><span className="building-swatch" style={{background:buildingColors[i%buildingColors.length]}}/></div><h3>{b.building}</h3><div className="building-energy">{fmt(b.totalKwh)} <small>kWh</small></div><div className="progress-track"><span style={{width:`${Math.max(2,total?Number(b.totalKwh)/total*100:0)}%`,background:buildingColors[i%buildingColors.length]}}/></div><div className="building-card-foot"><span>{fmt(b.readings,0)} readings</span><span>Avg {fmt(b.averageKwh)} kWh</span></div></div>)}</div></article>
  </>;
}
function BuildingsPage({buildings,readings,onNavigate}) {
  const [selected,setSelected] = useState('All buildings');
  const visible = selected === 'All buildings' ? buildings : buildings.filter(b=>b.building===selected);
  return <><div className="section-intro"><div><span className="section-kicker">CAMPUS DIRECTORY <span>—</span> 03</span><h2>Every building tells a <em>story.</em></h2><p>Review recorded consumption by location. Values are aggregated from MonetDB.</p></div><label className="select-control"><Filter size={14}/><select value={selected} onChange={e=>setSelected(e.target.value)}><option>All buildings</option>{buildings.map(b=><option key={b.building}>{b.building}</option>)}</select></label></div>
    <div className="building-cards building-cards-large">{visible.map((b,i)=>{const rows=readings.filter(r=>r.building===b.building);const latest=rows[0];const share=buildings.reduce((s,x)=>s+Number(x.totalKwh),0)?Number(b.totalKwh)/buildings.reduce((s,x)=>s+Number(x.totalKwh),0)*100:0;return <article className="building-detail-card" key={b.building}><div className="building-detail-head"><span className="building-swatch" style={{background:buildingColors[i%buildingColors.length]}}/><span className="building-type">CAMPUS LOCATION</span><span className="building-number">0{i+1}</span></div><h2>{b.building}</h2><p className="building-card-sub">Energy summary from recorded readings</p><div className="building-detail-value">{fmt(b.totalKwh)} <small>kWh</small></div><div className="progress-track thick"><span style={{width:`${share}%`,background:buildingColors[i%buildingColors.length]}}/></div><div className="share-label"><span>{fmt(share)}% of total recorded energy</span><span>{fmt(b.readings,0)} records</span></div><div className="building-detail-stats"><div><small>Average per reading</small><strong>{fmt(b.averageKwh)} kWh</strong></div><div><small>Latest entry</small><strong>{latest ? dateLabel(latest.recordedAt) : '—'}</strong></div></div><button className="button button-outline full-button" onClick={()=>{onNavigate('readings');}}>View in readings ledger <ArrowUpRight size={14}/></button></article>;})}{!visible.length&&<Empty text="No building data is available yet."/>}</div>
    <div className="panel callout-panel"><div className="callout-icon"><CircleHelp size={19}/></div><div><h3>How should I read these numbers?</h3><p>These totals sum the readings in the demonstration dataset. They are not verified building-wide electricity bills, because each row represents a sample interval reading.</p></div></div>
  </>;
}
function ReadingsTable({rows,loading,compact=false,onDelete}) {
  return <div className="table-scroll"><table className="data-table"><thead><tr><th>BUILDING</th><th>RECORDED AT</th><th>ENERGY</th><th>SOURCE</th>{onDelete&&<th>MANAGE</th>}</tr></thead><tbody>{rows.map(r=><tr key={r.id}><td><span className="building-name"><span className="building-swatch small" style={{background:buildingColors[Math.max(0,['Library','Academic Block','Hostel'].indexOf(r.building))%buildingColors.length]}}/>{r.building}</span></td><td>{dateLabel(r.recordedAt)}</td><td className="number-cell">{fmt(r.energyKwh)} kWh</td><td><span className={`source-pill ${r.source==='manual'?'source-manual':''}`}>{r.source || 'unknown'}</span></td>{onDelete&&<td>{r.source==='manual'?<button className="table-action danger-action" title="Delete manual reading" aria-label={`Delete reading ${r.id}`} onClick={()=>onDelete(r.id)}><Trash2 size={14}/></button>:<span className="muted-dash">—</span>}</td>}</tr>)}{!rows.length&&<tr><td colSpan={onDelete?5:4}><Empty loading={loading} text="No matching readings found."/></td></tr>}</tbody></table>{!compact&&rows.length>0&&<div className="table-bottom-note">Showing {rows.length} records from the current result set.</div>}</div>;
}
function ReadingsPage({readings,allCount,search,setSearch,buildingFilter,setBuildingFilter,sourceFilter,setSourceFilter,onExport,onDelete,form,setForm,onSubmit,adding,loading}) {
  return <><div className="section-intro"><div><span className="section-kicker">DATA REGISTER <span>—</span> 04</span><h2>The readings <em>ledger.</em></h2><p>Search, filter, add and export records stored in MonetDB.</p></div><button className="button button-outline" onClick={onExport}><Download size={15}/> Export filtered CSV</button></div>
    <article className="panel"><div className="ledger-toolbar"><div className="search-field"><Search size={16}/><input aria-label="Search readings" placeholder="Search building, source, date…" value={search} onChange={e=>setSearch(e.target.value)}/>{search&&<button aria-label="Clear search" onClick={()=>setSearch('')}><X size={14}/></button>}</div><label className="select-control"><Building2 size={14}/><select value={buildingFilter} onChange={e=>setBuildingFilter(e.target.value)}><option>All buildings</option><option>Library</option><option>Academic Block</option><option>Hostel</option></select></label><label className="select-control"><Filter size={14}/><select value={sourceFilter} onChange={e=>setSourceFilter(e.target.value)}><option>All sources</option><option>simulated</option><option>manual</option></select></label></div><div className="ledger-count">{readings.length} results <span>of {allCount} total records</span></div><ReadingsTable rows={readings} loading={loading} onDelete={onDelete}/></article>
    <article className="panel add-reading-panel"><PanelHeading title="Add a reading" subtitle="Save a manual or demonstration reading directly to MonetDB." action={<span className="mini-unit"><Plus size={13}/> NEW ENTRY</span>}/><form className="reading-form" onSubmit={onSubmit}><label>Building<select value={form.building} onChange={e=>setForm({...form,building:e.target.value})}><option>Library</option><option>Academic Block</option><option>Hostel</option></select></label><label>Date and time<input type="datetime-local" value={form.recordedAt} onChange={e=>setForm({...form,recordedAt:e.target.value})} required/></label><label>Energy (kWh)<input type="number" min="0" max="1000000" step="0.1" value={form.energyKwh} onChange={e=>setForm({...form,energyKwh:e.target.value})} required/></label><button className="button button-primary" type="submit" disabled={adding}><Plus size={15}/>{adding?'Saving…':'Save to database'}</button></form><p className="form-note"><ShieldCheck size={14}/> Saved records are tagged <code>manual</code>. Demo readings are tagged <code>simulated</code>.</p></article>
  </>;
}
function AlertsPage({alerts,reviewed,onReview,onNavigate}) {
  const [filter,setFilter] = useState('Needs review');
  const visible = alerts.filter(a=>{const key=`${a.building}|${a.recordedAt}|${a.energyKwh}`;return filter==='All alerts'||(filter==='Needs review'?!reviewed.includes(key):reviewed.includes(key));});
  return <><div className="section-intro"><div><span className="section-kicker">REVIEW QUEUE <span>—</span> 05</span><h2>Signals, not <em>verdicts.</em></h2><p>Review readings that are unusually high compared with their building's average.</p></div><label className="select-control"><Filter size={14}/><select value={filter} onChange={e=>setFilter(e.target.value)}><option>Needs review</option><option>Reviewed</option><option>All alerts</option></select></label></div>
    <div className="alert-summary-strip"><div><span className="alert-summary-number">{alerts.length}</span><span>Total flagged</span></div><div><span className="alert-summary-number">{alerts.length-reviewed.length}</span><span>Awaiting review*</span></div><div><span className="alert-summary-number">{reviewed.length}</span><span>Marked reviewed*</span></div><p>*Review state is saved in this browser, not in MonetDB.</p></div>
    <article className="panel"><PanelHeading title="Flagged readings" subtitle="Rule: reading exceeds 1.7 times that building's average"/>{visible.length ? <div className="review-list">{visible.map((a,i)=>{const key=`${a.building}|${a.recordedAt}|${a.energyKwh}`;const isReviewed=reviewed.includes(key);const ratio=a.buildingAverage?Number(a.energyKwh)/Number(a.buildingAverage):0;return <div className={`review-row ${isReviewed?'is-reviewed':''}`} key={`${key}-${i}`}><div className="review-symbol">{isReviewed?<Check size={18}/>:<AlertTriangle size={18}/>}</div><div className="review-main"><div className="review-title-row"><strong>{a.building}</strong><span className={`severity-tag ${isReviewed?'reviewed-tag':''}`}>{isReviewed?'Reviewed':'Investigate'}</span></div><p>{dateLabel(a.recordedAt)} · {fmt(a.energyKwh)} kWh recorded</p><div className="comparison-track"><span style={{width:`${Math.min(100,ratio/3*100)}%`}}/></div><small>{fmt(ratio,2)}× the building average ({fmt(a.buildingAverage)} kWh)</small></div><button className={`button ${isReviewed?'button-quiet':'button-outline'}`} onClick={()=>onReview(a)}>{isReviewed?'Undo review':'Mark reviewed'}</button></div>;})}</div>:<Empty text={alerts.length?'No alerts match this filter.':'No unusual readings have been flagged.'}/>}</article>
    <div className="panel callout-panel"><div className="callout-icon"><CircleHelp size={19}/></div><div><h3>An alert is a prompt to investigate.</h3><p>The threshold is intentionally simple for this academic prototype. A flagged reading can have a legitimate cause and is not proof of equipment failure.</p><button className="text-link" onClick={()=>onNavigate('energy')}>Explore energy patterns <ArrowUpRight size={14}/></button></div></div>
  </>;
}
function DatabasePage({readings,summary,buildings,loading,onExport,onNavigate}) {
  const [table,setTable] = useState('energy_readings');
  const [sqlView,setSqlView] = useState(false);
  const columns = [
    {name:'reading_id',type:'INT',description:'Record identifier'},
    {name:'building_name',type:'VARCHAR(80)',description:'Campus location'},
    {name:'recorded_at',type:'TIMESTAMP',description:'Date and time of reading'},
    {name:'energy_kwh',type:'DOUBLE',description:'Recorded energy value'},
    {name:'data_source',type:'VARCHAR(20)',description:'simulated or manual'}
  ];
  const queryText = table==='energy_readings' ? 'SELECT reading_id, building_name, recorded_at, energy_kwh, data_source\\nFROM energy_readings\\nORDER BY recorded_at DESC;' : 'SELECT building_name, SUM(energy_kwh) AS total_kwh, AVG(energy_kwh) AS average_kwh\\nFROM energy_readings\\nGROUP BY building_name\\nORDER BY total_kwh DESC;';
  return <><div className="section-intro"><div><span className="section-kicker">MONETDB WORKSPACE <span>—</span> 06</span><h2>Under the <em>surface.</em></h2><p>A transparent view of the schema and rows queried from the database.</p></div><button className="button button-outline" onClick={onExport}><Download size={15}/> Export table data</button></div>
    <div className="db-overview-cards"><div className="db-overview-card"><Database size={18}/><span>DATABASE</span><strong>MonetDB</strong><small>Relational analytical database</small></div><div className="db-overview-card"><Table2 size={18}/><span>TABLE</span><strong>energy_readings</strong><small>{fmt(summary?.readings,0)} rows returned</small></div><div className="db-overview-card"><Wifi size={18}/><span>QUERY STATUS</span><strong>{loading?'Fetching…':'Response received'}</strong><small>Via Express REST API</small></div></div>
    <article className="panel schema-panel"><PanelHeading title="Table structure" subtitle="Schema used by CampusPulse"/><div className="schema-table"><div className="schema-head"><span>FIELD</span><span>TYPE</span><span>DESCRIPTION</span></div>{columns.map((c,i)=><div className="schema-row" key={c.name}><span><span className="schema-key">{i===0?'PK':i===1?'TXT':'COL'}</span><strong>{c.name}</strong></span><code>{c.type}</code><span>{c.description}</span></div>)}</div></article>
    <article className="panel"><div className="db-query-toolbar"><PanelHeading title={table==='energy_readings'?'Stored records':'Building aggregate view'} subtitle="Result preview from the latest API response"/><label className="select-control"><Table2 size={14}/><select value={table} onChange={e=>setTable(e.target.value)}><option value="energy_readings">energy_readings</option><option value="building_summary">building summary</option></select></label></div><div className="query-preview"><div className="query-preview-head"><span><span className="query-dot"/> SQL EXAMPLE</span><button className="text-link" onClick={()=>setSqlView(v=>!v)}>{sqlView?'Hide SQL':'Show SQL'} <ChevronDown size={13}/></button></div>{sqlView&&<pre>{queryText}</pre>}</div>{table==='energy_readings'?<ReadingsTable rows={readings.slice(0,20)} loading={loading} compact/>:<div className="table-scroll"><table className="data-table"><thead><tr><th>BUILDING</th><th>TOTAL KWH</th><th>AVERAGE KWH</th><th>READINGS</th></tr></thead><tbody>{buildings.map(b=><tr key={b.building}><td>{b.building}</td><td className="number-cell">{fmt(b.totalKwh)}</td><td>{fmt(b.averageKwh)}</td><td>{fmt(b.readings,0)}</td></tr>)}</tbody></table></div>}<div className="database-note"><Database size={15}/><p>This page displays records returned by the backend. For the live schema and unrestricted SQL tools, connect DBeaver directly to your MonetDB server.</p></div></article><button className="text-link standalone-link" onClick={()=>onNavigate('readings')}>Open full readings ledger <ArrowUpRight size={14}/></button>
  </>;
}
function ReportsPage({summary,buildings,readings,hourly,onExport,onNavigate}) {
  const [tariff,setTariff] = useState('8');
  const [target,setTarget] = useState(10);
  const total = Number(summary?.totalKwh || 0);
  const price = Math.max(0,Number(tariff)||0);
  const savings = total*target/100*price;
  const biggest = [...buildings].sort((a,b)=>Number(b.totalKwh)-Number(a.totalKwh))[0];
  const highestHour = [...hourly].sort((a,b)=>b.averageKwh-a.averageKwh)[0];
  return <><div className="section-intro"><div><span className="section-kicker">DECISION SUPPORT <span>—</span> 07</span><h2>From readings to <em>action.</em></h2><p>Explore a transparent savings scenario and prepare a small campus report.</p></div><button className="button button-outline" onClick={onExport}><Download size={15}/> Download report data</button></div>
    <div className="report-hero"><div className="report-hero-copy"><span className="report-label"><Leaf size={14}/> SAVINGS SCENARIO</span><h2>What if the campus used <em>less?</em></h2><p>Adjust the reduction target and electricity tariff to estimate a potential saving on the recorded dataset.</p><div className="report-big-number">₹{fmt(savings,0)}<small> estimated savings</small></div><span className="report-disclaimer">Illustrative calculation · Not a forecast or audited bill</span></div><div className="report-controls"><label className="range-label">Usage reduction <strong>{target}%</strong></label><input type="range" min="0" max="30" step="5" value={target} onChange={e=>setTarget(Number(e.target.value))}/><div className="range-labels"><span>0%</span><span>30%</span></div><label className="field-label" htmlFor="tariff">Electricity tariff (₹ per kWh)</label><div className="currency-input"><span>₹</span><input id="tariff" type="number" min="0" max="1000" step="0.5" value={tariff} onChange={e=>setTariff(e.target.value)}/></div><div className="scenario-math">{fmt(total)} kWh × {target}% × ₹{fmt(price,2)}</div></div></div>
    <div className="report-columns"><article className="panel"><PanelHeading title="Executive summary" subtitle="Generated from current database results"/><div className="report-facts"><div><span className="fact-number">{fmt(summary?.readings,0)}</span><span>readings analysed</span></div><div><span className="fact-number">{fmt(summary?.buildings,0)}</span><span>buildings represented</span></div><div><span className="fact-number">{fmt(total)} kWh</span><span>energy sum</span></div></div><p className="report-paragraph">{biggest?`${biggest.building} has the largest accumulated total in this sample (${fmt(biggest.totalKwh)} kWh). `:''}{highestHour?`The highest average among hours represented is ${highestHour.label} (${fmt(highestHour.averageKwh)} kWh). `:''}Use these patterns as starting points for a conversation with campus facilities staff, not as proof of waste.</p><button className="button button-primary" onClick={onExport}><Download size={15}/> Export records for report</button></article><article className="panel next-steps-panel"><PanelHeading title="Suggested next steps" subtitle="A practical follow-up list"/><div className="next-step"><span>01</span><div><strong>Validate against meter data</strong><p>Replace the demonstration readings with authorised, real readings when available.</p></div></div><div className="next-step"><span>02</span><div><strong>Review unusual periods</strong><p>Check flagged spikes against building schedules and equipment usage.</p></div></div><div className="next-step"><span>03</span><div><strong>Compare like with like</strong><p>Compare buildings across equivalent time windows before making decisions.</p></div></div><button className="text-link" onClick={()=>onNavigate('alerts')}>Open anomaly review <ArrowUpRight size={14}/></button></article></div>
  </>;
}
