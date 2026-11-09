let accessToken = null;

function authenticatedUser(payload) {
  const user = payload?.data?.user;
  if (!user || typeof user !== 'object') {
    accessToken = null;
    throw new Error('The server did not return a user profile. Please sign in again.');
  }
  return user;
}

async function send(path, { body, method, retry = true } = {}) {
  const headers = new Headers();
  if (body !== undefined) headers.set('Content-Type', 'application/json');
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);

  const response = await fetch(path, {
    method: method || (body === undefined ? 'GET' : 'POST'),
    headers,
    credentials: 'same-origin',
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let payload;
  try {
    payload = await response.json();
  } catch {
    if (!response.ok) {
      throw new Error(`The server returned HTTP ${response.status} for ${path} without a JSON error response.`);
    }
    throw new Error(`The server returned a non-JSON response for ${path} (HTTP ${response.status}, ${response.headers.get('content-type') || 'no content type'}).`);
  }

  if (!payload || typeof payload !== 'object') {
    throw new Error(`The server returned an invalid JSON response for ${path} (HTTP ${response.status}).`);
  }

  if (response.status === 401 && retry && path !== '/api/auth/refresh') {
    const refreshed = await send('/api/auth/refresh', { body: {} , retry: false }).catch(() => null);
    if (refreshed?.data?.access_token) {
      accessToken = refreshed.data.access_token;
      return send(path, { body, retry: false });
    }
  }

  if (!response.ok || payload.success === false) {
    const error = new Error(payload.error || payload.message || 'The request could not be completed.');
    error.status = response.status;
    error.fields = payload.errors || {};
    throw error;
  }
  return payload;
}

export async function signIn(email, password) {
  const result = await send('/api/auth/login', { body: { email, password }, retry: false });
  accessToken = result.data.access_token;
  return authenticatedUser(result);
}

export function registerEmployee(details) {
  return send('/api/auth/register', { body: details, retry: false });
}

export function loadTodayAttendance() {
  return send('/api/employee/attendance/today');
}

export function loadAttendanceHistory() {
  return send('/api/employee/attendance');
}

export function recordTimeIn() {
  return send('/api/attendance/time-in', { body: {} });
}

export function recordTimeOut() {
  return send('/api/attendance/time-out', { body: {} });
}

function responseData(payload) {
  return payload?.data ?? payload;
}

function responseList(payload, key) {
  const list = responseData(payload)?.[key];
  if (!Array.isArray(list)) {
    const rootKeys = Object.keys(payload ?? {}).join(', ') || 'none';
    const dataKeys = Object.keys(payload?.data ?? {}).join(', ') || 'none';
    throw new Error(`Invalid ${key} response (root fields: ${rootKeys}; data fields: ${dataKeys}).`);
  }
  return list;
}

export function loadAdminOverview() {
  return Promise.all([
    send('/api/admin/dashboard'),
    send('/api/admin/registrations'),
    send('/api/admin/departments'),
    send('/api/admin/employees'),
  ]).then(([dashboard, registrations, departments, employees]) => ({
    dashboard: responseData(dashboard),
    registrations: responseList(registrations, 'registrations'),
    departments: responseList(departments, 'departments'),
    employees: responseList(employees, 'employees'),
  }));
}

export function loadAdminAnalytics() {
  return send('/api/admin/analytics');
}

function queryString(filters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') params.set(key, value);
  });
  return params.toString();
}

export function loadAdminAttendance(filters) {
  return send(`/api/admin/reports/attendance?${queryString(filters)}`);
}

export function approveRegistration(id, department_id) {
  return send(`/api/admin/registrations/${id}/approve`, { method: 'PATCH', body: { department_id } });
}

export function rejectRegistration(id) {
  return send(`/api/admin/registrations/${id}/reject`, { method: 'PATCH', body: {} });
}

export function createDepartment(details) {
  return send('/api/admin/departments', { body: details });
}

export function setDepartmentStatus(id, status) {
  return send(`/api/admin/departments/${id}/status`, { method: 'PATCH', body: { status } });
}

export function setEmployeeStatus(id, account_status) {
  return send(`/api/admin/employees/${id}/status`, { method: 'PATCH', body: { account_status } });
}

export async function downloadAttendanceReport(filters) {
  const path = `/api/admin/reports/attendance/export?${queryString(filters)}`;
  const fetchFile = () => fetch(path, {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    credentials: 'same-origin',
  });
  let response = await fetchFile();
  if (response.status === 401) {
    const refreshed = await send('/api/auth/refresh', { body: {}, retry: false });
    accessToken = refreshed.data.access_token;
    response = await fetchFile();
  }
  if (!response.ok) throw new Error('CSV export could not be downloaded.');
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'attendance-report.csv';
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function restoreSession() {
  const refreshed = await send('/api/auth/refresh', { body: {}, retry: false });
  accessToken = refreshed.data.access_token;
  return authenticatedUser(refreshed);
}

export async function signOut() {
  try {
    await send('/api/auth/logout', { body: {}, retry: false });
  } finally {
    accessToken = null;
  }
}

export function currentUser() {
  return send('/api/auth/me');
}
