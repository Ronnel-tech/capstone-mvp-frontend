import React, { useEffect, useState } from 'react';
import {
  approveRegistration,
  createDepartment,
  downloadAttendanceReport,
  loadAdminAttendance,
  loadAdminAnalytics,
  loadAdminOverview,
  rejectRegistration,
  setDepartmentStatus,
  setEmployeeStatus,
} from './api.js';

function Mark() {
  return <div className="brand-mark" aria-hidden="true"><svg viewBox="0 0 40 40" fill="none"><path d="M20 4 34 10v9c0 8.4-5.7 14-14 17C11.7 33 6 27.4 6 19v-9l14-6Z" /><path d="M12 24h16M14 20h12M16 16h8M18 12h4" /></svg></div>;
}

function formatReportDate(value, options = { month: 'short', day: 'numeric' }) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-PH', { ...options, timeZone: 'Asia/Manila' }).format(new Date(`${value}T12:00:00+08:00`));
}

function AnalyticsModule({ analytics }) {
  const daily = analytics?.daily || [];
  const analyticsSummary = analytics?.summary || {};
  const expectedEmployeeDays = (analytics?.active_headcount || 0) * (analytics?.working_days || 0);
  const recentDays = daily.slice(-5);
  const previousDays = daily.slice(-10, -5);
  const recentAverage = recentDays.length ? recentDays.reduce((sum, day) => sum + Number(day.recorded_count || 0), 0) / recentDays.length : 0;
  const previousAverage = previousDays.length ? previousDays.reduce((sum, day) => sum + Number(day.recorded_count || 0), 0) / previousDays.length : 0;
  const trendChange = previousAverage > 0 ? Math.round(((recentAverage - previousAverage) / previousAverage) * 100) : null;
  const peakDay = daily.reduce((best, day) => Number(day.recorded_count || 0) > Number(best?.recorded_count || 0) ? day : best, null);
  const simulatedTotal = daily.reduce((sum, day) => sum + Number(day.simulated_records || 0), 0);
  const liveTotal = daily.reduce((sum, day) => sum + Number(day.live_records || 0), 0);
  const forecastsByDate = Object.values((analytics?.forecasts || []).reduce((groups, forecast) => {
    const key = forecast.forecast_date;
    groups[key] ||= { date: key, departments: [], total: 0 };
    groups[key].departments.push(forecast);
    groups[key].total += Number(forecast.predicted_attendance_count || 0);
    return groups;
  }, {}));

  return <section className="admin-section analytics-module">
    <div className="section-heading analytics-heading"><div><span className="section-label">ATTENDANCE REPORT</span><h2>Attendance analytics</h2><p>{analytics?.from ? `${formatReportDate(analytics.from, { month: 'long', day: 'numeric', year: 'numeric' })} – ${formatReportDate(analytics.to, { month: 'long', day: 'numeric', year: 'numeric' })}` : 'Loading reporting period…'} · weekdays only</p></div></div>
    <div className="analytics-metrics">
      <article><span>Attendance coverage</span><strong>{analyticsSummary.recorded_attendance_rate == null ? '—' : `${analyticsSummary.recorded_attendance_rate}%`}</strong><small>Recorded employee-days ÷ possible employee workdays</small></article>
      <article><span>Recorded employee-days</span><strong>{Number(analyticsSummary.recorded_employee_days || 0).toLocaleString()}</strong><small>Across {analytics?.working_days || 0} weekdays · {analytics?.active_headcount || 0} active employees</small></article>
      <article><span>Daily average</span><strong>{daily.length ? (Number(analyticsSummary.recorded_employee_days || 0) / daily.length).toFixed(1) : '0'}</strong><small>Recorded employees per weekday</small></article>
    </div>
    <div className="analytics-insights" aria-label="Key insights">
      <div><span className="insight-icon">↗</span><p><strong>{trendChange === null ? 'Trend not available yet' : `${Math.abs(trendChange)}% ${trendChange >= 0 ? 'more' : 'fewer'} records recently`}</strong><small>{trendChange === null ? 'More history is needed to compare periods.' : 'Average daily records in the last 5 weekdays compared with the 5 weekdays before.'}</small></p></div>
      <div><span className="insight-icon">★</span><p><strong>{peakDay && Number(peakDay.recorded_count) ? `Busiest day: ${formatReportDate(peakDay.attendance_date)} (${peakDay.recorded_count})` : 'No attendance peak recorded'}</strong><small>Highest number of employees with a recorded time-in in this period.</small></p></div>
      <div><span className="insight-icon">●</span><p><strong>{liveTotal.toLocaleString()} live · {simulatedTotal.toLocaleString()} sample records</strong><small>Source mix helps distinguish real activity from seeded demonstration data.</small></p></div>
    </div>
    <div className="analytics-chart-heading"><div><h3>Daily recorded attendance</h3><span>Employees with a time-in, by weekday</span></div><span>{analytics?.active_headcount || 0} active employees</span></div>
    {daily.length ? <div className="attendance-chart" role="img" aria-label={`Daily attendance records from ${analytics.from} to ${analytics.to}`}>
      {daily.map((day) => {
        const count = Number(day.recorded_count || 0);
        const height = count ? Math.max(5, Math.round((count / Math.max(analytics?.active_headcount || 0, ...daily.map((item) => Number(item.recorded_count || 0)))) * 100)) : 2;
        return <div className="chart-column" key={day.attendance_date} title={`${formatReportDate(day.attendance_date, { month: 'short', day: 'numeric' })}: ${count} recorded`}><span className="chart-value">{count || ''}</span><div className="chart-track"><div className="chart-bar" style={{ height: `${height}%` }} /></div><small>{formatReportDate(day.attendance_date)}</small></div>;
      })}
    </div> : <p className="empty-copy">No attendance records in this period.</p>}
    <p className="report-footnote">Coverage is a reporting measure, not an absence rate. A day without a record is not automatically an official absence. {expectedEmployeeDays.toLocaleString()} possible employee workdays in this period.</p>
    <div className="forecast-heading"><div><h3>Five-day outlook</h3><span>Expected recorded attendance by department</span></div><span>{analytics?.active_model ? `Model ${analytics.active_model.model_version}` : 'No active model'}</span></div>
    {forecastsByDate.length ? <div className="forecast-list">{forecastsByDate.map((day) => <div className="forecast-row" key={day.date}><strong>{formatReportDate(day.date, { weekday: 'short', month: 'short', day: 'numeric' })}</strong><div>{day.departments.map((forecast) => <span key={forecast.department_id}>{forecast.department_name}<b>{forecast.predicted_attendance_count}</b></span>)}</div><strong className="forecast-total">{day.total}</strong></div>)}</div> : <p className="empty-copy">No forecast is available for the next five working days. An active model and generated forecast data are required.</p>}
    {analytics?.active_model && <details className="model-details"><summary>About this forecast</summary><p>Forecasts estimate department-level attendance counts from {analytics.active_model.dataset_type.toLowerCase()} data. They do not predict individual attendance or determine absences. Model error: MAE {analytics.active_model.mae ?? '—'}, RMSE {analytics.active_model.rmse ?? '—'}, WAPE {analytics.active_model.wape == null ? '—' : `${analytics.active_model.wape}%`}.</p></details>}
  </section>;
}

