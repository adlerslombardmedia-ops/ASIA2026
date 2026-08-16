import React, { useState, useRef } from 'react';
import { COLORS, TeamLogo } from '../lib/hooks';
import * as db from '../lib/db';
import { toast } from '../lib/hooks';

const ADMIN_EMAILS = ['precious@keff.com', 'info@keff.com'];

function MessageText({ text, teamMap, navigate }) {
  const shortNameToTeam = {};
  Object.values(teamMap).forEach(t => {
    if (t.short_name) shortNameToTeam[t.short_name.toLowerCase()] = t;
  });
  const parts = text.split(/(@\w+)/g);
  return (
    <span>
      {parts.map((part, i) => {
        if (part.startsWith('@')) {
          const key = part.slice(1).toLowerCase();
          const team = shortNameToTeam[key];
          if (team) {
            return (
              <span key={i}
                onClick={() => navigate && navigate('team', { teamId: team.id })}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4,
                  background: `${COLORS.gold}20`, color: COLORS.gold,
                  border: `1px solid ${COLORS.gold}40`, borderRadius: 12,
                  padding: '1px 8px', fontSize: '0.8em', fontWeight: 800,
                  cursor: navigate ? 'pointer' : 'default', margin: '0 2px' }}>
                {part}
              </span>
            );
          }
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
}

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// Attachment display — images inline, PDFs as cards
// Append Supabase image transform params to shrink images on delivery
function optimisedUrl(url) {
  if (!url) return url;
  try {
    const u = new URL(url);
    // Only transform Supabase storage URLs
    if (u.pathname.includes('/storage/v1/object/public/')) {
      u.searchParams.set('width', '900');
      u.searchParams.set('quality', '70');
    }
    return u.toString();
  } catch { return url; }
}

function Attachments({ attachments }) {
  if (!attachments || attachments.length === 0) return null;
  return (
    <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {attachments.map((att, i) => {
        if (att.type === 'image') {
          return (
            <a key={i} href={att.url} target="_blank" rel="noreferrer">
              <img src={optimisedUrl(att.url)} alt={att.name}
                style={{ width: '100%', borderRadius: 10, maxHeight: 400, objectFit: 'contain',
                  background: '#111', border: '1px solid var(--border)', display: 'block' }} />
            </a>
          );
        }
        return (
          <a key={i} href={att.url} target="_blank" rel="noreferrer"
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
              borderRadius: 10, background: 'rgba(255,61,87,0.08)', border: '1px solid rgba(255,61,87,0.2)',
              textDecoration: 'none', color: 'var(--text)' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#FF3D57" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
              <polyline points="10 9 9 9 8 9"/>
            </svg>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: '0.82rem' }} className="truncate">{att.name}</div>
              <div style={{ fontSize: '0.62rem', color: '#888', marginTop: 1 }}>PDF · Tap to open</div>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
          </a>
        );
      })}
    </div>
  );
}

function useMentionInput(initial = '') {
  const [value, setValue] = useState(initial);
  const [mentionQuery, setMentionQuery] = useState(null);
  const [mentionStart, setMentionStart] = useState(-1);
  const ref = useRef(null);

  const handleChange = (e) => {
    const val = e.target.value;
    setValue(val);
    const cursor = e.target.selectionStart;
    const beforeCursor = val.slice(0, cursor);
    const match = beforeCursor.match(/@(\w*)$/);
    if (match) {
      setMentionQuery(match[1].toLowerCase());
      setMentionStart(cursor - match[0].length);
    } else {
      setMentionQuery(null);
    }
  };

  const insertMention = (team) => {
    const cursor = ref.current?.selectionStart || value.length;
    const before = value.slice(0, mentionStart);
    const after = value.slice(cursor);
    const newVal = `${before}@${team.short_name} ${after}`;
    setValue(newVal);
    setMentionQuery(null);
    setTimeout(() => {
      const pos = mentionStart + team.short_name.length + 2;
      ref.current?.setSelectionRange(pos, pos);
      ref.current?.focus();
    }, 0);
  };

  const reset = (val = '') => { setValue(val); setMentionQuery(null); };
  return { value, setValue, mentionQuery, setMentionQuery, mentionStart, ref, handleChange, insertMention, reset };
}

export default function InfoView({ data, navigate }) {
  const { announcements, teamMap, user } = data;
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // Attachments for compose
  const [composeAttachments, setComposeAttachments] = useState([]);
  const [uploadingCompose, setUploadingCompose] = useState(false);
  const composeFileRef = useRef(null);

  // Attachments for edit
  const [editAttachments, setEditAttachments] = useState([]);
  const [uploadingEdit, setUploadingEdit] = useState(false);
  const editFileRef = useRef(null);

  const isAdmin = user && ADMIN_EMAILS.includes(user.email);
  const teams = Object.values(teamMap);

  const compose = useMentionInput('');
  const edit = useMentionInput('');

  const filteredTeams = (input) =>
    input.mentionQuery !== null
      ? teams.filter(t =>
          t.short_name?.toLowerCase().includes(input.mentionQuery) ||
          t.name?.toLowerCase().includes(input.mentionQuery)
        ).slice(0, 6)
      : [];

  const handleFileUpload = async (files, setAttachments, setUploading) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const uploaded = [];
      for (const file of Array.from(files)) {
        if (file.size > 20 * 1024 * 1024) { toast(`${file.name} is too large (max 20MB)`, 'error'); continue; }
        const att = await db.uploadAnnouncementFile(file);
        uploaded.push(att);
      }
      setAttachments(prev => [...prev, ...uploaded]);
      if (uploaded.length) toast(`${uploaded.length} file${uploaded.length > 1 ? 's' : ''} attached!`, 'success');
    } catch (e) { toast(e.message, 'error'); }
    setUploading(false);
  };

  const send = async () => {
    if (!compose.value.trim() && composeAttachments.length === 0) return;
    setBusy(true);
    try {
      await db.insertAnnouncement(compose.value.trim(), composeAttachments);
      compose.reset('');
      setComposeAttachments([]);
      toast('Message sent!', 'success');
    } catch (e) { toast(e.message, 'error'); }
    setBusy(false);
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this message?')) return;
    try {
      await db.deleteAnnouncement(id);
      toast('Deleted', 'info');
    } catch (e) { toast(e.message, 'error'); }
  };

  const startEdit = (a) => {
    setEditingId(a.id);
    edit.reset(a.message);
    setEditAttachments(a.attachments || []);
  };

  const cancelEdit = () => { setEditingId(null); edit.reset(''); setEditAttachments([]); };

  const saveEdit = async (id) => {
    if (!edit.value.trim() && editAttachments.length === 0) return;
    setBusy(true);
    try {
      await db.updateAnnouncement(id, edit.value.trim(), editAttachments);
      setEditingId(null);
      edit.reset('');
      setEditAttachments([]);
      toast('Message updated!', 'success');
    } catch (e) { toast(e.message, 'error'); }
    setBusy(false);
  };

  const MentionDropdown = ({ input }) => {
    const filtered = filteredTeams(input);
    if (!filtered.length) return null;
    return (
      <div style={{ position: 'absolute', left: 0, right: 0, top: '100%', zIndex: 100,
        background: 'var(--card)', border: '1px solid var(--border)',
        borderRadius: 10, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
        {filtered.map(t => (
          <div key={t.id} className="tappable"
            onMouseDown={e => { e.preventDefault(); input.insertMention(t); }}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', cursor: 'pointer' }}>
            <TeamLogo team={t} size={24} />
            <span style={{ fontWeight: 700, fontSize: '0.82rem' }}>{t.name}</span>
            <span style={{ marginLeft: 'auto', fontSize: '0.68rem', color: COLORS.gold, fontWeight: 800 }}>@{t.short_name}</span>
          </div>
        ))}
      </div>
    );
  };

  // Pending attachments preview strip
  const AttachPreview = ({ attachments, onRemove }) => {
    if (!attachments.length) return null;
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
        {attachments.map((att, i) => (
          <div key={i} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center',
            gap: 6, padding: '5px 8px', borderRadius: 8,
            background: att.type === 'image' ? 'rgba(0,200,83,0.1)' : 'rgba(255,61,87,0.08)',
            border: `1px solid ${att.type === 'image' ? 'rgba(0,200,83,0.25)' : 'rgba(255,61,87,0.2)'}`,
            maxWidth: 180 }}>
            {att.type === 'image'
              ? <img src={att.url} alt="" style={{ width: 24, height: 24, borderRadius: 4, objectFit: 'cover' }} />
              : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FF3D57" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            }
            <span style={{ fontSize: '0.68rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.name}</span>
            <button onMouseDown={e => { e.preventDefault(); onRemove(i); }}
              style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer',
                fontSize: '0.75rem', padding: '0 2px', lineHeight: 1, flexShrink: 0 }}>✕</button>
          </div>
        ))}
      </div>
    );
  };

  const AttachButton = ({ loading, onClick, fileRef, onChange }) => (
    <>
      <input ref={fileRef} type="file" accept="image/*,.pdf" multiple style={{ display: 'none' }}
        onChange={e => { onChange(e.target.files); e.target.value = ''; }} />
      <button type="button" onClick={onClick} disabled={loading}
        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px',
          background: 'transparent', border: '1px solid var(--border)', borderRadius: 8,
          color: '#888', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
        </svg>
        {loading ? 'Uploading…' : 'Attach'}
      </button>
    </>
  );

  return (
    <div className="animate-fade">
      {/* Header */}
      <div style={{ background: `linear-gradient(135deg, #0a0a0a, ${COLORS.dark}, #0a0a1a)`,
        padding: '24px 16px 20px', borderBottom: `3px solid ${COLORS.gold}`, textAlign: 'center' }}>
        <div style={{ fontSize: '0.65rem', fontWeight: 800, color: COLORS.gold, letterSpacing: 3,
          textTransform: 'uppercase', marginBottom: 6 }}>Tournament</div>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#fff', marginBottom: 4 }}>Info Board</h1>
        <div style={{ fontSize: '0.72rem', color: '#666' }}>Official announcements from the tournament director</div>
      </div>

      <div style={{ padding: 16 }}>

        {/* Compose box */}
        {isAdmin && (
          <div className="kcard" style={{ marginBottom: 20, padding: 14,
            border: `1px solid ${COLORS.gold}30`, position: 'relative' }}>
            <div style={{ fontSize: '0.65rem', fontWeight: 800, color: COLORS.gold,
              textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
              Post Announcement
            </div>
            <div style={{ position: 'relative' }}>
              <textarea
                ref={compose.ref}
                value={compose.value}
                onChange={compose.handleChange}
                onKeyDown={e => {
                  if (e.key === 'Escape') compose.setMentionQuery(null);
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send();
                }}
                placeholder={'Write a message… use @ to tag a team'}
                rows={3}
                style={{ width: '100%', resize: 'vertical', padding: '10px 12px',
                  fontSize: '0.85rem', lineHeight: 1.5, borderRadius: 10,
                  background: 'var(--card2)', color: 'var(--text)',
                  border: '1px solid var(--border)', boxSizing: 'border-box' }}
              />
              <MentionDropdown input={compose} />
            </div>
            <AttachPreview
              attachments={composeAttachments}
              onRemove={i => setComposeAttachments(prev => prev.filter((_, idx) => idx !== i))}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <AttachButton
                  loading={uploadingCompose}
                  onClick={() => composeFileRef.current?.click()}
                  fileRef={composeFileRef}
                  onChange={files => handleFileUpload(files, setComposeAttachments, setUploadingCompose)}
                />
                <span style={{ fontSize: '0.62rem', color: '#555' }}>⌘+Enter to send</span>
              </div>
              <button className="btn btn-gold btn-sm" onClick={send}
                disabled={busy || uploadingCompose || (!compose.value.trim() && composeAttachments.length === 0)}>
                {busy ? 'Sending…' : 'Send'}
              </button>
            </div>
          </div>
        )}

        {/* Feed */}
        {announcements.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#555' }}>
            <div style={{ fontSize: '2rem', marginBottom: 12 }}>📋</div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: 4 }}>No announcements yet</div>
            <div style={{ fontSize: '0.78rem' }}>Check back for tournament updates.</div>
          </div>
        ) : (
          announcements.map(a => (
            <div key={a.id} className="kcard" style={{ marginBottom: 12, padding: 14 }}>
              {/* Header row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%',
                  background: COLORS.gold, color: COLORS.dark,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 900, fontSize: '0.75rem', flexShrink: 0 }}>
                  {a.author_email === 'precious@keff.com' ? 'TD' : 'AD'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: '0.78rem', color: COLORS.gold }}>
                    {a.author_email === 'precious@keff.com' ? 'Tournament Director' : 'Tournament Admin'}
                  </div>
                  <div style={{ fontSize: '0.62rem', color: '#555' }}>{timeAgo(a.created_at)}</div>
                </div>
                {isAdmin && editingId !== a.id && (
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => startEdit(a)}
                      style={{ background: 'transparent', border: `1px solid ${COLORS.gold}40`, color: COLORS.gold,
                        cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700, padding: '2px 8px',
                        borderRadius: 6, lineHeight: 1 }}>
                      Edit
                    </button>
                    <button onClick={() => remove(a.id)}
                      style={{ background: 'transparent', border: '1px solid rgba(255,61,87,0.3)', color: '#FF3D57',
                        cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700, padding: '2px 8px',
                        borderRadius: 6, lineHeight: 1 }}>
                      Delete
                    </button>
                  </div>
                )}
              </div>

              {/* Inline edit mode */}
              {isAdmin && editingId === a.id ? (
                <div>
                  <div style={{ position: 'relative' }}>
                    <textarea
                      ref={edit.ref}
                      value={edit.value}
                      onChange={edit.handleChange}
                      onKeyDown={e => {
                        if (e.key === 'Escape') cancelEdit();
                        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) saveEdit(a.id);
                      }}
                      rows={6}
                      style={{ width: '100%', resize: 'vertical', padding: '10px 12px',
                        fontSize: '0.85rem', lineHeight: 1.6, borderRadius: 10,
                        background: 'var(--card2)', color: 'var(--text)',
                        border: `1px solid ${COLORS.gold}60`, boxSizing: 'border-box',
                        whiteSpace: 'pre-wrap' }}
                    />
                    <MentionDropdown input={edit} />
                  </div>
                  <AttachPreview
                    attachments={editAttachments}
                    onRemove={i => setEditAttachments(prev => prev.filter((_, idx) => idx !== i))}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                    <AttachButton
                      loading={uploadingEdit}
                      onClick={() => editFileRef.current?.click()}
                      fileRef={editFileRef}
                      onChange={files => handleFileUpload(files, setEditAttachments, setUploadingEdit)}
                    />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={cancelEdit}
                        style={{ padding: '6px 14px', fontWeight: 700, fontSize: '0.78rem', borderRadius: 8,
                          background: 'transparent', color: '#666', border: '1px solid var(--border)', cursor: 'pointer' }}>
                        Cancel
                      </button>
                      <button onClick={() => saveEdit(a.id)} disabled={busy || uploadingEdit}
                        className="btn btn-gold btn-sm">
                        {busy ? 'Saving…' : 'Save'}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {a.message && (
                    <div style={{ fontSize: '0.88rem', lineHeight: 1.6, color: 'var(--text)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      <MessageText text={a.message} teamMap={teamMap} navigate={navigate} />
                    </div>
                  )}
                  <Attachments attachments={a.attachments} />
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
