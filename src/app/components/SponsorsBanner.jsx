import React, { useEffect, useState } from 'react';
import * as db from '../lib/db';
import { DEFAULT_SPONSORS } from '../lib/hooks';

// Sponsor strip shown under every public page. Reads the `sponsors` table
// (managed from Admin → Sponsors) and falls back to the built-in list.
export default function SponsorsBanner() {
  const [sponsors, setSponsors] = useState(null);

  useEffect(() => {
    let alive = true;
    const load = () => db.fetchSponsors().then(rows => { if (alive) setSponsors(rows); }).catch(() => { if (alive) setSponsors([]); });
    load();
    const sub = db.subscribeToSponsors(load);
    return () => { alive = false; db.removeChannel(sub); };
  }, []);

  const list = sponsors && sponsors.length > 0 ? sponsors : DEFAULT_SPONSORS;
  const tier1 = list.filter(s => Number(s.tier) !== 2);
  const tier2 = list.filter(s => Number(s.tier) === 2);

  const Logo = ({ s, cls }) => {
    const img = <img src={s.logo_url} alt={s.name} className={`sponsor-logo ${cls}`} />;
    return s.link_url
      ? <a key={s.id} href={s.link_url} target="_blank" rel="noreferrer" className="sponsor-link" title={s.name}>{img}</a>
      : <span key={s.id} className="sponsor-link">{img}</span>;
  };

  return (
    <div className="sponsors-banner animate-fade">
      <div className="sponsors-title">Our Sponsors</div>
      {tier1.length > 0 && (
        <div className="sponsors-grid sponsors-tier1">
          {tier1.map(s => <Logo key={s.id} s={s} cls="sponsor-logo-t1" />)}
        </div>
      )}
      {tier2.length > 0 && (
        <>
          <div className="sponsors-tier-divider" />
          <div className="sponsors-grid sponsors-tier2">
            {tier2.map(s => <Logo key={s.id} s={s} cls="sponsor-logo-t2" />)}
          </div>
        </>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, paddingTop: 10, borderTop: '1px solid var(--border)', marginTop: 14 }}>
        <span style={{ fontSize: '0.68rem', color: 'var(--muted)', fontWeight: 700, letterSpacing: 1 }}>TECH SUPPORT</span>
        <a href="https://calcioac.com" target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 5, textDecoration: 'none' }}>
          <img src="/images/sponsors/calcioac.svg" alt="calcioac" style={{ width: 26, height: 26, objectFit: 'contain', borderRadius: 4, opacity: 0.85 }} />
          <span style={{ fontSize: '0.72rem', color: 'var(--text2)', fontWeight: 700 }}>calcioac.com</span>
        </a>
      </div>
    </div>
  );
}
