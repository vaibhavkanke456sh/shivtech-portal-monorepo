import React, { useState } from 'react';
import { Client, Task } from '../../types';

type FullClient = Omit<Client, 'id' | 'createdAt'> & {
  photo?: string;
  fatherName: string;
  dob: string;
  profession: string;
  gender: string;
  address1: string;
  address2: string;
  address3: string;
  address4: string;
  pinCode: string;
  instagram: string;
  whatsapp: string;
  adharFront?: string;
  adharBack?: string;
  voterFront?: string;
  voterBack?: string;
  rationFront?: string;
  rationBack?: string;
};

interface ClientListProps {
  clients: Client[];
  tasks: Task[];
  onAdd: (client: Omit<Client, 'id' | 'createdAt'>) => void;
  onEdit: (client: Client) => void;
  onDelete: (clientId: string) => void;
  showAddModal?: boolean;
  setShowAddModal?: (show: boolean) => void;
}

const ClientList: React.FC<ClientListProps> = ({ clients, tasks, onAdd, onEdit, onDelete, showAddModal, setShowAddModal }) => {
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  // Sync showAdd with showAddModal prop if provided
  React.useEffect(() => {
    if (typeof showAddModal === 'boolean') setShowAdd(showAddModal);
  }, [showAddModal]);
  const initialClientState: FullClient = {
    photo: '',
    name: '',
    fatherName: '',
    dob: '',
    profession: '',
    gender: '',
    address1: '',
    address2: '',
    address3: '',
    address4: '',
    pinCode: '',
    phone: '',
    instagram: '',
    whatsapp: '',
    adharFront: '',
    adharBack: '',
    voterFront: '',
    voterBack: '',
    rationFront: '',
    rationBack: ''
  };
  const [newClient, setNewClient] = useState<FullClient>(initialClientState);
  const [editClient, setEditClient] = useState<FullClient | null>(null);
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [showEdit, setShowEdit] = useState(false);

  const filteredClients = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search)
  );

  // Helper to convert Client to FullClient for editing
  const toFullClient = (client: Client): FullClient => ({
    ...initialClientState,
    ...client,
  });

  // Helper to convert FullClient to Client for onAdd/onEdit
  const toClient = (full: FullClient): Omit<Client, 'id' | 'createdAt'> => {
    // Only keep fields that exist in Client
    const { name, phone } = full;
    return { name, phone };
  };

  const getClientStats = (clientId: string) => {
    const clientTasks = tasks.filter(t => t.customerName === clients.find(c => c.id === clientId)?.name);
    const totalRevenue = clientTasks.reduce((sum, t) => sum + (t.finalCharges || 0), 0);
    return { totalTasks: clientTasks.length, totalRevenue };
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-800">Clients</h2>
        <button
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
          onClick={() => setShowAdd(true)}
        >
          Add New Client
        </button>
      </div>
      <input
        type="text"
        placeholder="Search clients by name or phone..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="mb-4 px-3 py-2 border border-gray-300 rounded-lg w-full"
      />
      <table className="w-full">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-2 text-left">Photo</th>
            <th className="px-4 py-2 text-left">Name</th>
            <th className="px-4 py-2 text-left">Phone</th>
            <th className="px-4 py-2 text-left">Created</th>
            <th className="px-4 py-2 text-left">Total Tasks</th>
            <th className="px-4 py-2 text-left">Total Revenue</th>
            <th className="px-4 py-2 text-left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredClients.map(client => {
            const stats = getClientStats(client.id);
            // Try to parse photo from client if present (for demo, store in localStorage or backend for real app)
            let photo: string | undefined = undefined;
            // @ts-ignore
            if ((client as any).photo) photo = (client as any).photo;
            return (
              <tr key={client.id} className="hover:bg-gray-50">
                <td className="px-4 py-2">
                  {photo ? <img src={photo} alt="Client" className="w-10 h-10 rounded-full object-cover" /> : <span className="text-gray-400">No Photo</span>}
                </td>
                <td className="px-4 py-2">{client.name}</td>
                <td className="px-4 py-2">{client.phone}</td>
                <td className="px-4 py-2">{client.createdAt}</td>
                <td className="px-4 py-2">{stats.totalTasks}</td>
                <td className="px-4 py-2">₹{stats.totalRevenue}</td>
                <td className="px-4 py-2">
                  <button className="text-blue-600 mr-2" onClick={() => { setEditClient(toFullClient(client)); setEditingClientId(client.id); setShowEdit(true); }}>Edit</button>
                  <button className="text-red-600" onClick={() => onDelete(client.id)}>Delete</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Add/Edit Client Modal */}
      {(showAdd || showEdit) && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-30 z-50">
          <div className="bg-white p-6 rounded-xl shadow-lg w-full max-w-lg overflow-y-auto max-h-[90vh]">
            <h3 className="text-lg font-semibold mb-4">{showAdd ? 'Add New Client' : 'Edit Client'}</h3>
            <form
              onSubmit={e => {
                e.preventDefault();
                if (showAdd) {
                  if (newClient.name && newClient.phone) {
                    onAdd(toClient(newClient));
                    setShowAdd(false);
                    setNewClient(initialClientState);
                  }
                } else if (showEdit && editClient) {
                  const id = editingClientId || '';
                  const existing = clients.find(c => c.id === id);
                  onEdit({ ...editClient, id, createdAt: existing?.createdAt || '' });
                  setShowEdit(false);
                  setEditClient(null);
                  setEditingClientId(null);
                }
              }}
            >
              {/* Photo upload */}
              <label className="block mb-2 font-medium">Photo (max 1MB)</label>
              <input type="file" accept="image/*" className="mb-2" onChange={e => {
                const file = e.target.files?.[0];
                if (file && file.size <= 1024 * 1024) {
                  const reader = new FileReader();
                  reader.onload = ev => {
                    if (showAdd) setNewClient(c => ({ ...c, photo: ev.target?.result as string }));
                    if (showEdit && editClient) setEditClient(c => c ? { ...c, photo: ev.target?.result as string } : null);
                  };
                  reader.readAsDataURL(file);
                }
              }} />
              <input type="text" placeholder="Name" value={showAdd ? newClient.name : editClient?.name || ''} onChange={e => showAdd ? setNewClient(c => ({ ...c, name: e.target.value })) : setEditClient(c => c ? { ...c, name: e.target.value } : null)} className="mb-2 px-3 py-2 border border-gray-300 rounded-lg w-full" />
              <input type="text" placeholder="Father Name" value={showAdd ? newClient.fatherName : editClient?.fatherName || ''} onChange={e => showAdd ? setNewClient(c => ({ ...c, fatherName: e.target.value })) : setEditClient(c => c ? { ...c, fatherName: e.target.value } : null)} className="mb-2 px-3 py-2 border border-gray-300 rounded-lg w-full" />
              <input type="date" placeholder="Date of Birth" value={showAdd ? newClient.dob : editClient?.dob || ''} onChange={e => showAdd ? setNewClient(c => ({ ...c, dob: e.target.value })) : setEditClient(c => c ? { ...c, dob: e.target.value } : null)} className="mb-2 px-3 py-2 border border-gray-300 rounded-lg w-full" />
              <input type="text" placeholder="Profession" value={showAdd ? newClient.profession : editClient?.profession || ''} onChange={e => showAdd ? setNewClient(c => ({ ...c, profession: e.target.value })) : setEditClient(c => c ? { ...c, profession: e.target.value } : null)} className="mb-2 px-3 py-2 border border-gray-300 rounded-lg w-full" />
              <select value={showAdd ? newClient.gender : editClient?.gender || ''} onChange={e => showAdd ? setNewClient(c => ({ ...c, gender: e.target.value })) : setEditClient(c => c ? { ...c, gender: e.target.value } : null)} className="mb-2 px-3 py-2 border border-gray-300 rounded-lg w-full">
                <option value="">Select Gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
              <input type="text" placeholder="Address Line 1" value={showAdd ? newClient.address1 : editClient?.address1 || ''} onChange={e => showAdd ? setNewClient(c => ({ ...c, address1: e.target.value })) : setEditClient(c => c ? { ...c, address1: e.target.value } : null)} className="mb-2 px-3 py-2 border border-gray-300 rounded-lg w-full" />
              <input type="text" placeholder="Address Line 2" value={showAdd ? newClient.address2 : editClient?.address2 || ''} onChange={e => showAdd ? setNewClient(c => ({ ...c, address2: e.target.value })) : setEditClient(c => c ? { ...c, address2: e.target.value } : null)} className="mb-2 px-3 py-2 border border-gray-300 rounded-lg w-full" />
              <input type="text" placeholder="Address Line 3" value={showAdd ? newClient.address3 : editClient?.address3 || ''} onChange={e => showAdd ? setNewClient(c => ({ ...c, address3: e.target.value })) : setEditClient(c => c ? { ...c, address3: e.target.value } : null)} className="mb-2 px-3 py-2 border border-gray-300 rounded-lg w-full" />
              <input type="text" placeholder="Address Line 4" value={showAdd ? newClient.address4 : editClient?.address4 || ''} onChange={e => showAdd ? setNewClient(c => ({ ...c, address4: e.target.value })) : setEditClient(c => c ? { ...c, address4: e.target.value } : null)} className="mb-2 px-3 py-2 border border-gray-300 rounded-lg w-full" />
              <input type="text" placeholder="Pin Code" value={showAdd ? newClient.pinCode : editClient?.pinCode || ''} onChange={e => showAdd ? setNewClient(c => ({ ...c, pinCode: e.target.value })) : setEditClient(c => c ? { ...c, pinCode: e.target.value } : null)} className="mb-2 px-3 py-2 border border-gray-300 rounded-lg w-full" />
              <input type="text" placeholder="Mobile Number" value={showAdd ? newClient.phone : editClient?.phone || ''} onChange={e => showAdd ? setNewClient(c => ({ ...c, phone: e.target.value })) : setEditClient(c => c ? { ...c, phone: e.target.value } : null)} className="mb-2 px-3 py-2 border border-gray-300 rounded-lg w-full" />
              <input type="text" placeholder="Instagram Account" value={showAdd ? newClient.instagram : editClient?.instagram || ''} onChange={e => showAdd ? setNewClient(c => ({ ...c, instagram: e.target.value })) : setEditClient(c => c ? { ...c, instagram: e.target.value } : null)} className="mb-2 px-3 py-2 border border-gray-300 rounded-lg w-full" />
              <input type="text" placeholder="WhatsApp Number" value={showAdd ? newClient.whatsapp : editClient?.whatsapp || ''} onChange={e => showAdd ? setNewClient(c => ({ ...c, whatsapp: e.target.value })) : setEditClient(c => c ? { ...c, whatsapp: e.target.value } : null)} className="mb-2 px-3 py-2 border border-gray-300 rounded-lg w-full" />
              {/* File uploads for documents */}
              <label className="block mt-2 font-medium">Upload Aadhaar Front (max 1MB)</label>
              <input type="file" accept="image/*" className="mb-2" onChange={e => {
                const file = e.target.files?.[0];
                if (file && file.size <= 1024 * 1024) {
                  const reader = new FileReader();
                  reader.onload = ev => {
                    if (showAdd) setNewClient(c => ({ ...c, adharFront: ev.target?.result as string }));
                    if (showEdit && editClient) setEditClient(c => c ? { ...c, adharFront: ev.target?.result as string } : null);
                  };
                  reader.readAsDataURL(file);
                }
              }} />
              <label className="block font-medium">Upload Aadhaar Back (max 1MB)</label>
              <input type="file" accept="image/*" className="mb-2" onChange={e => {
                const file = e.target.files?.[0];
                if (file && file.size <= 1024 * 1024) {
                  const reader = new FileReader();
                  reader.onload = ev => {
                    if (showAdd) setNewClient(c => ({ ...c, adharBack: ev.target?.result as string }));
                    if (showEdit && editClient) setEditClient(c => c ? { ...c, adharBack: ev.target?.result as string } : null);
                  };
                  reader.readAsDataURL(file);
                }
              }} />
              <label className="block font-medium">Upload Voter ID Front (max 1MB)</label>
              <input type="file" accept="image/*" className="mb-2" onChange={e => {
                const file = e.target.files?.[0];
                if (file && file.size <= 1024 * 1024) {
                  const reader = new FileReader();
                  reader.onload = ev => {
                    if (showAdd) setNewClient(c => ({ ...c, voterFront: ev.target?.result as string }));
                    if (showEdit && editClient) setEditClient(c => c ? { ...c, voterFront: ev.target?.result as string } : null);
                  };
                  reader.readAsDataURL(file);
                }
              }} />
              <label className="block font-medium">Upload Voter ID Back (max 1MB)</label>
              <input type="file" accept="image/*" className="mb-2" onChange={e => {
                const file = e.target.files?.[0];
                if (file && file.size <= 1024 * 1024) {
                  const reader = new FileReader();
                  reader.onload = ev => {
                    if (showAdd) setNewClient(c => ({ ...c, voterBack: ev.target?.result as string }));
                    if (showEdit && editClient) setEditClient(c => c ? { ...c, voterBack: ev.target?.result as string } : null);
                  };
                  reader.readAsDataURL(file);
                }
              }} />
              <label className="block font-medium">Upload Ration Card Front (max 1MB)</label>
              <input type="file" accept="image/*" className="mb-2" onChange={e => {
                const file = e.target.files?.[0];
                if (file && file.size <= 1024 * 1024) {
                  const reader = new FileReader();
                  reader.onload = ev => {
                    if (showAdd) setNewClient(c => ({ ...c, rationFront: ev.target?.result as string }));
                    if (showEdit && editClient) setEditClient(c => c ? { ...c, rationFront: ev.target?.result as string } : null);
                  };
                  reader.readAsDataURL(file);
                }
              }} />
              <label className="block font-medium">Upload Ration Card Back (max 1MB)</label>
              <input type="file" accept="image/*" className="mb-4" onChange={e => {
                const file = e.target.files?.[0];
                if (file && file.size <= 1024 * 1024) {
                  const reader = new FileReader();
                  reader.onload = ev => {
                    if (showAdd) setNewClient(c => ({ ...c, rationBack: ev.target?.result as string }));
                    if (showEdit && editClient) setEditClient(c => c ? { ...c, rationBack: ev.target?.result as string } : null);
                  };
                  reader.readAsDataURL(file);
                }
              }} />
              <div className="flex justify-end gap-2">
                <button
                  className="px-4 py-2 bg-gray-200 rounded-lg"
                  type="button"
                  onClick={() => {
                    if (showAdd) {
                      setShowAdd(false);
                      setNewClient(initialClientState);
                      if (setShowAddModal) setShowAddModal(false);
                    } else {
                      setShowEdit(false);
                      setEditClient(null);
                    }
                  }}
                >Cancel</button>
                <button
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg"
                  type="submit"
                >{showAdd ? 'Add' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientList;
