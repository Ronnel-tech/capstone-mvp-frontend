import React, { useEffect, useState } from 'react';
import { loadAttendanceHistory, loadTodayAttendance, recordTimeIn, recordTimeOut, registerEmployee, restoreSession, signIn, signOut } from './api.js';
import AdminWorkspace from './AdminWorkspace.jsx';

function Mark() {
  return (
    <div className="brand-mark" aria-hidden="true">
      <svg viewBox="0 0 40 40" fill="none">
        <path d="M20 4 34 10v9c0 8.4-5.7 14-14 17C11.7 33 6 27.4 6 19v-9l14-6Z" />
        <path d="M12 24h16M14 20h12M16 16h8M18 12h4" />
      </svg>
    </div>
  );
}

export default function App() {
  const [api, setApi] = useState({ state: 'checking', message: 'Checking services…' });
  const [user, setUser] = useState(null);
  const [view, setView] = useState('login');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [today, setToday] = useState(null);
  const [history, setHistory] = useState([]);
  const [attendanceBusy, setAttendanceBusy] = useState(false);
  const [attendanceError, setAttendanceError] = useState('');
  const [fields, setFields] = useState({ full_name: '', age: '', address: '', email: '', password: '' });

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/health', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('API did not respond successfully');
        const payload = await response.json();
        setApi({ state: 'online', message: payload.message || 'LavaLust API is reachable' });
        restoreSession().then(setUser).catch(() => {});
      })
      .catch((error) => {
        if (error.name !== 'AbortError') {
          setApi({ state: 'offline', message: 'Start the Lavalust server to connect' });
        }
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (user?.role !== 'employee') return;
    Promise.all([loadTodayAttendance(), loadAttendanceHistory()])
      .then(([todayResult, historyResult]) => {
        setToday(todayResult.data);
        setHistory(historyResult.data.attendance);
      })
      .catch((error) => setAttendanceError(error.message));
  }, [user]);

  function updateField(event) {
    setFields((previous) => ({ ...previous, [event.target.name]: event.target.value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      if (view === 'register') {
        await registerEmployee({
          full_name: fields.full_name,
          age: Number(fields.age),
          address: fields.address,
          email: fields.email,
          password: fields.password,
        });
        setNotice({ type: 'success', text: 'Registration received. An Admin must approve your account before you can sign in.' });
        setView('login');
        setFields((previous) => ({ ...previous, password: '' }));
      } else {
        const signedIn = await signIn(fields.email, fields.password);
        setUser(signedIn);
        setNotice(null);
      }
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    } finally {
      setBusy(false);
    }
  }

  async function handleSignOut() {
    let nextNotice = { type: 'success', text: 'You have signed out.' };
    try {
      await signOut();
    } catch (error) {
      nextNotice = { type: 'error', text: `Signed out on this device, but the server session could not be revoked: ${error.message}` };
    } finally {
      setUser(null);
      setToday(null);
      setHistory([]);
      setView('login');
      setFields((previous) => ({ ...previous, password: '' }));
      setNotice(nextNotice);
    }
  }

  async function handleAttendanceAction() {
    setAttendanceBusy(true);
    setAttendanceError('');
    try {
      const result = today?.state === 'timed_in' ? await recordTimeOut() : await recordTimeIn();
      const refreshed = await loadTodayAttendance();
      const records = await loadAttendanceHistory();
      setToday(refreshed.data);
      setHistory(records.data.attendance);
      setNotice({ type: 'success', text: result.message });
    } catch (error) {
      setAttendanceError(error.message);
    } finally {
      setAttendanceBusy(false);
    }
  }

  function formatTime(value) {
    if (!value) return '—';
    return new Date(`${value.replace(' ', 'T')}+08:00`).toLocaleTimeString('en-PH', {
      timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit',
    });
  }

  if (user?.role === 'admin') return <AdminWorkspace user={user} onSignOut={handleSignOut} />;

  if (user) {
    return (
      <main className="page-shell">
        <header className="topbar">
          <a className="brand" href="/" aria-label="Municipal Workforce home"><Mark /><span><strong>Municipal Workforce</strong><small>ATTENDANCE & ANALYTICS</small></span></a>
          <button className="text-button" onClick={handleSignOut}>Sign out</button>
        </header>
        <section className="welcome signed-in" aria-labelledby="page-title">
          <div className="eyebrow"><span /> {user.role === 'admin' ? 'ADMIN WORKSPACE' : 'EMPLOYEE WORKSPACE'}</div>
          <h1 id="page-title">Welcome,<br /><em>{user.full_name || user.email?.split('@')[0]}.</em></h1>
          <p className="intro">Your account is active{user.department_name ? ` in ${user.department_name}` : ''}.</p>
          <div className="status-card">
            <div className="status-icon online" aria-hidden="true">✓</div>
            <div className="status-copy"><strong>Signed in</strong><span>{user.email} · {user.role}</span></div>
            <span className="status-pill online">active</span>
          </div>
          {user.role === 'employee' && <>
            {!user.department_name && <div className="foundation-note"><span className="note-line" /><p>Your department has not been assigned yet. Contact an Admin for registration review.</p></div>}
            <div className="attendance-panel">
              <div className="panel-heading"><div><span className="section-label">TODAY · ASIA/MANILA</span><h2>Attendance</h2></div><span className="date-chip">{today?.date || 'Loading…'}</span></div>
              {today && <div className="attendance-times">
                <div><span>TIME IN</span><strong>{formatTime(today.attendance?.time_in)}</strong></div>
                <div><span>TIME OUT</span><strong>{formatTime(today.attendance?.time_out)}</strong></div>
              </div>}
              {attendanceError && <div className="notice error" role="alert">{attendanceError}</div>}
              {notice?.type === 'success' && <div className="notice success" role="status">{notice.text}</div>}
              {!today ? <p className="empty-copy">Loading today’s attendance…</p> : !today.is_working_day ? <p className="empty-copy">Attendance actions are available on weekdays.</p> : today.state === 'complete' ? <p className="complete-note">Today’s attendance is complete.</p> : <button className="primary-button attendance-button" onClick={handleAttendanceAction} disabled={attendanceBusy || !user.department_name}>
                {attendanceBusy ? 'Saving…' : today.state === 'timed_in' ? 'Time Out' : 'Time In'}<span aria-hidden="true">↗</span>
              </button>}
              {!user.department_name && <p className="inline-hint">An active department assignment is required to record attendance.</p>}
            </div>
            <div className="history-panel">
              <div className="panel-heading"><div><span className="section-label">YOUR RECORDS</span><h2>Recent attendance</h2></div></div>
              {history.length ? <div className="history-list">{history.slice(0, 6).map((record) => <div className="history-row" key={record.attendance_date}>
                <strong>{record.attendance_date}</strong><span>{formatTime(record.time_in)}</span><span>{formatTime(record.time_out)}</span><small>{record.source}</small>
              </div>)}</div> : <p className="empty-copy">No attendance records yet.</p>}
            </div>
          </>}
          {user.role === 'admin' && <div className="foundation-note"><span className="note-line" /><p>Admin tools are being connected to the approved attendance data.</p></div>}
        </section>
      <footer className="footer"><span>Municipal Employee Attendance System</span><span>Asia/Manila</span></footer>
      </main>
    );
  }

  return (
    <main className="page-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Municipal Workforce home">
          <Mark />
          <span><strong>Municipal Workforce</strong><small>ATTENDANCE & ANALYTICS</small></span>
        </a>
        <span className="environment"><span /> Municipal portal</span>
      </header>

      <section className="welcome" aria-labelledby="page-title">
        <div className="eyebrow"><span /> WORKFORCE SERVICES</div>
        <h1 id="page-title">Your workday,<br /><em>well recorded.</em></h1>
        <p className="intro">Sign in to municipal attendance services or register as an employee to get started.</p>

        <div className="auth-card">
          <div className="auth-heading"><strong>{view === 'login' ? 'Welcome back' : 'Employee registration'}</strong><span>{view === 'login' ? 'Use your approved account to continue.' : 'Your account will be reviewed by an Admin.'}</span></div>
          {notice && <div className={`notice ${notice.type}`} role="status">{notice.text}</div>}
          {api.state === 'offline' && <div className="notice error" role="status">Backend unavailable. Start the Lavalust server and try again.</div>}
          <form onSubmit={handleSubmit}>
            {view === 'register' && <>
              <label>Full name<input name="full_name" autoComplete="name" value={fields.full_name} onChange={updateField} required maxLength="160" /></label>
              <div className="field-row">
                <label>Age<input name="age" type="number" min="1" max="255" value={fields.age} onChange={updateField} required /></label>
                <label>Email address<input name="email" type="email" autoComplete="email" value={fields.email} onChange={updateField} required maxLength="255" /></label>
              </div>
              <label>Home address<textarea name="address" autoComplete="street-address" value={fields.address} onChange={updateField} required rows="2" /></label>
              <label>Password<input name="password" type="password" autoComplete="new-password" value={fields.password} onChange={updateField} required minLength="8" maxLength="72" /></label>
            </>}
            {view === 'login' && <>
              <label>Email address<input name="email" type="email" autoComplete="email" value={fields.email} onChange={updateField} required maxLength="255" /></label>
              <label>Password<input name="password" type="password" autoComplete="current-password" value={fields.password} onChange={updateField} required /></label>
            </>}
            <button className="primary-button" type="submit" disabled={busy || api.state !== 'online'}>
              {busy ? 'Please wait…' : view === 'login' ? 'Sign in' : 'Submit registration'}
              <span aria-hidden="true">↗</span>
            </button>
          </form>
          <div className="auth-switch">
            <span>{view === 'login' ? 'New municipal employee?' : 'Already registered?'}</span>
            <button className="text-button" onClick={() => { setView(view === 'login' ? 'register' : 'login'); setNotice(null); }}>
              {view === 'login' ? 'Create an account' : 'Sign in'}
            </button>
          </div>
        </div>
        <div className="api-indicator"><span className={`api-dot ${api.state}`} />{api.state === 'online' ? 'Services connected' : api.state === 'checking' ? api.message : 'Services unavailable'}</div>
      </section>

        <footer className="footer"><span>Municipal Employee Attendance System</span><span>Asia/Manila</span></footer>
    </main>
  );
}