export default function AdminWorkspace({ user, onSignOut }) {
  const [data, setData] = useState(null);
  const [report, setReport] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [departmentForm, setDepartmentForm] = useState({ department_name: '', description: '' });
  const [selectedDepartments, setSelectedDepartments] = useState({});
  const [filters, setFilters] = useState({ date: '', from: '', to: '', department_id: '' });
  const [activeModule, setActiveModule] = useState('overview');

  async function refresh() {
    const overview = await loadAdminOverview();
    setData(overview);
    const analyticsResult = await loadAdminAnalytics();
    setAnalytics(analyticsResult.data);
    if (!filters.date && !filters.from && overview.dashboard.today) {
      const todayFilters = { date: overview.dashboard.today };
      const attendance = await loadAdminAttendance(todayFilters);
      setFilters((current) => current.date || current.from ? current : { ...current, date: overview.dashboard.today });
      setReport(attendance.data);
    }
  }

  useEffect(() => {
    refresh().catch((reason) => setError(reason.message)).finally(() => setLoading(false));
  }, []);

  async function runAction(action, message) {
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      await action();
      await refresh();
      setSuccess(message);
    } catch (reason) {
      setError(reason.message);
    } finally {
      setBusy(false);
    }
  }

  function setDepartment(id, value) {
    setSelectedDepartments((current) => ({ ...current, [id]: value }));
  }

  async function handleDepartmentCreate(event) {
    event.preventDefault();
    await runAction(async () => {
      await createDepartment(departmentForm);
      setDepartmentForm({ department_name: '', description: '' });
    }, 'Department added.');
  }

  async function handleReport(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const query = filters.from || filters.to
        ? { from: filters.from, to: filters.to, department_id: filters.department_id }
        : { date: filters.date, department_id: filters.department_id };
      const result = await loadAdminAttendance(query);
      setReport(result.data);
    } catch (reason) {
      setError(reason.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleExport() {
    setError('');
    try {
      const query = filters.from || filters.to
        ? { from: filters.from, to: filters.to, department_id: filters.department_id }
        : { date: filters.date, department_id: filters.department_id };
      await downloadAttendanceReport(query);
    } catch (reason) {
      setError(reason.message);
    }
  }

  if (loading) return <main className="admin-shell"><div className="admin-loading">Loading Admin workspace…</div></main>;

  const dashboard = data?.dashboard;
  const activeDepartments = (data?.departments || []).filter((department) => department.status === 'active');

  return (
    <main className="admin-shell">
      <header className="admin-topbar">
        <a className="brand" href="/" aria-label="Municipal Workforce home"><Mark /><span><strong>Municipal Workforce</strong><small>ADMINISTRATION</small></span></a>
        <div className="admin-user"><span>{user.email}</span><button className="text-button" onClick={onSignOut}>Sign out</button></div>
      </header>
      <div className="admin-layout">
        <aside className="admin-sidebar" aria-label="Admin modules">
          <span className="sidebar-caption">MODULES</span>
          <button className={`module-link ${activeModule === 'overview' ? 'selected' : ''}`} aria-current={activeModule === 'overview' ? 'page' : undefined} onClick={() => setActiveModule('overview')}><span aria-hidden="true">▦</span> Overview</button>
          <button className={`module-link ${activeModule === 'departments' ? 'selected' : ''}`} aria-current={activeModule === 'departments' ? 'page' : undefined} onClick={() => setActiveModule('departments')}><span aria-hidden="true">▤</span> Departments</button>
          <button className={`module-link ${activeModule === 'employees' ? 'selected' : ''}`} aria-current={activeModule === 'employees' ? 'page' : undefined} onClick={() => setActiveModule('employees')}><span aria-hidden="true">♙</span> Employees</button>
          <button className={`module-link ${activeModule === 'attendance' ? 'selected' : ''}`} aria-current={activeModule === 'attendance' ? 'page' : undefined} onClick={() => setActiveModule('attendance')}><span aria-hidden="true">▥</span> Attendance records</button>
          <button className={`module-link ${activeModule === 'analytics' ? 'selected' : ''}`} aria-current={activeModule === 'analytics' ? 'page' : undefined} onClick={() => setActiveModule('analytics')}><span aria-hidden="true">▥</span> Attendance analytics</button>
        </aside>
        <div className="admin-content">
        {error && <div className="notice error" role="alert">{error}</div>}
        {success && <div className="notice success" role="status">{success}</div>}

        {activeModule === 'overview' && <>
        <div className="admin-title"><div><div className="eyebrow"><span /> ADMIN WORKSPACE</div><h1>Municipal overview</h1><p>Attendance activity and employee registration status.</p></div><span className="date-chip">{dashboard?.today} · Asia/Manila</span></div>
        <section className="metric-grid" aria-label="Attendance summary">
          <article className="metric-card"><span>Employees</span><strong>{dashboard?.total_employees ?? '—'}</strong><small>Registered employee accounts</small></article>
          <article className="metric-card"><span>Active employees</span><strong>{dashboard?.active_employees ?? '—'}</strong><small>Approved and active</small></article>
          <article className="metric-card"><span>Pending registrations</span><strong>{dashboard?.pending_registrations ?? '—'}</strong><small>Awaiting Admin review</small></article>
          <article className="metric-card"><span>Recorded today</span><strong>{dashboard?.recorded_attendance_count ?? '—'}</strong><small>{dashboard?.recorded_attendance_rate === null ? 'Rate unavailable today' : `${dashboard?.recorded_attendance_rate}% Recorded Attendance Rate`}</small></article>
        </section>

        <section className="admin-section">
          <div className="section-heading"><div><span className="section-label">REVIEW QUEUE</span><h2>Pending registrations</h2></div><span className="count-chip">{data?.registrations?.length || 0}</span></div>
          {data?.registrations?.length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Employee</th><th>Contact</th><th>Submitted</th><th>Assign department</th><th>Actions</th></tr></thead><tbody>
            {data.registrations.map((registration) => <tr key={registration.id}>
              <td><strong>{registration.full_name}</strong><small>{registration.age} years · {registration.address}</small></td>
              <td>{registration.email}</td><td>{registration.created_at}</td>
              <td><select aria-label={`Department for ${registration.full_name}`} value={selectedDepartments[registration.id] || ''} onChange={(event) => setDepartment(registration.id, event.target.value)}><option value="">Choose…</option>{activeDepartments.map((department) => <option key={department.id} value={department.id}>{department.department_name}</option>)}</select></td>
              <td className="action-cell"><button className="small-button approve" disabled={busy || !selectedDepartments[registration.id]} onClick={() => runAction(() => approveRegistration(registration.id, Number(selectedDepartments[registration.id])), 'Registration approved.')}>Approve</button><button className="small-button reject" disabled={busy} onClick={() => runAction(() => rejectRegistration(registration.id), 'Registration rejected.')}>Reject</button></td>
            </tr>)}
          </tbody></table></div> : <p className="empty-copy">No pending registrations.</p>}
          {!activeDepartments.length && <p className="inline-hint">Add or activate a department before approving registrations.</p>}
        </section>

        </>}
        {activeModule === 'departments' && <>
        <div className="admin-title"><div><div className="eyebrow"><span /> ADMIN MODULE</div><h1>Departments</h1><p>Create and manage municipal departments.</p></div><span className="date-chip">{data?.departments?.length || 0} departments</span></div>
        <section className="admin-section">
          <div className="section-heading"><div><span className="section-label">ORGANIZATION</span><h2>Department directory</h2></div></div>
          <form className="department-form" onSubmit={handleDepartmentCreate}>
            <label>Department name<input value={departmentForm.department_name} onChange={(event) => setDepartmentForm({ ...departmentForm, department_name: event.target.value })} maxLength="150" required /></label>
            <label>Description<input value={departmentForm.description} onChange={(event) => setDepartmentForm({ ...departmentForm, description: event.target.value })} maxLength="5000" /></label>
            <button className="primary-button" disabled={busy}>Add department <span aria-hidden="true">＋</span></button>
          </form>
          <div className="compact-list">{data?.departments.map((department) => <div className="compact-row" key={department.id}><div><strong>{department.department_name}</strong><small>{department.description || 'No description'}</small></div><button className={`small-button ${department.status === 'active' ? 'reject' : 'approve'}`} disabled={busy} onClick={() => runAction(() => setDepartmentStatus(department.id, department.status === 'active' ? 'inactive' : 'active'), 'Department status updated.')}>{department.status === 'active' ? 'Deactivate' : 'Activate'}</button></div>)}</div>
          {!data?.departments?.length && <p className="empty-copy">No departments yet. Add one using the form above.</p>}
        </section>
        </>}
        {activeModule === 'employees' && <>
        <div className="admin-title"><div><div className="eyebrow"><span /> ADMIN MODULE</div><h1>Employees</h1><p>Review active employee accounts and account status.</p></div><span className="date-chip">{data?.employees?.length || 0} employees</span></div>
        <section className="admin-section">
          <div className="section-heading"><div><span className="section-label">EMPLOYEE ACCOUNTS</span><h2>Employee directory</h2></div><span className="count-chip">{data?.employees.length || 0}</span></div>
          {data?.employees.length ? <div className="compact-list">{data.employees.map((employee) => <div className="compact-row" key={employee.id}><div><strong>{employee.full_name}</strong><small>{employee.department_name || 'Unassigned'} · {employee.email}</small><span className={`state-tag ${employee.account_status}`}>{employee.account_status}</span></div>{['active', 'disabled'].includes(employee.account_status) && <button className={`small-button ${employee.account_status === 'active' ? 'reject' : 'approve'}`} disabled={busy} onClick={() => runAction(() => setEmployeeStatus(employee.id, employee.account_status === 'active' ? 'disabled' : 'active'), 'Employee account status updated.')}>{employee.account_status === 'active' ? 'Disable' : 'Enable'}</button>}</div>)}</div> : <p className="empty-copy">No employees yet.</p>}
        </section>
        </>}
        {activeModule === 'attendance' && <>
        <div className="admin-title"><div><div className="eyebrow"><span /> ADMIN MODULE</div><h1>Attendance records</h1><p>Filter, review, and export recorded attendance.</p></div><span className="date-chip">{dashboard?.today} · Asia/Manila</span></div>
        <section className="admin-section">
          <div className="section-heading"><div><span className="section-label">MONITORING & REPORTS</span><h2>Attendance records</h2></div></div>
          <form className="report-filters" onSubmit={handleReport}>
            <label>Single date<input type="date" value={filters.date} onChange={(event) => setFilters({ ...filters, date: event.target.value, from: '', to: '' })} /></label>
            <label>From<input type="date" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value, date: '' })} /></label>
            <label>To<input type="date" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value, date: '' })} /></label>
            <label>Department<select value={filters.department_id} onChange={(event) => setFilters({ ...filters, department_id: event.target.value })}><option value="">All departments</option>{data?.departments.map((department) => <option key={department.id} value={department.id}>{department.department_name}</option>)}</select></label>
            <button className="small-button approve" disabled={busy}>Apply filters</button>
            <button className="small-button export-button" type="button" onClick={handleExport}>Export CSV</button>
          </form>
          {report?.department_summary?.length > 0 && <div className="summary-strip">{report.department_summary.map((summary) => <div key={summary.id}><strong>{summary.department_name}</strong><span>{summary.recorded_employee_days} recorded / {summary.active_headcount} active · {summary.recorded_attendance_rate === null ? 'Rate unavailable' : `${summary.recorded_attendance_rate}% Recorded Attendance Rate`}</span></div>)}</div>}
          {report?.attendance?.length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Date</th><th>Employee</th><th>Department</th><th>Time in</th><th>Time out</th><th>Source</th></tr></thead><tbody>{report.attendance.map((row) => <tr key={`${row.attendance_date}-${row.email}`}><td>{row.attendance_date}</td><td><strong>{row.full_name}</strong><small>{row.email}</small></td><td>{row.department_name || '—'}</td><td>{row.time_in}</td><td>{row.time_out || '—'}</td><td>{row.source}</td></tr>)}</tbody></table></div> : <p className="empty-copy">No attendance records match these filters.</p>}
          {report && <p className="report-footnote">Recorded Attendance Rate uses active employee headcount and weekdays in the selected range. It does not label unrecorded time-ins as official absences.</p>}
        </section>
        </>}
        {activeModule === 'analytics' && <>
          <div className="admin-title"><div><div className="eyebrow"><span /> ADMIN MODULE</div><h1>Attendance analytics</h1><p>Trends, key takeaways, and the upcoming attendance forecast.</p></div><span className="date-chip">{dashboard?.today} · Asia/Manila</span></div>
          <AnalyticsModule analytics={analytics} />
        </>}
        </div>
      </div>
    </main>
  );
}
