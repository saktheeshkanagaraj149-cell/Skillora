import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Award, Copy, Frown, Printer, Share, Sprout, Verified } from '../icons';

const fmtDate = (d) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

/** LinkedIn "Add licence or certification" prefilled link. */
function linkedInUrl(c, url) {
  const d = new Date(c.issuedAt);
  const p = new URLSearchParams({
    startTask: 'CERTIFICATION_NAME',
    name: c.courseTitle,
    organizationName: 'Skillora',
    issueYear: String(d.getFullYear()),
    issueMonth: String(d.getMonth() + 1),
    certUrl: url,
    certId: c.code,
  });
  return `https://www.linkedin.com/profile/add?${p}`;
}

export default function CertificatePage() {
  const { code } = useParams();
  const { user } = useAuth();
  const [cert, setCert] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [isMine, setIsMine] = useState(false);

  useEffect(() => {
    api(`/certificates/${encodeURIComponent(code)}`).then(setCert).catch((e) => setError(e.message));
  }, [code]);

  useEffect(() => {
    if (!user) return setIsMine(false);
    api('/me/certificates').then((list) => setIsMine(list.some((c) => c.code === code.toUpperCase()))).catch(() => {});
  }, [user, code]);

  useEffect(() => {
    if (cert) document.title = `${cert.learnerName}: ${cert.courseTitle} certificate · Skillora`;
    return () => { document.title = 'Skillora: learn any skill, free'; };
  }, [cert]);

  if (error) {
    return (
      <div className="card empty">
        <Frown className="big-icon" size={44} aria-hidden />
        <h3>Certificate not found</h3>
        <p className="muted">No Skillora certificate has the ID <strong>{code}</strong>. Check the ID and try again.</p>
        <Link to="/" className="btn small">Go home</Link>
      </div>
    );
  }
  if (!cert) return <div className="skeleton" style={{ minHeight: 420, marginTop: '1rem' }} />;

  const url = `${window.location.origin}/certificate/${cert.code}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked: the URL is visible on the page */
    }
  };

  return (
    <div className="cert-page">
      <div className="verify-bar no-print">
        <Verified size={20} />
        <span className="grow">
          <strong>Verified certificate.</strong> Issued by Skillora to {cert.learnerName} on {fmtDate(cert.issuedAt)}.
        </span>
      </div>

      <article className="certificate" aria-label="Certificate of completion">
        <div className="cert-inner">
          <header className="cert-brand">
            <span className="brand-mark"><Sprout size={18} /></span> Skillora
          </header>
          <p className="cert-kicker">Certificate of completion</p>
          <p className="cert-line">This certifies that</p>
          <h1 className="cert-name">{cert.learnerName}</h1>
          <p className="cert-line">has successfully completed the course</p>
          <h2 className="cert-course">{cert.courseTitle}</h2>
          <p className="cert-meta">
            {[cert.domainName, `${cert.level[0].toUpperCase()}${cert.level.slice(1)} level`, `${cert.lessons} lessons`, `~${cert.hours} hours`, cert.score != null && `final exam ${cert.score}%`]
              .filter(Boolean)
              .join('  ·  ')}
          </p>
          <footer className="cert-foot">
            <div>
              <span className="cert-label">Issued</span>
              <strong>{fmtDate(cert.issuedAt)}</strong>
            </div>
            <span className="cert-seal" aria-hidden><Award size={44} /></span>
            <div className="right">
              <span className="cert-label">Certificate ID</span>
              <strong>{cert.code}</strong>
              <span className="cert-verify">Verify at {window.location.host}/certificate/{cert.code}</span>
            </div>
          </footer>
        </div>
      </article>

      <div className="cert-actions no-print">
        <button className="btn" onClick={() => window.print()}><Printer size={17} /> Download PDF / print</button>
        {isMine && (
          <a className="btn secondary" href={linkedInUrl(cert, url)} target="_blank" rel="noopener noreferrer"><Share size={17} /> Add to LinkedIn</a>
        )}
        <button className="btn secondary" onClick={copy}><Copy size={17} /> {copied ? 'Link copied' : 'Copy link'}</button>
        <Link to={`/p/${cert.pathId}`} className="link">View the course</Link>
      </div>
      <p className="small muted center no-print">Tip: in the print dialog choose “Save as PDF”, landscape, and turn on “Background graphics”.</p>
    </div>
  );
}
