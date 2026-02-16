import { QueryClient, type QueryFunctionContext } from "@tanstack/react-query";
import { apiRequest } from "./utils";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});

export async function getQueryFn({ queryKey }: QueryFunctionContext) {
  const [url, params] = queryKey as [string, Record<string, unknown> | undefined];
  if (typeof url !== "string") throw new Error("Invalid QueryKey");
  
  const queryString = params 
    ? "?" + new URLSearchParams(params as Record<string, string>).toString() 
    : "";
    
  const res = await apiRequest("GET", url + queryString);
  if (!res.ok) {
    throw new Error(`${res.status}: ${res.statusText}`);
  }
  return res.json();
}
