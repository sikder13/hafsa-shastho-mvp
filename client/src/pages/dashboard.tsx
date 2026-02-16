import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useAppointments, useCreateAppointment } from "@/hooks/use-appointments";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { bn } from "date-fns/locale"; // Bengali locale if available, else standard
import { motion } from "framer-motion";
import { 
  Calendar as CalendarIcon, 
  LogOut, 
  Plus, 
  User, 
  Clock, 
  FileText, 
  CheckCircle2, 
  XCircle, 
  AlertCircle 
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { PageLoader } from "@/components/ui/loading-spinner";

// Schema for new appointment
const appointmentSchema = z.object({
  date: z.date({ required_error: "তারিখ নির্বাচন করুন" }),
  notes: z.string().optional(),
});

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const { data: appointments, isLoading } = useAppointments();
  const [open, setOpen] = useState(false);

  if (isLoading) return <PageLoader />;

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-30 shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold text-xl">
              হ
            </div>
            <div>
              <h1 className="font-display font-bold text-xl text-primary leading-none">হাফসা স্বাস্থ্য</h1>
              <p className="text-xs text-muted-foreground">ড্যাশবোর্ড</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => logout.mutate()} title="লগআউট">
            <LogOut className="h-5 w-5 text-muted-foreground hover:text-destructive transition-colors" />
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Welcome Section */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="bg-gradient-to-r from-primary to-primary/80 rounded-2xl p-6 text-white shadow-lg shadow-primary/20 relative overflow-hidden">
            <div className="absolute right-0 top-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
            <div className="relative z-10">
              <h2 className="text-2xl font-bold font-display mb-2">আস্সালামু আলাইকুম, {user?.name || "সম্মানিত ব্যবহারকারী"}!</h2>
              <p className="opacity-90 max-w-lg">
                আপনার স্বাস্থ্য আমাদের অগ্রাধিকার। নতুন অ্যাপয়েন্টমেন্ট বুক করতে নিচের বাটনটি ব্যবহার করুন।
              </p>
              <div className="mt-6 flex flex-wrap gap-4">
                <NewAppointmentDialog open={open} onOpenChange={setOpen} />
              </div>
            </div>
          </div>
        </motion.div>

        {/* Appointments List */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold font-display flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-primary" />
              আপনার অ্যাপয়েন্টমেন্টসমূহ
            </h3>
            <span className="bg-secondary text-primary px-3 py-1 rounded-full text-sm font-medium">
              মোট: {appointments?.length || 0}
            </span>
          </div>

          {!appointments || appointments.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-border">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <CalendarIcon className="h-8 w-8 text-muted-foreground" />
              </div>
              <h4 className="text-lg font-medium mb-1">কোন অ্যাপয়েন্টমেন্ট নেই</h4>
              <p className="text-muted-foreground mb-4">আপনি এখনো কোন অ্যাপয়েন্টমেন্ট বুক করেননি।</p>
              <Button onClick={() => setOpen(true)} variant="outline">
                নতুন অ্যাপয়েন্টমেন্ট
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {appointments.map((apt) => (
                <AppointmentCard key={apt.id} appointment={apt} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function AppointmentCard({ appointment }: { appointment: any }) {
  const statusConfig = {
    pending: { label: "অপেক্ষমান", color: "bg-yellow-100 text-yellow-800 border-yellow-200", icon: AlertCircle },
    confirmed: { label: "নিশ্চিত", color: "bg-green-100 text-green-800 border-green-200", icon: CheckCircle2 },
    completed: { label: "সম্পন্ন", color: "bg-blue-100 text-blue-800 border-blue-200", icon: CheckCircle2 },
    cancelled: { label: "বাতিল", color: "bg-red-100 text-red-800 border-red-200", icon: XCircle },
  };

  const status = statusConfig[appointment.status as keyof typeof statusConfig] || statusConfig.pending;
  const StatusIcon = status.icon;

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white rounded-xl p-5 border shadow-sm hover:shadow-md transition-shadow hover:border-primary/20 group"
    >
      <div className="flex justify-between items-start mb-4">
        <div className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 border ${status.color}`}>
          <StatusIcon className="w-3.5 h-3.5" />
          {status.label}
        </div>
        <div className="text-xs text-muted-foreground">
           ID: #{appointment.id}
        </div>
      </div>
      
      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <CalendarIcon className="w-5 h-5 text-primary mt-0.5" />
          <div>
            <p className="text-sm font-medium text-muted-foreground">তারিখ</p>
            <p className="font-semibold text-lg">
              {format(new Date(appointment.date), "PPP", { locale: bn })}
            </p>
          </div>
        </div>
        
        <div className="flex items-start gap-3">
          <Clock className="w-5 h-5 text-primary mt-0.5" />
          <div>
            <p className="text-sm font-medium text-muted-foreground">সময়</p>
            <p className="font-medium">
              {format(new Date(appointment.date), "p", { locale: bn })}
            </p>
          </div>
        </div>

        {appointment.notes && (
          <div className="flex items-start gap-3 pt-2 border-t mt-2">
            <FileText className="w-5 h-5 text-muted-foreground mt-0.5" />
            <p className="text-sm text-muted-foreground italic line-clamp-2">
              "{appointment.notes}"
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function NewAppointmentDialog({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
  const { mutate, isPending } = useCreateAppointment();
  const { user } = useAuth();
  
  const form = useForm<z.infer<typeof appointmentSchema>>({
    resolver: zodResolver(appointmentSchema),
    defaultValues: {
      notes: "",
    },
  });

  const onSubmit = (data: z.infer<typeof appointmentSchema>) => {
    if (!user) return;
    mutate(
      {
        patientId: user.id,
        date: data.date,
        notes: data.notes || null,
        status: "pending"
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          form.reset();
        }
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button className="bg-white text-primary hover:bg-white/90 font-bold shadow-lg shadow-black/5">
          <Plus className="mr-2 h-5 w-5" /> নতুন অ্যাপয়েন্টমেন্ট
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl text-primary">নতুন অ্যাপয়েন্টমেন্ট বুক করুন</DialogTitle>
          <DialogDescription>
            দয়া করে আপনার পছন্দসই তারিখ এবং সময় নির্বাচন করুন।
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>তারিখ ও সময়</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-full pl-3 text-left font-normal h-12",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            format(field.value, "PPP - p", { locale: bn })
                          ) : (
                            <span>তারিখ নির্বাচন করুন</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) =>
                          date < new Date() || date < new Date("1900-01-01")
                        }
                        initialFocus
                      />
                      <div className="p-3 border-t">
                        <Input 
                          type="time" 
                          className="w-full"
                          onChange={(e) => {
                            const timeParts = e.target.value.split(":");
                            if (field.value && timeParts.length === 2) {
                              const newDate = new Date(field.value);
                              newDate.setHours(parseInt(timeParts[0]), parseInt(timeParts[1]));
                              field.onChange(newDate);
                            }
                          }}
                        />
                      </div>
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>সমস্যা সম্পর্কে লিখুন (ঐচ্ছিক)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="আপনার সমস্যা সংক্ষেপে বর্ণনা করুন..."
                      className="resize-none min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full h-12 font-bold text-lg" disabled={isPending}>
              {isPending ? "বুকিং হচ্ছে..." : "নিশ্চিত করুন"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
