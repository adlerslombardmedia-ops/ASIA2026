import React, { useEffect, useState } from 'react';
import * as db from '../lib/db';
import { toast } from '../lib/hooks';

const EMPTY = { name: '', link_url: '', logo_url: '', tier: 1, sort_order: 0 };

// Admin → Sponsors: add / edit / remove sponsor logos with an outbound link.
export default function SponsorsPanel() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [missingTable, setMissingTable] = useState(false);

  const reload = async () => {
    try {
      setRows(await db.fetchSponsors());
      setMissingTable(false);
    } catch (e) {
      if (/sponsors/.test(e.message || '') || e.code === '42P01' || e.code === 'PGRST205') setMissingTable(true);
      else toast(e.message || 'Could not load sponsors', 'error');
    } finally { setLoading(false); }
  };
  useEffect(() => { reload(); }, []);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const url = await db.uploadSponsorLogo(file);
      setForm(f => ({ ...f, logo_url: url }));
      toast('Logo ready', 'success');
    } catch (err) { toast(err.message || 'Upload failed', 'error'); }
    setBusy(false);
  };

  const save = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast('Sponsor name is required', 'error');
    if (!form.logo_url) return toast('Please add a logo (upload or URL)', 'error');
    setBusy(true);
    try {
      const payload = { ...form, tier: Number(form.tier) || 1, sort_order: Number(form.sort_order) || 0 };
      if (editId) payload.id = editId;
      await db.upsertSponsor(payload);
      toast(editId ? 'Sponsor updated' : 'Sponsor added', 'success');
      setForm(EMPTY); setEditId(null);
      await reload();
    } catch (err) { toast(err.message || 'Save failed', 'error'); }
    setBusy(false);
  };

  const edit = (s) => { setEditId(s.id); setForm({ name: s.name || '', link_url: s.link_url || '', logo_url: s.logo_url || '', tier: s.tier || 1, sort_order: s.sort_order || 0 }); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const remove = async (s) => {
    if (!confirm(`Remove ${s.name}?`)) return;
    try { await db.deleteSponsor(s.id); toast('Sponsor removed', 'success'); await reload(); }
    catch (err) { toast(err.message || 'Delete failed', 'error'); }
  };

  const input = { width: '100%', marginBottom: 10 };

  return (
    <div style={{ padding: 16 }} className="animate-fade">
      <div className="section-header" style={{ padding: '0 0 12px' }}>
        <h2 className="section-title">Sponsors</h2>
      </div>

      {missingTable && (
        <div className="kcard" style={{ padding: 14, marginBottom: 14, border: '1px solid var(--gold-deep)' }}>
          <div style={{ fontWeight: 800, color: 'var(--gold)', marginBottom: 6 }}>One-time setup needed</div>
          <div style={{ fontSize: '0.82rem', color: 'var(--text2)' }}>
            The <code>sponsors</code> table does not exist in your database yet. Run the SQL in <code>db/sponsors.sql</code> once, then reload this page.
          </div>
        </div>
      )}

      <form onSubmit={save} className="kcard" style={{ padding: 14, marginBottom: 18 }}>
        <div style={{ fontWeight: 800, fontSize: '0.85rem', marginBottom: 10, color: 'var(--gold)' }}>{editId ? 'Edit sponsor' : 'Add a sponsor'}</div>
        <input style={input} placeholder="Sponsor name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
        <input style={input} placeholder="Instagram or website link (https://…)" value={form.link_url} onChange={e => setForm({ ...form, link_url: e.target.value })} />
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
          <div style={{ width: 64, height: 64, borderRadius: 10, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
            {form.logo_url ? <img src={form.logo_url} alt="" style={{ maxWidth: '90%', maxHeight: '90%', objectFit: 'contain' }} /> : <span style={{ color: '#999', fontSize: '0.6rem' }}>LOGO</span>}
          </div>
          <div style={{ flex: 1 }}>
            <input type="file" accept="image/*" onChange={onFile} disabled={busy} style={{ marginBottom: 6 }} />
            <input placeholder="…or paste a logo image URL" value={form.logo_url.startsWith('data:') ? '' : form.logo_url} onChange={e => setForm({ ...form, logo_url: e.target.value })} style={{ width: '100%' }} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
          <label style={{ flex: 1, fontSize: '0.75rem', color: 'var(--text2)' }}>Size
            <select value={form.tier} onChange={e => setForm({ ...form, tier: e.target.value })} style={{ width: '100%', marginTop: 4 }}>
              <option value={1}>Large (main sponsor)</option>
              <option value={2}>Small</option>
            </select>
          </label>
          <label style={{ width: 110, fontSize: '0.75rem', color: 'var(--text2)' }}>Order
            <input type="number" value={form.sort_order} onChange={e => setForm({ ...form, sort_order: e.target.value })} style={{ width: '100%', marginTop: 4 }} />
          </label>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit" className="btn btn-gold" disabled={busy}>{editId ? 'Save changes' : 'Add sponsor'}</button>
          {editId && <button type="button" className="btn btn-dark" onClick={() => { setEditId(null); setForm(EMPTY); }}>Cancel</button>}
        </div>
      </form>

      {loading ? <div style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>Loading…</div> : rows.length === 0 ? (
        <div style={{ color: 'var(--muted)', fontSize: '0.85rem', textAlign: 'center', padding: 20 }}>No sponsors yet. The site shows the built-in sponsor list until you add some.</div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {rows.map(s => (
            <div key={s.id} className="kcard" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 10 }}>
              <div style={{ width: 56, height: 56, borderRadius: 8, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                <img src={s.logo_url} alt={s.name} style={{ maxWidth: '90%', maxHeight: '90%', objectFit: 'contain' }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800 }}>{s.name} <span className={`pill ${Number(s.tier) === 2 ? 'pill-muted' : 'pill-gold'}`} style={{ marginLeft: 6, fontSize: '0.55rem' }}>{Number(s.tier) === 2 ? 'SMALL' : 'LARGE'}</span></div>
                {s.link_url && <a href={s.link_url} target="_blank" rel="noreferrer" style={{ fontSize: '0.72rem', color: 'var(--gold)', wordBreak: 'break-all' }}>{s.link_url}</a>}
              </div>
              <button className="btn btn-sm btn-dark" onClick={() => edit(s)}>Edit</button>
              <button className="btn btn-sm btn-danger" onClick={() => remove(s)}>Delete</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
