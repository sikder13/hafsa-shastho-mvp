import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type InsertAppointment } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";

export function useAppointments() {
  return useQuery({
    queryKey: [api.appointments.list.path],
    queryFn: async () => {
      const res = await fetch(api.appointments.list.path);
      if (!res.ok) throw new Error("Failed to fetch appointments");
      return api.appointments.list.responses[200].parse(await res.json());
    },
  });
}

export function useCreateAppointment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: InsertAppointment) => {
      // Ensure date is properly serialized if it's a Date object
      const payload = {
        ...data,
        date: typeof data.date === 'string' ? data.date : (data.date as Date).toISOString(),
      };

      const res = await fetch(api.appointments.create.path, {
        method: api.appointments.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to create appointment");
      }
      return api.appointments.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.appointments.list.path] });
      toast({
        title: "অ্যাপয়েন্টমেন্ট নিশ্চিত হয়েছে",
        description: "আপনার অনুরোধ সফলভাবে জমা দেওয়া হয়েছে।",
      });
    },
    onError: (error) => {
      toast({
        title: "ত্রুটি",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
