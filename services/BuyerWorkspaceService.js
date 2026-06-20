import { api } from './api';

const compactPayload = (payload = {}) => (
  Object.entries(payload).reduce((acc, [key, value]) => {
    if (value !== undefined && value !== null && value !== '') acc[key] = value;
    return acc;
  }, {})
);

export const askBuyerWorkspaceAssistant = async (payload = {}) => {
  const { data } = await api.post('/api/buyer-workspace/assistant', compactPayload(payload), {
    timeout: 45000,
  });
  return data?.assistant || data;
};
