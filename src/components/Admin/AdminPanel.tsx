import React, { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../utils/api';

type Role = 'user' | 'admin' | 'developer';

interface AdminPanelProps {
	token: string;
	role: Role;
}

interface SimpleUser {
	id: string;
	username: string;
	email: string;
	firstName?: string;
	lastName?: string;
	role: 'user' | 'admin' | 'web_developer';
}

const AdminPanel: React.FC<AdminPanelProps> = ({ token, role }) => {
	const isDeveloper = role === 'developer';
	const isAdmin = role === 'admin';

	const [users, setUsers] = useState<SimpleUser[]>([]);
	const [loadingUsers, setLoadingUsers] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [message, setMessage] = useState<string | null>(null);

	// Create Admin form
	const [adminForm, setAdminForm] = useState({
		username: '', email: '', password: '', firstName: '', lastName: ''
	});

	// Create User form
	const [userForm, setUserForm] = useState({
		username: '', email: '', password: '', firstName: '', lastName: ''
	});

	// Change Username via OTP (developer only)
	const [changeUsernameForm, setChangeUsernameForm] = useState({
		userId: '', newUsername: '', otp: ''
	});

	// Delete account (developer only)
	const [deleteUserId, setDeleteUserId] = useState('');

	const authHeaders = useMemo(() => ({
		'Content-Type': 'application/json',
		'Authorization': `Bearer ${token}`
	}), [token]);

	const api = async (path: string, init?: RequestInit) => {
		const res = await apiFetch(path, {
			...init,
			headers: { ...(init?.headers || {}), ...authHeaders }
		});
		let data: any = null;
		try { data = await res.json(); } catch {}
		return { res, data } as const;
	};

	const loadUsers = async () => {
		try {
			setLoadingUsers(true);
			setError(null);
			const { res, data } = await api('/api/admin/users?limit=20');
			if (!res.ok || !data?.success) throw new Error(data?.message || 'Failed to load users');
			const list: SimpleUser[] = (data.data.users || []).map((u: any) => ({
				id: u._id,
				username: u.username,
				email: u.email,
				firstName: u.firstName,
				lastName: u.lastName,
				role: u.role
			}));
			setUsers(list);
		} catch (e: any) {
			setError(e.message || 'Failed to load users');
		} finally {
			setLoadingUsers(false);
		}
	};

	useEffect(() => { loadUsers(); }, []);

	return (
		<div className="space-y-8">
			<h2 className="text-2xl font-semibold">Admin Panel</h2>
			{message && <div className="text-emerald-700 text-sm">{message}</div>}
			{error && <div className="text-red-600 text-sm">{error}</div>}

			{isDeveloper && (
				<div className="bg-white border rounded-lg p-4 space-y-3">
					<h3 className="font-medium">Create Admin</h3>
					<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
						<input className="border rounded-md px-3 py-2" placeholder="Username" value={adminForm.username} onChange={e=>setAdminForm({...adminForm, username:e.target.value})} />
						<input className="border rounded-md px-3 py-2" placeholder="Email" value={adminForm.email} onChange={e=>setAdminForm({...adminForm, email:e.target.value})} />
						<input className="border rounded-md px-3 py-2" placeholder="First name" value={adminForm.firstName} onChange={e=>setAdminForm({...adminForm, firstName:e.target.value})} />
						<input className="border rounded-md px-3 py-2" placeholder="Last name" value={adminForm.lastName} onChange={e=>setAdminForm({...adminForm, lastName:e.target.value})} />
						<input className="border rounded-md px-3 py-2 md:col-span-2" placeholder="Password" type="password" value={adminForm.password} onChange={e=>setAdminForm({...adminForm, password:e.target.value})} />
					</div>
					<button
						className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700"
						onClick={async ()=>{
							try {
								setMessage(null); setError(null);
								const { res, data } = await api('/api/admin/create-admin', { method:'POST', body: JSON.stringify(adminForm) });
								if (!res.ok || !data?.success) throw new Error(data?.message || 'Failed to create admin');
								setMessage('Admin created successfully');
								setAdminForm({ username:'', email:'', password:'', firstName:'', lastName:'' });
								loadUsers();
							} catch (e:any) { setError(e.message || 'Failed to create admin'); }
						}}
					>
						Create Admin
					</button>
				</div>
			)}

			{(isDeveloper || isAdmin) && (
				<div className="bg-white border rounded-lg p-4 space-y-3">
					<h3 className="font-medium">Create User</h3>
					<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
						<input className="border rounded-md px-3 py-2" placeholder="Username" value={userForm.username} onChange={e=>setUserForm({...userForm, username:e.target.value})} />
						<input className="border rounded-md px-3 py-2" placeholder="Email" value={userForm.email} onChange={e=>setUserForm({...userForm, email:e.target.value})} />
						<input className="border rounded-md px-3 py-2" placeholder="First name" value={userForm.firstName} onChange={e=>setUserForm({...userForm, firstName:e.target.value})} />
						<input className="border rounded-md px-3 py-2" placeholder="Last name" value={userForm.lastName} onChange={e=>setUserForm({...userForm, lastName:e.target.value})} />
						<input className="border rounded-md px-3 py-2 md:col-span-2" placeholder="Password" type="password" value={userForm.password} onChange={e=>setUserForm({...userForm, password:e.target.value})} />
					</div>
					<button
						className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
						onClick={async ()=>{
							try {
								setMessage(null); setError(null);
								const { res, data } = await api('/api/admin/create-user', { method:'POST', body: JSON.stringify(userForm) });
								if (!res.ok || !data?.success) throw new Error(data?.message || 'Failed to create user');
								setMessage('User created successfully');
								setUserForm({ username:'', email:'', password:'', firstName:'', lastName:'' });
								loadUsers();
							} catch (e:any) { setError(e.message || 'Failed to create user'); }
						}}
					>
						Create User
					</button>
				</div>
			)}

			{isDeveloper && (
				<div className="bg-white border rounded-lg p-4 space-y-3">
					<h3 className="font-medium">Change Username (via OTP)</h3>
					<div className="flex gap-2 flex-wrap">
						<button
							className="px-3 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700"
							onClick={async ()=>{
								try {
									setMessage(null); setError(null);
									const { res, data } = await api('/api/auth/request-otp', { method:'POST', body: JSON.stringify({ purpose:'change_username' }) });
									if (!res.ok || !data?.success) throw new Error(data?.message || 'Failed to send OTP');
									setMessage('OTP sent to your email for username change.');
								} catch (e:any) { setError(e.message || 'Failed to send OTP'); }
							}}
						>
							Request OTP
						</button>
						<input className="border rounded-md px-3 py-2 flex-1 min-w-44" placeholder="Target User ID" value={changeUsernameForm.userId} onChange={e=>setChangeUsernameForm({...changeUsernameForm, userId:e.target.value})} />
						<input className="border rounded-md px-3 py-2 flex-1 min-w-44" placeholder="New Username" value={changeUsernameForm.newUsername} onChange={e=>setChangeUsernameForm({...changeUsernameForm, newUsername:e.target.value})} />
						<input className="border rounded-md px-3 py-2 w-32" placeholder="OTP" value={changeUsernameForm.otp} onChange={e=>setChangeUsernameForm({...changeUsernameForm, otp:e.target.value})} />
						<button
							className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
							onClick={async ()=>{
								try {
									setMessage(null); setError(null);
									const { res, data } = await api('/api/admin/change-username', { method:'PATCH', body: JSON.stringify(changeUsernameForm) });
									if (!res.ok || !data?.success) throw new Error(data?.message || 'Failed to change username');
									setMessage('Username changed successfully');
									setChangeUsernameForm({ userId:'', newUsername:'', otp:'' });
									loadUsers();
								} catch (e:any) { setError(e.message || 'Failed to change username'); }
							}}
						>
							Change Username
						</button>
					</div>
				</div>
			)}

			{isDeveloper && (
				<div className="bg-white border rounded-lg p-4 space-y-3">
					<h3 className="font-medium">Delete Account</h3>
					<div className="flex gap-2 flex-wrap items-center">
						<input className="border rounded-md px-3 py-2 flex-1 min-w-44" placeholder="User ID" value={deleteUserId} onChange={e=>setDeleteUserId(e.target.value)} />
						<button
							className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
							onClick={async ()=>{
								try {
									setMessage(null); setError(null);
									const { res, data } = await api(`/api/admin/delete-account/${deleteUserId}`, { method:'DELETE' });
									if (!res.ok || !data?.success) throw new Error(data?.message || 'Failed to delete account');
									setMessage('Account deleted successfully');
									setDeleteUserId('');
									loadUsers();
								} catch (e:any) { setError(e.message || 'Failed to delete account'); }
							}}
						>
							Delete
						</button>
					</div>
				</div>
			)}

			<div className="bg-white border rounded-lg p-4">
				<div className="flex items-center justify-between mb-3">
					<h3 className="font-medium">Users</h3>
					<button className="text-sm px-3 py-1 border rounded-md" onClick={loadUsers} disabled={loadingUsers}>{loadingUsers ? 'Refreshing…' : 'Refresh'}</button>
				</div>
				<div className="overflow-x-auto">
					<table className="min-w-full text-sm">
						<thead>
							<tr className="text-left border-b">
								<th className="py-2 pr-4">ID</th>
								<th className="py-2 pr-4">Username</th>
								<th className="py-2 pr-4">Email</th>
								<th className="py-2 pr-4">Role</th>
							</tr>
						</thead>
						<tbody>
							{users.map(u => (
								<tr key={u.id} className="border-b last:border-b-0">
									<td className="py-2 pr-4 align-top">{u.id}</td>
									<td className="py-2 pr-4 align-top">{u.username}</td>
									<td className="py-2 pr-4 align-top">{u.email}</td>
									<td className="py-2 pr-4 align-top">{u.role}</td>
								</tr>
							))}
							{users.length === 0 && (
								<tr><td colSpan={4} className="py-3 text-center text-gray-500">No users</td></tr>
							)}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	);
};

export default AdminPanel;



