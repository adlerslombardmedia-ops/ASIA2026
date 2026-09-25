import React, { useEffect, useRef, useState } from 'react';
import { COLORS } from '../lib/hooks';

const GOLD = COLORS.gold;
const RED  = '#FF3D57';

const GROUNDS = [
  { key: 'ground1', channel: 'cac_live',  label: 'Ground 1' },
  { key: 'ground2', channel: 'cac_live2', label: 'Ground 2' },
];

function TwitchEmbed({ channel, embedId }) {
  const embedRef = useRef(null);
  const [loaded,  setLoaded]  = useState(false);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    setLoaded(false);
    setOffline(false);

    const initEmbed = () => {
      if (!window.Twitch || !document.getElementById(embedId)) return;
      try {
        const embed = new window.Twitch.Embed(embedId, {
          width:           '100%',
          height:          '100%',
          channel,
          layout:          'video',
          autoplay:        false,
          allowfullscreen: true,
          theme:           'dark',
        });
        embed.addEventListener(window.Twitch.Embed.VIDEO_READY, () => {
          setLoaded(true);
          setOffline(false);
        });
        embed.addEventListener(window.Twitch.Embed.OFFLINE, () => {
          setOffline(true);
          setLoaded(true);
        });
      } catch {
        setLoaded(true);
      }
    };

    if (window.Twitch) {
      initEmbed();
    } else if (!document.getElementById('twitch-embed-script')) {
      const script = document.createElement('script');
      script.id    = 'twitch-embed-script';
      script.src   = 'https://embed.twitch.tv/embed/v1.js';
      script.async = true;
      script.onload = initEmbed;
      document.head.appendChild(script);
    } else {
      const interval = setInterval(() => {
        if (window.Twitch) { clearInterval(interval); initEmbed(); }
      }, 200);
      return () => clearInterval(interval);
    }

    return () => {
      const el = document.getElementById(embedId);
      if (el) el.innerHTML = '';
    };
  }, [channel, embedId]);

  return (
    <div style={{ position: 'relative', width: '100%', paddingTop: '56.25%', background: '#0e0e10', borderRadius: 10, overflow: 'hidden' }}>
      {/* Loading */}
      {!loaded && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, background: '#0e0e10' }}>
          <div style={{ width: 32, height: 32, border: `3px solid ${GOLD}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <div style={{ color: '#555', fontSize: '0.72rem' }}>Connecting…</div>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      )}

      {/* Offline */}
      {offline && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, background: '#0e0e10', padding: 16 }}>
          <div style={{ fontSize: '2.2rem' }}>📺</div>
          <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#fff' }}>Not Live Yet</div>
          <div style={{ color: '#888', fontSize: '0.7rem', textAlign: 'center', lineHeight: 1.5 }}>
            Will appear here when <span style={{ color: GOLD, fontWeight: 700 }}>@{channel}</span> goes live.
          </div>
          <a href={`https://twitch.tv/${channel}`} target="_blank" rel="noreferrer"
            style={{ marginTop: 2, padding: '8px 16px', background: '#9147ff', color: '#fff', borderRadius: 8, fontWeight: 800, fontSize: '0.75rem', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/></svg>
            Follow on Twitch
          </a>
        </div>
      )}

      {/* Embed */}
      <div id={embedId} ref={embedRef}
        style={{ position: 'absolute', inset: 0, opacity: loaded && !offline ? 1 : 0, transition: 'opacity 0.3s' }} />
    </div>
  );
}

export default function LiveView() {
  const [activeGround, setActiveGround] = useState('ground1');
  const current = GROUNDS.find(g => g.key === activeGround);

  return (
    <div className="animate-fade" style={{ paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ padding: '16px 16px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: RED, flexShrink: 0, boxShadow: `0 0 6px ${RED}`, animation: 'pulse 1.4s infinite' }} />
        <div>
          <div style={{ fontWeight: 900, fontSize: '1.05rem', letterSpacing: -0.3 }}>Asia Cup Live</div>
          <div style={{ fontSize: '0.68rem', color: '#888', marginTop: 1 }}>2 matches streaming simultaneously</div>
        </div>
      </div>

      {/* Ground tabs */}
      <div style={{ display: 'flex', gap: 8, padding: '0 16px', marginBottom: 14 }}>
        {GROUNDS.map(g => {
          const isActive = activeGround === g.key;
          return (
            <button
              key={g.key}
              onClick={() => setActiveGround(g.key)}
              style={{
                flex: 1,
                padding: '10px 0',
                borderRadius: 10,
                border: isActive ? `2px solid ${GOLD}` : '2px solid var(--border)',
                background: isActive ? GOLD : 'var(--card)',
                color: isActive ? '#000' : 'var(--text)',
                fontWeight: 800,
                fontSize: '0.88rem',
                cursor: 'pointer',
                transition: 'all 0.18s',
              }}
            >
              {g.label}
            </button>
          );
        })}
      </div>

      {/* Active stream */}
      <div style={{ padding: '0 16px' }}>
        <div style={{ fontSize: '0.68rem', color: '#666', marginBottom: 8, textAlign: 'right' }}>
          twitch.tv/<span style={{ color: '#9147ff', fontWeight: 700 }}>{current.channel}</span>
        </div>
        <TwitchEmbed
          key={activeGround}
          channel={current.channel}
          embedId={`twitch-embed-${activeGround}`}
        />
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.5; transform: scale(0.85); }
        }
      `}</style>
    </div>
  );
}
