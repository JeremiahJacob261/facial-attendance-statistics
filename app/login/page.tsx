"use client";

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import bcrypt from 'bcryptjs';
import { useToast } from '@/hooks/use-toast'; // Assuming you have this hook

// Placeholder for your logo component or an img tag
const Logo = () => (
    <div className="flex items-center mb-6">
        <div className="w-16 h-16">
            <img src="/logo.png" alt="Logo" className="w-16 h-16" />
        </div>
        <div className="relative -ml-8">
            <svg
                className="w-16 h-16 text-primary"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
            >
                <path d="M12 14l9-5-9-5-9 5 9 5z"></path>
                <path d="M12 14l6.16-3.422A12.083 12.083 0 0112 21a12.083 12.083 0 01-6.16-10.422L12 14z"></path>
                <path d="M3.5 9.5L12 14l8.5-4.5"></path>
                <path d="M3.5 9.5V14a8.5 8.5 0 008.5 4.5 8.5 8.5 0 008.5-4.5V9.5L12 5l-8.5 4.5z"></path>
            </svg>
        </div>
    </div>
);

// Define the default path for authenticated users, should match middleware
const AUTHENTICATED_DEFAULT_PATH = '/dashboard';

const LoginPage = () => {
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);

    try {
      // Check against hardcoded credentials
      if (email === 'admin@fuoye.edu.ng' && password === 'facereg320') {
        // Set auth token cookie
        const tokenValue = 'admin-token'; // Using a simple token for admin
        document.cookie = `auth-token=${tokenValue}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`; // 7 days expiry

        toast({
          title: "Login Successful",
          description: "Welcome back!",
        });

        router.push(AUTHENTICATED_DEFAULT_PATH); // Redirect to dashboard
      } else {
        toast({
          title: "Login Failed",
          description: "Invalid email or password.",
          variant: "destructive",
        });
      }

    } catch (error: any) {
      console.error('Login process error:', error);
      toast({
        title: "An Error Occurred",
        description: "Something went wrong during login. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <Logo />
          <CardTitle className="text-2xl">Welcome Back!</CardTitle>
          <CardDescription>
            Enter your credentials to access your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link
                  href="/forgot-password" // Replace with your forgot password route
                  className="text-sm text-primary hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Logging in...' : 'Log In'}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col space-y-2 text-center text-sm">
          
          <br/>
          or
          <br/>
           <p className="text-muted-foreground">
            are you a student?{' '}
           <a href='https://facereg-stats.vercel.app' target="_blank" className='text-green-300'> 
            Student Login
           </a>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
};

export default LoginPage;
