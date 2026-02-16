import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { useLocation } from "wouter";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";

export function useAuth() {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const userQuery = useQuery({
    queryKey: [api.auth.me.path],
    queryFn: async () => {
      const res = await fetch(api.auth.me.path);
      if (res.status === 401) return null;
      if (!res.ok) throw new Error("Failed to fetch user");
      // The API returns { user: ... } or null directly depending on implementation
      // Adapting to route manifest response type
      return api.auth.me.responses[200].parse(await res.json());
    },
    retry: false,
    staleTime: Infinity, // User data doesn't change often
  });

  const sendOtpMutation = useMutation({
    mutationFn: async (data: { phoneNumber: string }) => {
      const res = await fetch(api.auth.sendOtp.path, {
        method: api.auth.sendOtp.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to send OTP");
      }
      return api.auth.sendOtp.responses[200].parse(await res.json());
    },
    onError: (error) => {
      toast({
        title: "ত্রুটি",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const verifyOtpMutation = useMutation({
    mutationFn: async (data: { phoneNumber: string; otp: string }) => {
      const res = await fetch(api.auth.verifyOtp.path, {
        method: api.auth.verifyOtp.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Invalid OTP");
      }
      return api.auth.verifyOtp.responses[200].parse(await res.json());
    },
    onSuccess: (data) => {
      queryClient.setQueryData([api.auth.me.path], data.user);
      toast({
        title: "স্বাগতম!",
        description: "লগইন সফল হয়েছে",
      });
      setLocation("/dashboard");
    },
    onError: (error) => {
      toast({
        title: "যাচাইকরণ ব্যর্থ হয়েছে",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(api.auth.logout.path, {
        method: api.auth.logout.method,
      });
      if (!res.ok) throw new Error("Logout failed");
    },
    onSuccess: () => {
      queryClient.setQueryData([api.auth.me.path], null);
      setLocation("/auth");
      toast({
        title: "বিদায়",
        description: "আপনি লগআউট করেছেন",
      });
    },
  });

  return {
    user: userQuery.data,
    isLoading: userQuery.isLoading,
    isAuthenticated: !!userQuery.data,
    sendOtp: sendOtpMutation,
    verifyOtp: verifyOtpMutation,
    logout: logoutMutation,
  };
}
