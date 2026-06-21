import { api } from './api';

export const submitAgentEnquiry = async (payload) => {
  const { data } = await api.post('/api/agent-enquiries', payload);
  return data?.enquiry;
};

export const getAgentEnquiries = async () => {
  const { data } = await api.get('/api/agent-enquiries');
  return Array.isArray(data?.enquiries) ? data.enquiries : [];
};

export const updateAgentEnquiry = async (enquiryId, payload) => {
  const { data } = await api.patch(`/api/agent-enquiries/${enquiryId}`, payload);
  return data?.enquiry;
};
