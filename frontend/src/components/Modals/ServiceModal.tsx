import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Edit2, Search } from 'lucide-react';
import { Service, ServiceGroup } from '../../types';
import { apiFetch } from '../../utils/api';

interface ServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  services: Service[];
  serviceGroups: ServiceGroup[];
  authToken: string | null;
  onServiceAdded: (service: Service) => void;
  onServiceUpdated: (service: Service) => void;
  onServiceDeleted: (serviceId: string) => void;
  onGroupAdded: (group: ServiceGroup) => void;
  onGroupUpdated: (group: ServiceGroup) => void;
  onGroupDeleted: (groupId: string) => void;
}

const ServiceModal: React.FC<ServiceModalProps> = ({
  isOpen,
  onClose,
  services,
  serviceGroups,
  authToken,
  onServiceAdded,
  onServiceUpdated,
  onServiceDeleted,
  onGroupAdded,
  onGroupUpdated,
  onGroupDeleted
}) => {
  const [activeTab, setActiveTab] = useState<'services' | 'groups'>('services');
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Service Form State
  const [serviceName, setServiceName] = useState('');
  const [defaultCharge, setDefaultCharge] = useState(0);
  const [serviceCost, setServiceCost] = useState(0);
  const [groupId, setGroupId] = useState('');
  const [showNewGroupForm, setShowNewGroupForm] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');

  // Group Form State
  const [groupName, setGroupName] = useState('');

  useEffect(() => {
    if (!isOpen) {
      resetForms();
    }
  }, [isOpen]);

  const resetForms = () => {
    setServiceName('');
    setDefaultCharge(0);
    setServiceCost(0);
    setGroupId('');
    setIsEditing(false);
    setEditingId(null);
    setShowNewGroupForm(false);
    setNewGroupName('');
    setGroupName('');
  };

  const handleCreateGroup = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newGroupName.trim() && !groupName.trim()) return;

    const nameToSave = showNewGroupForm ? newGroupName : groupName;

    try {
      const res = await apiFetch('/api/data/service-groups', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
        },
        body: JSON.stringify({ name: nameToSave })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        onGroupAdded(data.data.group);
        if (showNewGroupForm) {
          setGroupId(data.data.group._id);
          setShowNewGroupForm(false);
          setNewGroupName('');
        } else {
          setGroupName('');
        }
      }
    } catch (error) {
      console.error('Failed to create group:', error);
    }
  };

  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceName || !groupId) return;

    const payload = {
      name: serviceName,
      defaultCharge,
      serviceCost,
      defaultProfit: defaultCharge - serviceCost,
      groupId
    };

    try {
      const url = isEditing ? `/api/data/services/${editingId}` : '/api/data/services';
      const res = await apiFetch(url, {
        method: isEditing ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (isEditing) {
          onServiceUpdated(data.data.service);
        } else {
          onServiceAdded(data.data.service);
        }
        resetForms();
      }
    } catch (error) {
      console.error('Failed to save service:', error);
    }
  };

  const handleEditService = (service: Service) => {
    if (!service) return;
    setServiceName(service.name || '');
    setDefaultCharge(service.defaultCharge || 0);
    setServiceCost(service.serviceCost || 0);
    
    let gId = '';
    if (service.groupId) {
      gId = typeof service.groupId === 'string' ? service.groupId : service.groupId._id;
    }
    setGroupId(gId);
    
    setIsEditing(true);
    setEditingId(service._id);
    setActiveTab('services');
  };

  const handleDeleteService = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this service?')) return;
    try {
      const res = await apiFetch(`/api/data/services/${id}`, {
        method: 'DELETE',
        headers: { ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) }
      });
      if (res.ok) {
        onServiceDeleted(id);
      }
    } catch (error) {
      console.error('Failed to delete service:', error);
    }
  };

  const filteredServices = (services || []).filter(s =>
    (s.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (typeof s.groupId !== 'string' && s.groupId && (s.groupId.name || '').toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60]">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold">Manage Services & Groups</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        <div className="flex border-b px-6">
          <button
            className={`py-3 px-6 font-medium border-b-2 transition-colors ${activeTab === 'services' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            onClick={() => setActiveTab('services')}
          >
            Services
          </button>
          <button
            className={`py-3 px-6 font-medium border-b-2 transition-colors ${activeTab === 'groups' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            onClick={() => setActiveTab('groups')}
          >
            Groups
          </button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto">
          {activeTab === 'services' ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Service Form */}
              <div>
                <h3 className="text-lg font-medium mb-4">{isEditing ? 'Edit Service' : 'Add New Service'}</h3>
                <form onSubmit={handleSaveService} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Service Name</label>
                    <input
                      type="text"
                      value={serviceName}
                      onChange={(e) => setServiceName(e.target.value)}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                      placeholder="e.g. Income Certificate"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Default Charge</label>
                      <input
                        type="number"
                        value={defaultCharge}
                        onChange={(e) => setDefaultCharge(Number(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Service Cost</label>
                      <input
                        type="number"
                        value={serviceCost}
                        onChange={(e) => setServiceCost(Number(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Group / Category</label>
                    <div className="flex gap-2">
                      <select
                        value={groupId}
                        onChange={(e) => setGroupId(e.target.value)}
                        required
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="">Select a group</option>
                        {(serviceGroups || []).map(group => (
                          <option key={group._id} value={group._id}>{group.name}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setShowNewGroupForm(!showNewGroupForm)}
                        className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"
                        title="Create New Group"
                      >
                        <Plus size={20} />
                      </button>
                    </div>
                  </div>

                  {showNewGroupForm && (
                    <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <label className="block text-sm font-medium text-gray-700 mb-1">New Group Name</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newGroupName}
                          onChange={(e) => setNewGroupName(e.target.value)}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                          placeholder="Enter group name"
                        />
                        <button
                          type="button"
                          onClick={() => handleCreateGroup()}
                          className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <button
                      type="submit"
                      className="flex-1 bg-emerald-600 text-white py-2 rounded-lg font-medium hover:bg-emerald-700"
                    >
                      {isEditing ? 'Update Service' : 'Create Service'}
                    </button>
                    {isEditing && (
                      <button
                        type="button"
                        onClick={resetForms}
                        className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </form>
              </div>

              {/* Service List */}
              <div className="flex flex-col h-full">
                <div className="mb-4 relative">
                  <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                  <input
                    type="text"
                    placeholder="Search services..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div className="flex-1 border rounded-lg overflow-hidden">
                  <div className="max-h-[400px] overflow-y-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-gray-50 text-gray-700 uppercase text-xs font-semibold">
                        <tr>
                          <th className="px-4 py-3">Name</th>
                          <th className="px-4 py-3">Group</th>
                          <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {filteredServices.map(service => (
                          <tr key={service._id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium text-gray-900">{service.name}</td>
                            <td className="px-4 py-3 text-gray-500">
                              {typeof service.groupId === 'string' 
                                ? service.groupId 
                                : (service.groupId?.name || 'No Group')}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex justify-end gap-2">
                                <button
                                  onClick={() => handleEditService(service)}
                                  className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                                >
                                  <Edit2 size={16} />
                                </button>
                                <button
                                  onClick={() => handleDeleteService(service._id)}
                                  className="p-1 text-red-600 hover:bg-red-50 rounded"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Group Form */}
              <div>
                <h3 className="text-lg font-medium mb-4">Add New Group</h3>
                <form onSubmit={handleCreateGroup} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Group Name</label>
                    <input
                      type="text"
                      value={groupName}
                      onChange={(e) => setGroupName(e.target.value)}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                      placeholder="e.g. Government Services"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-emerald-600 text-white py-2 rounded-lg font-medium hover:bg-emerald-700"
                  >
                    Create Group
                  </button>
                </form>
              </div>

              {/* Group List */}
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 text-gray-700 uppercase text-xs font-semibold">
                    <tr>
                      <th className="px-4 py-3">Group Name</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {(serviceGroups || []).map(group => (
                      <tr key={group._id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">{group.name}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={async () => {
                              if (window.confirm('Delete this group? Services in this group will still exist but their group will be missing.')) {
                                try {
                                  const res = await apiFetch(`/api/data/service-groups/${group._id}`, {
                                    method: 'DELETE',
                                    headers: { ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) }
                                  });
                                  if (res.ok) onGroupDeleted(group._id);
                                } catch (error) { console.error(error); }
                              }
                            }}
                            className="p-1 text-red-600 hover:bg-red-50 rounded"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ServiceModal;
