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
import { useRouter } from 'next/navigation';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import bcrypt from 'bcryptjs';
import { useToast } from "@/hooks/use-toast"; // Ensure this path is correct

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

const RegisterPage = () => {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (password !== confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match.",
        variant: "destructive",
      });
      return;
    }
    setIsLoading(true);

    try {
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      const { data: insertedUser, error } = await supabase
        .from('ox_lecturer')
        .insert([
          {
            username: fullName,
            email: email,
            password: hashedPassword,
          },
        ])
        .select('id, email') // Select id and email to use for the token
        .single(); // Expecting a single record back

      if (error || !insertedUser) {
        console.error('Supabase registration error:', error);
        toast({
          title: "Registration Failed",
          description: error?.message || "Could not create your account. Please try again.",
          variant: "destructive",
        });
        setIsLoading(false); // Ensure loading state is reset on error
        return; // Stop execution if there was an error
      }

      // Set auth token cookie
      const tokenValue = insertedUser.id || insertedUser.email; // Using user ID as token content
      document.cookie = `auth-token=${tokenValue}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`; // 7 days expiry

      toast({
        title: "Registration Successful",
        description: "Your account has been created. You are now logged in.",
      });

      setFullName('');
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      router.push(AUTHENTICATED_DEFAULT_PATH); // Redirect to dashboard after auto-login

    } catch (error: any) {
      console.error('Registration process error:', error);
        toast({
        
           title: "An Error Occurred",
           description: error.message || "Something went wrong during registration.",
           variant: "destructive",
         });
      
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background px-4 py-8">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <Logo />
          <CardTitle className="text-2xl">Create an Account</CardTitle>
          <CardDescription>
            Enter your details below to get started.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Username</Label>
              <Input
                id="fullName"
                type="text"
                placeholder="Choose a username"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
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
              <Label htmlFor="password">Password</Label>
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
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Creating Account...' : 'Create Account'}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col space-y-2 text-center text-sm">
          <p className="text-muted-foreground">
            Already have an account?{' '}
            <Link
              href="/login"
              className="font-medium text-primary hover:underline"
            >
              Log in
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
};

export default RegisterPage;