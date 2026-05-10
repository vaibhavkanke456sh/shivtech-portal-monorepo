import Service from '../models/Service.js';
import ServiceGroup from '../models/ServiceGroup.js';

// Service Group Controllers
export const getServiceGroups = async (req, res) => {
  try {
    const groups = await ServiceGroup.find({ isDeleted: false, owner: req.user._id });
    res.json({ success: true, data: { groups } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createServiceGroup = async (req, res) => {
  try {
    const { name } = req.body;
    const existing = await ServiceGroup.findOne({ name, owner: req.user._id, isDeleted: false });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Group already exists' });
    }
    const group = new ServiceGroup({ name, owner: req.user._id });
    await group.save();
    res.status(201).json({ success: true, data: { group } });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const updateServiceGroup = async (req, res) => {
  try {
    const group = await ServiceGroup.findOneAndUpdate(
      { _id: req.params.id, owner: req.user._id },
      req.body,
      { new: true }
    );
    if (!group) return res.status(404).json({ success: false, message: 'Group not found' });
    res.json({ success: true, data: { group } });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const deleteServiceGroup = async (req, res) => {
  try {
    const group = await ServiceGroup.findOneAndUpdate(
      { _id: req.params.id, owner: req.user._id },
      { isDeleted: true, deletedAt: new Date() },
      { new: true }
    );
    if (!group) return res.status(404).json({ success: false, message: 'Group not found' });
    res.json({ success: true, message: 'Group deleted successfully' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Service Controllers
export const getServices = async (req, res) => {
  try {
    const services = await Service.find({ isDeleted: false, owner: req.user._id }).populate('groupId');
    res.json({ success: true, data: { services } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createService = async (req, res) => {
  try {
    const { name, defaultCharge, serviceCost, defaultProfit, groupId } = req.body;
    const service = new Service({
      name,
      defaultCharge,
      serviceCost,
      defaultProfit,
      groupId,
      owner: req.user._id
    });
    await service.save();
    const populatedService = await Service.findById(service._id).populate('groupId');
    res.status(201).json({ success: true, data: { service: populatedService } });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const updateService = async (req, res) => {
  try {
    const service = await Service.findOneAndUpdate(
      { _id: req.params.id, owner: req.user._id },
      req.body,
      { new: true }
    ).populate('groupId');
    if (!service) return res.status(404).json({ success: false, message: 'Service not found' });
    res.json({ success: true, data: { service } });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const deleteService = async (req, res) => {
  try {
    const service = await Service.findOneAndUpdate(
      { _id: req.params.id, owner: req.user._id },
      { isDeleted: true, deletedAt: new Date() },
      { new: true }
    );
    if (!service) return res.status(404).json({ success: false, message: 'Service not found' });
    res.json({ success: true, message: 'Service deleted successfully' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
