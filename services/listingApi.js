import { api } from "./api";

export const getListingById = async (id) => {
  const { data } = await api.get(`/listings/${id}`);
  return data;
};
