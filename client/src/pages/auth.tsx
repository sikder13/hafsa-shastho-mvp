import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Phone, ShieldCheck, ArrowRight, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";

// Validation Schemas
const phoneSchema = z.object({
  phoneNumber: z.string().regex(/^01[3-9]\d{8}$/, "সঠিক বাংলাদেশী মোবাইল নম্বর দিন (যেমন: 017...)"),
});

const otpSchema = z.object({
  otp: z.string().length(6, "OTP কোড ৬ সংখ্যার হতে হবে"),
});

export default function AuthPage() {
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phoneNumber, setPhoneNumber] = useState("");
  const { sendOtp, verifyOtp, user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  // Redirect if already logged in
  useEffect(() => {
    if (!isLoading && user) {
      setLocation("/dashboard");
    }
  }, [user, isLoading, setLocation]);

  if (!isLoading && user) return null;

  // Forms
  const phoneForm = useForm<z.infer<typeof phoneSchema>>({
    resolver: zodResolver(phoneSchema),
    defaultValues: { phoneNumber: "" },
  });

  const otpForm = useForm<z.infer<typeof otpSchema>>({
    resolver: zodResolver(otpSchema),
    defaultValues: { otp: "" },
  });

  // Handlers
  const onPhoneSubmit = async (data: z.infer<typeof phoneSchema>) => {
    try {
      // Normalize phone number to include +880 if backend expects it
      // Assuming backend handles raw input or expects specific format
      // Here we assume backend handles '017...' directly or we prep it
      await sendOtp.mutateAsync({ phoneNumber: data.phoneNumber });
      setPhoneNumber(data.phoneNumber);
      setStep("otp");
    } catch (error) {
      // Error handled by mutation hook toast
    }
  };

  const onOtpSubmit = async (data: z.infer<typeof otpSchema>) => {
    try {
      await verifyOtp.mutateAsync({ phoneNumber, otp: data.otp });
    } catch (error) {
      // Error handled by mutation hook toast
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-secondary/50 via-background to-secondary/30 flex items-center justify-center p-4">
      {/* Decorative background elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-accent/5 rounded-full blur-3xl"></div>
      </div>

      <div className="w-full max-w-md z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="text-center mb-8">
            {/* Logo Placeholder */}
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4 shadow-sm border border-primary/20">
              <ShieldCheck className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-4xl font-bold text-primary mb-2 font-display">হাফসা স্বাস্থ্য</h1>
            <p className="text-muted-foreground text-lg">শিশুর স্বাস্থ্য, মায়ের শান্তি</p>
          </div>

          <Card className="border-primary/10 shadow-xl backdrop-blur-sm bg-white/90">
            <CardHeader>
              <CardTitle className="text-2xl text-center font-display">
                {step === "phone" ? "স্বাগতম!" : "যাচাইকরণ"}
              </CardTitle>
              <CardDescription className="text-center">
                {step === "phone"
                  ? "সেবা পেতে আপনার মোবাইল নম্বর দিয়ে লগইন করুন"
                  : `আমরা ${phoneNumber} নম্বরে একটি কোড পাঠিয়েছি`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AnimatePresence mode="wait">
                {step === "phone" ? (
                  <motion.div
                    key="phone-step"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Form {...phoneForm}>
                      <form onSubmit={phoneForm.handleSubmit(onPhoneSubmit)} className="space-y-6">
                        <FormField
                          control={phoneForm.control}
                          name="phoneNumber"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-foreground/80">মোবাইল নম্বর</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <div className="absolute left-3 top-2.5 text-muted-foreground pointer-events-none">
                                    <Phone className="h-5 w-5" />
                                  </div>
                                  <Input
                                    placeholder="017XXXXXXXX"
                                    className="pl-10 h-12 text-lg tracking-wide border-primary/20 focus:border-primary focus:ring-primary/20 bg-white"
                                    {...field}
                                  />
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <Button
                          type="submit"
                          className="w-full h-12 text-lg font-medium bg-primary hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
                          disabled={sendOtp.isPending}
                        >
                          {sendOtp.isPending ? (
                            <>
                              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> পাঠাচ্ছি...
                            </>
                          ) : (
                            <>
                              OTP পাঠান <ArrowRight className="ml-2 h-5 w-5" />
                            </>
                          )}
                        </Button>
                      </form>
                    </Form>
                  </motion.div>
                ) : (
                  <motion.div
                    key="otp-step"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Form {...otpForm}>
                      <form onSubmit={otpForm.handleSubmit(onOtpSubmit)} className="space-y-6">
                        <FormField
                          control={otpForm.control}
                          name="otp"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-foreground/80">OTP কোড</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <div className="absolute left-3 top-2.5 text-muted-foreground pointer-events-none">
                                    <ShieldCheck className="h-5 w-5" />
                                  </div>
                                  <Input
                                    placeholder="123456"
                                    className="pl-10 h-12 text-lg tracking-[0.5em] font-mono text-center border-primary/20 focus:border-primary focus:ring-primary/20 bg-white"
                                    maxLength={6}
                                    {...field}
                                  />
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <Button
                          type="submit"
                          className="w-full h-12 text-lg font-medium bg-primary hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
                          disabled={verifyOtp.isPending}
                        >
                          {verifyOtp.isPending ? (
                            <>
                              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> যাচাই করছি...
                            </>
                          ) : (
                            <>
                              যাচাই করুন <CheckCircle2 className="ml-2 h-5 w-5" />
                            </>
                          )}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          className="w-full text-muted-foreground hover:text-primary"
                          onClick={() => setStep("phone")}
                          disabled={verifyOtp.isPending}
                        >
                          নম্বর পরিবর্তন করুন
                        </Button>
                      </form>
                    </Form>
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
            <Separator className="bg-border/50" />
            <CardFooter className="pt-6 pb-6 bg-muted/30">
              <p className="text-xs text-center w-full text-muted-foreground">
                লগইন করার মাধ্যমে আপনি আমাদের শর্তাবলী এবং গোপনীয়তা নীতিতে সম্মত হচ্ছেন।
              </p>
            </CardFooter>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
